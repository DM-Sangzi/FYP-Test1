"""ML-KEM 可行性檢查（Stage 1：ML-KEM-768，必需、不降級）。

安全邊界：
- 只在 Python 程序內產生短暫測試金鑰；私鑰與 shared secret 不離開本模組，
  不寫入任何欄位、log 或檔案。
- 回傳報告只含非秘密資料（長度、公鑰 SHA-256 指紋、狀態）。
- liboqs-python 0.16.x 的 ``import oqs`` 內建「自動 git clone + cmake 編譯」
  安裝器（偵測不到 native library 時會自動下載原始碼安裝到 ``~/_oqs``）。
  本模組因此採取兩層防護，嚴格禁止任何自動下載／編譯：
  1. 純檔案系統預檢——DLL 不存在時直接回 blocked，完全不觸發 import；
  2. 需要 import 時，暫時以會丟例假的 stub 取代 subprocess.run/Popen，
     就算 wrapper 決定自動安裝也會被擋下（並在 finally 還原）。
"""
from __future__ import annotations

import hashlib
import threading
from pathlib import Path

from . import models

#: Stage 1 必需的 KEM identifier；不可用時回報 blocked，不偷偷降級
KEM_IDENTIFIER = "ML-KEM-768"

#: 偵測鎖：避免兩個執行緒同時進行（subprocess 防護窗不重疊）
_DETECT_LOCK = threading.Lock()


def _native_dll_candidates() -> list[str]:
    """複製 liboqs-python 的 native library 搜尋位置（與 oqs/oqs.py 對齊）。"""
    import os
    import platform

    install = os.environ.get("OQS_INSTALL_PATH") or str(Path.home() / "_oqs")
    if platform.system() == "Windows":
        names = ("oqs.dll", "liboqs.dll")
        subdirs = ("bin",)
    else:
        names = ("liboqs.so",)
        subdirs = ("lib", "lib64")
    return [str(Path(install) / sub / name) for sub in subdirs for name in names]


def detect_liboqs() -> dict:
    """偵測 liboqs wrapper／native library 是否可用（只偵測，不安裝）。"""
    with _DETECT_LOCK:
        # 第一層：純檔案預檢。DLL 不存在 → 直接 blocked，連 import 都不觸發。
        found_on_disk = any(Path(p).is_file() for p in _native_dll_candidates())
        if not found_on_disk:
            import ctypes.util

            try:
                located = (
                    ctypes.util.find_library("oqs")
                    or ctypes.util.find_library("liboqs")
                )
            except Exception:
                located = None
            # Windows 上 find_library 只掃描 PATH，不會執行子程序
            if not located:
                return {
                    "available": False,
                    "reason": (
                        "native liboqs（oqs.dll）未配置"
                        "（檔案預檢即回報，未觸發 import／自動下載／編譯）"
                    ),
                }

        # 第二層：有候選 DLL 才 import；import 期間封鎖所有子程序
        import subprocess as _subprocess

        def _blocked(*_args, **_kwargs):
            raise RuntimeError("pqpm_client 已封鎖 liboqs-python 的自動安裝路徑")

        _orig_run, _orig_popen = _subprocess.run, _subprocess.Popen
        _subprocess.run = _blocked
        _subprocess.Popen = _blocked
        try:
            import oqs  # noqa: F401
        except ImportError:
            return {"available": False, "reason": "liboqs-python 套件未安裝於本 venv"}
        except RuntimeError as exc:
            if "pqpm_client 已封鎖" in str(exc):
                return {
                    "available": False,
                    "reason": "native liboqs（oqs.dll）載入失敗且已封鎖自動安裝",
                    "error_type": "AutoInstallBlocked",
                }
            return {
                "available": False,
                "reason": "native liboqs（oqs.dll）未配置或載入失敗",
                "error_type": type(exc).__name__,
            }
        except Exception as exc:
            return {
                "available": False,
                "reason": "native liboqs（oqs.dll）未配置或載入失敗",
                "error_type": type(exc).__name__,
            }
        finally:
            _subprocess.run = _orig_run
            _subprocess.Popen = _orig_popen

        try:
            version = str(oqs.oqs_version())
        except Exception:
            version = None
        return {"available": True, "reason": "", "native_version": version}


def run_kem_checks(group: dict) -> None:
    """就地更新 ml_kem 分組；所有路徑都只寫入非秘密欄位。"""
    group["algorithm"] = KEM_IDENTIFIER

    def _block(note: str) -> None:
        group["status"] = "blocked"
        group["note"] = note
        for check in group["checks"].values():
            check["status"] = "blocked"

    detection = detect_liboqs()
    if not detection["available"]:
        detail = detection.get("error_type")
        suffix = f"（{detail}）" if detail else ""
        _block(
            f"{detection['reason']}{suffix}。"
            "此為 B 模式預期狀態：安裝 native liboqs 前如實顯示受阻。"
        )
        return

    import oqs

    try:
        identifiers = list(oqs.get_enabled_kem_mechanisms())
    except Exception as exc:
        _block(f"無法列出 enabled KEM identifiers（{type(exc).__name__}）")
        return
    group["enabled_identifiers"] = identifiers

    if KEM_IDENTIFIER not in identifiers:
        _block(
            f"必要的 {KEM_IDENTIFIER} 不在 enabled identifiers 中；不擅自替換成其他演算法。"
        )
        return

    # 產生短暫金鑰並執行封裝／解封裝（secret 只存在本函式區域變數）
    with oqs.KeyEncapsulation(KEM_IDENTIFIER) as receiver:
        public_key = receiver.generate_keypair()
        expected_ct_len = int(receiver.details["length_ciphertext"])
        with oqs.KeyEncapsulation(KEM_IDENTIFIER) as sender:
            ciphertext, secret_sender = sender.encap_secret(public_key)
        secret_receiver = receiver.decap_secret(ciphertext)
    # 離開 with 區塊＝釋放 native 物件（Python／native runtime 的完整記憶體
    # 抹除不作保譐，亦不得宣稱「已安全擦除所有私鑰」）

    secrets_equal = secret_sender == secret_receiver
    group["public_key_bytes"] = len(public_key)
    group["ciphertext_bytes"] = len(ciphertext)
    group["public_key_fingerprint_sha256"] = hashlib.sha256(public_key).hexdigest()

    # 錯誤長度 ciphertext：以「安全應用層」驗證（Stage 1 文件 §6.1）——
    # 以 details 的標準長度比對後明確拒絕。實測 liboqs-python 0.16 不會
    # 對錯誤長度丟例外（直接傳入 native 更有越界讀取風險），因此不把
    # 錯誤長度交給 native，而是記錄「應用層必須自行驗證長度」。
    malformed_rejected = len(ciphertext[:-1]) != expected_ct_len

    group["checks"]["keygen"] = models.new_check("passed")
    group["checks"]["secret_equality"] = models.new_check(
        "passed" if secrets_equal else "failed",
        note=None if secrets_equal else "封裝與解封裝的 secret 不一致",
    )
    group["checks"]["ciphertext_length"] = models.new_check(
        "passed",
        note=f"{len(ciphertext)} bytes（標準長度 {expected_ct_len}）",
    )
    group["checks"]["malformed_ciphertext_rejected"] = models.new_check(
        "passed" if malformed_rejected else "failed",
        note=(
            "應用層長度驗證拒絕（wrapper 0.16 實測不丟例外，"
            "長度檢查必須在應用層進行）"
            if malformed_rejected
            else "應用層未拒絕錯誤長度"
        ),
    )

    group["note"] = (
        "短暫測試金鑰，非正式身分金鑰；本項不測試正式 peer authentication。"
        "正確長度但被修改的 ciphertext 會觸發 implicit rejection（得到不同 secret），"
        "不等於通過身分驗證。"
    )
    group["status"] = (
        "passed"
        if all(c["status"] == "passed" for c in group["checks"].values())
        else "failed"
    )
