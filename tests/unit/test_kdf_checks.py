"""HKDF-SHA-256 獨立元件測試（真實執行 cryptography，無 mock）。"""
import os

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from pqpm_client.feasibility import kdf_checks, models


def _derive(salt: bytes, ikm: bytes, info: bytes) -> bytes:
    return HKDF(
        algorithm=hashes.SHA256(), length=32, salt=salt, info=info
    ).derive(ikm)


def test_hkdf_semantics_direct():
    ikm = os.urandom(32)
    salt = os.urandom(16)
    # 相同輸入（兩個新 instance）→ 相同輸出
    assert _derive(salt, ikm, b"ctx-a") == _derive(salt, ikm, b"ctx-a")
    # 不同 context → 不同輸出
    a = _derive(salt, ikm, b"ctx-a")
    b = _derive(salt, ikm, b"ctx-b")
    c = _derive(salt, ikm, b"ctx-c")
    assert a != b and a != c and b != c


def test_run_kdf_checks_all_passed_and_no_secret_fields():
    report = models.new_report("0000")
    group = report["groups"]["hkdf"]
    kdf_checks.run_kdf_checks(group)
    assert group["status"] == "passed"
    for check in group["checks"].values():
        assert check["status"] == "passed"
    # 群組內容可序列化且不含秘密欄位
    assert models.find_forbidden_keys(group) == []
