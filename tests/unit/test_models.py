"""models.py schema 基本測試。"""
import pytest

from pqpm_client.feasibility import models


def test_new_report_structure():
    report = models.new_report("deadbeef")
    assert report["schema_version"] == models.SCHEMA_VERSION
    assert report["run_id"] == "deadbeef"
    assert report["source"] == "local_python"
    assert report["overall"] == "not_run"
    # 固定聲明：E2EE session 尚未實作
    assert report["e2ee_session"] == "尚未實作"
    assert set(report["groups"]) == {"ml_kem", "ml_dsa", "hkdf", "aes_gcm"}
    for group in report["groups"].values():
        assert group["status"] == "not_run"
        for check in group["checks"].values():
            assert check["status"] == "not_run"
            assert check["note"] is None


def test_pqc_groups_have_separate_fingerprint_fields():
    report = models.new_report("aabbccdd")
    ml_kem = report["groups"]["ml_kem"]
    ml_dsa = report["groups"]["ml_dsa"]
    # ML-KEM 與 ML-DSA 是不同金鑰，各自獨立的指紋欄位
    assert ml_kem["public_key_fingerprint_sha256"] is None
    assert ml_dsa["public_key_fingerprint_sha256"] is None
    assert ml_kem is not ml_dsa


def test_new_check_rejects_invalid_status():
    with pytest.raises(ValueError):
        models.new_check("all_good")


def test_find_forbidden_keys_detects_planted_secret():
    dirty = {"report": {"groups": {"hkdf": {"shared_secret": "x"}}}}
    problems = models.find_forbidden_keys(dirty)
    assert any("shared_secret" in p for p in problems)


def test_find_forbidden_keys_passes_clean_report():
    report = models.new_report("00112233")
    assert models.find_forbidden_keys(report) == []
