"""AES-256-GCM 獨立元件測試。

- 暫時 256-bit key、96-bit nonce、合成 plaintext、明確 AAD。
- 正常加解密必須 byte-for-byte 相同。
- 修改密文／tag、錯誤 key、nonce、AAD 都必須拒絕（InvalidTag），
  不得交付驗證失敗的明文。
- 每次加密使用新 nonce。對「既有密文」重複負面 decrypt 測試只是重複
  解密，不等於加密 nonce 重用。
- GCM tag 本身不防重放；replay 防護屬後續 protocol state 的工作。
"""
from __future__ import annotations

import os

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from . import models

_PLAINTEXT = b"PQPM stage 1 AES-256-GCM synthetic plaintext \x00\x01\x02"
_AAD = b"pqpm-stage1/aead-test/aad"


def _rejected(operation) -> bool:
    """執行負面 decrypt；丟 InvalidTag（或任何明確例外）視為拒絕。"""
    try:
        operation()
        return False
    except InvalidTag:
        return True
    except Exception:
        return True


def run_aead_checks(group: dict) -> None:
    """就地更新 aes_gcm 分組（不回傳任何秘密）。"""
    key = os.urandom(32)
    nonce = os.urandom(12)
    ciphertext = AESGCM(key).encrypt(nonce, _PLAINTEXT, _AAD)

    roundtrip_ok = AESGCM(key).decrypt(nonce, ciphertext, _AAD) == _PLAINTEXT

    tampered_tag = ciphertext[:-1] + bytes([ciphertext[-1] ^ 0x01])
    tampered_body = ciphertext[:4] + bytes([ciphertext[4] ^ 0xFF]) + ciphertext[5:]

    tamper_rejected = _rejected(
        lambda: AESGCM(key).decrypt(nonce, tampered_tag, _AAD)
    ) and _rejected(lambda: AESGCM(key).decrypt(nonce, tampered_body, _AAD))
    wrong_key_rejected = _rejected(
        lambda: AESGCM(os.urandom(32)).decrypt(nonce, ciphertext, _AAD)
    )
    wrong_nonce_rejected = _rejected(
        lambda: AESGCM(key).decrypt(os.urandom(12), ciphertext, _AAD)
    )
    wrong_aad_rejected = _rejected(
        lambda: AESGCM(key).decrypt(nonce, ciphertext, b"other-aad")
    )

    checks = group["checks"]
    checks["roundtrip"] = models.new_check(
        "passed" if roundtrip_ok else "failed",
        note=None if roundtrip_ok else "解密結果與原文不一致",
    )
    checks["tampered_ciphertext_rejected"] = models.new_check(
        "passed" if tamper_rejected else "failed",
        note=None if tamper_rejected else "被修改的密文／tag 未被拒絕",
    )
    checks["wrong_key_rejected"] = models.new_check(
        "passed" if wrong_key_rejected else "failed",
        note=None if wrong_key_rejected else "錯誤 key 未被拒絕",
    )
    checks["wrong_nonce_rejected"] = models.new_check(
        "passed" if wrong_nonce_rejected else "failed",
        note=None if wrong_nonce_rejected else "錯誤 nonce 未被拒絕",
    )
    checks["wrong_aad_rejected"] = models.new_check(
        "passed" if wrong_aad_rejected else "failed",
        note=None if wrong_aad_rejected else "錯誤 AAD 未被拒絕",
    )

    group["note"] = (
        "獨立元件測試：每次加密使用新 nonce；GCM tag 不防重放"
        "（replay 防護屬後續 protocol state）。"
    )
    group["status"] = (
        "passed"
        if all(c["status"] == "passed" for c in checks.values())
        else "failed"
    )
