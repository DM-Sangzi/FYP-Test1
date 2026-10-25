"""UI 與 CLI 共用的 feasibility 服務（單一實作，避免兩套邏輯不一致）。

- 每次執行生成新的短暫測試金鑰與新的 run ID；不綁定任何帳號。
- 以 threading.Lock 防止平行執行：第二個請求直接收到 busy，
  不只依賴前端 UI 防並行。
- 回傳的報告 schema 由 models.py 定義，全為非秘密欄位。
"""
from __future__ import annotations

import platform
import secrets as _secrets
import sys
import threading
from importlib import metadata

from . import aead_checks, kdf_checks, kem_checks, models, signature_checks

BRIDGE_VERSION = 1


class BusyError(RuntimeError):
    """已有測試執行中（busy）。"""


def _package_version(name: str) -> str | None:
    try:
        return metadata.version(name)
    except Exception:
        return None


class FeasibilityService:
    """本機密碼工具測試服務（thread-safe：同一時間只允許一個 suite）。"""

    def __init__(self) -> None:
        self._lock = threading.Lock()

    # ------------------------------------------------------------------
    # health check（非秘密環境資訊）
    # ------------------------------------------------------------------
    def health_check(self) -> dict:
        detection = kem_checks.detect_liboqs()
        enabled_kem: list[str] = []
        enabled_sig: list[str] = []
        native_note = None
        if detection["available"]:
            native_note = (
                f"native liboqs 版本：{detection.get('native_version') or '未知'}"
            )
            try:
                import oqs

                enabled_kem = list(oqs.get_enabled_kem_mechanisms())
                enabled_sig = list(oqs.get_enabled_sig_mechanisms())
            except Exception as exc:
                native_note = f"列舉 identifiers 失敗：{type(exc).__name__}"
        else:
            native_note = detection["reason"]

        return {
            "bridge_version": BRIDGE_VERSION,
            "mode": "diagnostics",
            "python_version": sys.version.split()[0],
            "platform_summary": f"{platform.system()} {platform.release()} ({platform.machine()})",
            "cryptography_version": _package_version("cryptography"),
            "liboqs_python_version": _package_version("liboqs-python"),
            "native_liboqs_available": detection["available"],
            "native_liboqs_note": native_note,
            "enabled_kem_identifiers": enabled_kem,
            "enabled_sig_identifiers": enabled_sig,
        }

    # ------------------------------------------------------------------
    # 測試 suite
    # ------------------------------------------------------------------
    def run_checks(self) -> dict:
        if not self._lock.acquire(blocking=False):
            raise BusyError("已有一個測試 suite 執行中（busy）")
        try:
            report = models.new_report(run_id=_secrets.token_hex(4))
            report["started_at"] = models.utc_now_iso()

            runners = (
                (kem_checks.run_kem_checks, "ml_kem"),
                (signature_checks.run_signature_checks, "ml_dsa"),
                (kdf_checks.run_kdf_checks, "hkdf"),
                (aead_checks.run_aead_checks, "aes_gcm"),
            )
            for run, group_key in runners:
                group = report["groups"][group_key]
                try:
                    run(group)
                except Exception as exc:
                    # 只回報例外類別，不外洩可能含敏感內容的 traceback
                    group["status"] = "failed"
                    group["note"] = f"檢查過程發生例外：{type(exc).__name__}"
                    for check in (group.get("checks") or {}).values():
                        if check["status"] == "not_run":
                            check["status"] = "not_run"

            report["finished_at"] = models.utc_now_iso()
            self._finalize_overall(report)
            return report
        finally:
            self._lock.release()

    @staticmethod
    def _finalize_overall(report: dict) -> None:
        statuses = [g["status"] for g in report["groups"].values()]
        if "failed" in statuses:
            report["overall"] = "failed"
            report["overall_note"] = "有檢查項失敗；請查看分組詳情。"
        elif "blocked" in statuses:
            report["overall"] = "blocked"
            blocked = [k for k, g in report["groups"].items() if g["status"] == "blocked"]
            report["overall_note"] = (
                f"分組受阻：{', '.join(blocked)}。"
                "整體不得顯示全部通過；其餘分組的通過僅代表該元件本機測試通過。"
            )
        elif all(s == "passed" for s in statuses):
            report["overall"] = "passed"
            report["overall_note"] = (
                "全部元件通過本機測試；僅代表工具可行性，"
                "不代表 E2EE 聊天已完成。"
            )
        else:
            report["overall"] = "partial"
            report["overall_note"] = "仍有未執行或混合狀態的檢查項。"


# ---------------------------------------------------------------------------
# CLI 摘要（純文字、非秘密；pywebview 不會 import 本檔以外的 GUI 相依）
# ---------------------------------------------------------------------------

_STATUS_LABELS = {
    "not_run": "未執行",
    "passed": "通過",
    "failed": "失敗",
    "blocked": "受阻",
    "partial": "部分",
}

_GROUP_TITLES = {
    "ml_kem": "ML-KEM",
    "ml_dsa": "ML-DSA",
    "hkdf": "HKDF-SHA-256",
    "aes_gcm": "AES-256-GCM",
}


def format_cli_summary(report: dict) -> str:
    lines: list[str] = []
    lines.append("PQPM 第 1 階段 — 本機密碼工具檢查（CLI 摘要，非秘密）")
    lines.append(f"執行編號（run ID）：{report['run_id']}")
    lines.append(
        f"整體狀態：{_STATUS_LABELS.get(report['overall'], report['overall'])}"
    )
    if report.get("overall_note"):
        lines.append(f"  {report['overall_note']}")
    lines.append(f"E2EE session：{report['e2ee_session']}")
    lines.append("")
    for key, group in report["groups"].items():
        title = _GROUP_TITLES[key]
        status = _STATUS_LABELS.get(group["status"], group["status"])
        algorithm = f"（{group['algorithm']}）" if group.get("algorithm") else ""
        lines.append(f"[{title}{algorithm}] 狀態：{status}")
        if group.get("note"):
            lines.append(f"  說明：{group['note']}")
        for name, check in (group.get("checks") or {}).items():
            label = models.CHECK_LABELS[key].get(name, name)
            check_status = _STATUS_LABELS.get(check["status"], check["status"])
            detail = f" — {check['note']}" if check.get("note") else ""
            lines.append(f"  - {label}：{check_status}{detail}")
        if group.get("public_key_bytes") is not None:
            lines.append(f"  公鑰長度：{group['public_key_bytes']} bytes")
        if group.get("public_key_fingerprint_sha256"):
            lines.append(
                f"  公鑰 SHA-256 指紋：{group['public_key_fingerprint_sha256']}"
            )
        lines.append("")
    lines.append(
        "注意：本次為短暫測試金鑰（非正式帳號身分金鑰）；"
        "結果僅代表本機元件測試，不代表 E2EE 聊天 session 已完成。"
    )
    return "\n".join(lines)
