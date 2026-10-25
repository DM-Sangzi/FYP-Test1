"""AES-256-GCM 獨立元件測試（真實執行 cryptography，無 mock）。"""
import os

import pytest
from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from pqpm_client.feasibility import aead_checks, models

PLAINTEXT = b"aes-gcm unit test plaintext"
AAD = b"unit-test-aad"


def test_aesgcm_roundtrip_and_negatives_direct():
    key = os.urandom(32)
    nonce = os.urandom(12)
    ct = AESGCM(key).encrypt(nonce, PLAINTEXT, AAD)

    assert AESGCM(key).decrypt(nonce, ct, AAD) == PLAINTEXT

    tampered = ct[:-1] + bytes([ct[-1] ^ 1])
    with pytest.raises(InvalidTag):
        AESGCM(key).decrypt(nonce, tampered, AAD)
    with pytest.raises(InvalidTag):
        AESGCM(os.urandom(32)).decrypt(nonce, ct, AAD)
    with pytest.raises(InvalidTag):
        AESGCM(key).decrypt(os.urandom(12), ct, AAD)
    with pytest.raises(InvalidTag):
        AESGCM(key).decrypt(nonce, ct, b"wrong-aad")


def test_run_aead_checks_all_passed_and_no_secret_fields():
    report = models.new_report("0000")
    group = report["groups"]["aes_gcm"]
    aead_checks.run_aead_checks(group)
    assert group["status"] == "passed"
    expected = {
        "roundtrip",
        "tampered_ciphertext_rejected",
        "wrong_key_rejected",
        "wrong_nonce_rejected",
        "wrong_aad_rejected",
    }
    assert set(group["checks"]) == expected
    for check in group["checks"].values():
        assert check["status"] == "passed"
    assert models.find_forbidden_keys(group) == []
