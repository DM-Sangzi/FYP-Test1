"""HKDF-SHA-256 獨立元件測試（非正式協定 key schedule）。

- 相同輸入以兩個新的 HKDF instance 派生，結果必須一致。
- 明確且不同用途／方向的 context labels（c2s、s2c、confirmation）必須
  派生不同結果。
- 輸入秘密與派生金鑰都不會出現在回傳結果中；正式 transcript binding
  留待後續 session specification（Stage 2）。
"""
from __future__ import annotations

import os

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from . import models

_CONTEXT_C2S = b"pqpm-stage1/hkdf-test/c2s"
_CONTEXT_S2C = b"pqpm-stage1/hkdf-test/s2c"
_CONTEXT_CONFIRM = b"pqpm-stage1/hkdf-test/confirmation"


def _derive(salt: bytes, ikm: bytes, info: bytes, length: int = 32) -> bytes:
    hkdf = HKDF(algorithm=hashes.SHA256(), length=length, salt=salt, info=info)
    return hkdf.derive(ikm)


def run_kdf_checks(group: dict) -> None:
    """就地更新 hkdf 分組（不回傳任何秘密）。"""
    input_secret = os.urandom(32)  # 短暫測試輸入秘密；只在函式內使用
    salt = os.urandom(16)

    first = _derive(salt, input_secret, _CONTEXT_C2S)
    second = _derive(salt, input_secret, _CONTEXT_C2S)  # 新 instance、同輸入
    c2s = _derive(salt, input_secret, _CONTEXT_C2S)
    s2c = _derive(salt, input_secret, _CONTEXT_S2C)
    confirm = _derive(salt, input_secret, _CONTEXT_CONFIRM)

    deterministic = first == second
    separated = c2s != s2c and c2s != confirm and s2c != confirm

    group["checks"]["deterministic_same_inputs"] = models.new_check(
        "passed" if deterministic else "failed",
        note=None if deterministic else "相同輸入的兩次派生結果不一致",
    )
    group["checks"]["context_separation"] = models.new_check(
        "passed" if separated else "failed",
        note=None if separated else "不同 context labels 派生了相同結果",
    )
    group["note"] = "獨立元件測試（HKDF-SHA-256），非正式協定 key schedule。"
    group["status"] = (
        "passed"
        if all(c["status"] == "passed" for c in group["checks"].values())
        else "failed"
    )
