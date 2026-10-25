"""非秘密結果 schema（Stage 1 feasibility）。

安全邊界：本模組定義的所有欄位都必須是可以安全顯示在 UI／terminal 的
非秘密資料——私鑰、shared secret、derived AES key 一律不得加入任何欄位。
公鑰可公開，但這裡只記錄長度與 SHA-256 指紋（完整 hex digest），不記錄
大量 base64 key bytes。
"""
from __future__ import annotations

import datetime as _dt

SCHEMA_VERSION = 1

#: 單一檢查項允許的狀態（UI 另有暫態 running，由前端顯示層使用）
CHECK_STATUSES = ("not_run", "passed", "failed", "blocked")

#: 整體狀態。任何一個分組受阻時整體回「blocked」，不得顯示全部通過。
OVERALL_STATUSES = ("not_run", "passed", "partial", "failed", "blocked")

#: 固定聲明：第 1 階段沒有 E2EE session
E2EE_SESSION_STATUS = "尚未實作"

#: 結果來源標示（UI 顯示「本機真實測試，非 MSW」）
RESULT_SOURCE = "local_python"

# ---------------------------------------------------------------------------
# 檢查項的中文標籤（CLI 摘要與文件共用；前端另有 TS 對照）
# ---------------------------------------------------------------------------

CHECK_LABELS: dict[str, dict[str, str]] = {
    "ml_kem": {
        "keygen": "金鑰生成",
        "secret_equality": "Shared-secret equality（封裝／解封裝一致）",
        "ciphertext_length": "Ciphertext 長度",
        "malformed_ciphertext_rejected": "錯誤長度 ciphertext 拒絕",
    },
    "ml_dsa": {
        "keygen": "金鑰生成",
        "sign_verify_correct": "正確簽章驗證",
        "modified_message_rejected": "修改訊息後拒絕",
        "wrong_key_rejected": "錯誤公鑰拒絕",
        "signature_length": "Signature 長度",
    },
    "hkdf": {
        "deterministic_same_inputs": "相同輸入（新 instance）派生一致",
        "context_separation": "不同 context 派生不同結果",
    },
    "aes_gcm": {
        "roundtrip": "正常加解密還原（byte-for-byte）",
        "tampered_ciphertext_rejected": "修改密文／tag 拒絕",
        "wrong_key_rejected": "錯誤 key 拒絕",
        "wrong_nonce_rejected": "錯誤 nonce 拒絕",
        "wrong_aad_rejected": "錯誤 AAD 拒絕",
    },
}


def utc_now_iso() -> str:
    """UTC 時間戳（僅作執行記錄；非安全敏感）。"""
    return _dt.datetime.now(_dt.timezone.utc).isoformat(timespec="seconds")


def new_check(status: str = "not_run", note: str | None = None) -> dict:
    if status not in CHECK_STATUSES:
        raise ValueError(f"不允許的檢查狀態：{status}")
    return {"status": status, "note": note}


def new_checks(group: str) -> dict[str, dict]:
    return {name: new_check() for name in CHECK_LABELS[group]}


def new_pqc_group() -> dict:
    """ML-KEM / ML-DSA 共用的分組骨架（不同金鑰、各自獨立欄位）。"""
    return {
        "status": "not_run",
        "algorithm": None,
        "enabled_identifiers": [],
        "public_key_bytes": None,
        "public_key_fingerprint_sha256": None,
        "ciphertext_bytes": None,
        "signature_bytes": None,
        "checks": None,  # 由各 check 模組填入
        "note": None,
    }


def new_simple_group() -> dict:
    return {"status": "not_run", "checks": None, "note": None}


def new_report(run_id: str) -> dict:
    """建立全部檢查均為 not_run 的報告骨架。"""
    ml_kem = new_pqc_group()
    ml_kem["checks"] = new_checks("ml_kem")
    ml_dsa = new_pqc_group()
    ml_dsa["checks"] = new_checks("ml_dsa")
    hkdf = new_simple_group()
    hkdf["checks"] = new_checks("hkdf")
    aes_gcm = new_simple_group()
    aes_gcm["checks"] = new_checks("aes_gcm")
    return {
        "schema_version": SCHEMA_VERSION,
        "run_id": run_id,
        "source": RESULT_SOURCE,
        "started_at": None,
        "finished_at": None,
        "overall": "not_run",
        "overall_note": None,
        # 固定聲明欄位：任何畫面都必須顯示 E2EE session 尚未實作
        "e2ee_session": E2EE_SESSION_STATUS,
        "groups": {
            "ml_kem": ml_kem,
            "ml_dsa": ml_dsa,
            "hkdf": hkdf,
            "aes_gcm": aes_gcm,
        },
    }


# ---------------------------------------------------------------------------
# schema 自檢：禁止任何秘密欄位名稱出現在報告中（供測試與 runner 使用）
# ---------------------------------------------------------------------------

_FORBIDDEN_KEY_SUBSTRINGS = ("secret", "private", "shared", "derived")


def find_forbidden_keys(value, path: str = "report", parent_is_checks: bool = False) -> list[str]:
    """遞迴找出欄位名稱含秘密字樣的鍵（回傳路徑清單；空清單代表通過）。

    ``checks`` 字典內的鍵是「檢查項識別名」（如 secret_equality，
    描述測試名稱，本身不是秘密資料），只檢查其值，不檢查鍵名。
    """
    problems: list[str] = []
    if isinstance(value, dict):
        for key, child in value.items():
            here = f"{path}.{key}"
            is_checks_map = key == "checks"
            if not parent_is_checks and not is_checks_map:
                lowered = str(key).lower()
                if any(word in lowered for word in _FORBIDDEN_KEY_SUBSTRINGS):
                    problems.append(here)
            problems.extend(
                find_forbidden_keys(child, here, parent_is_checks=is_checks_map)
            )
    elif isinstance(value, list):
        for index, child in enumerate(value):
            problems.extend(
                find_forbidden_keys(child, f"{path}[{index}]", parent_is_checks)
            )
    return problems
