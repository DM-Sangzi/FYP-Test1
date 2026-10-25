"""busy lock：Python 端防平行測試（不能只靠 UI 防並行）。"""
import pytest

from pqpm_client.feasibility.runner import BusyError, FeasibilityService


def test_second_call_while_locked_raises_busy():
    service = FeasibilityService()
    service._lock.acquire()  # 模擬已有一個 suite 執行中
    try:
        with pytest.raises(BusyError):
            service.run_checks()
    finally:
        service._lock.release()
    # 釋放後可正常執行
    report = service.run_checks()
    assert report["run_id"]


def test_health_check_always_returns_non_secret_fields():
    service = FeasibilityService()
    health = service.health_check()
    expected = {
        "bridge_version",
        "mode",
        "python_version",
        "platform_summary",
        "cryptography_version",
        "liboqs_python_version",
        "native_liboqs_available",
        "native_liboqs_note",
        "enabled_kem_identifiers",
        "enabled_sig_identifiers",
    }
    assert expected == set(health)
    assert health["mode"] == "diagnostics"
    assert isinstance(health["native_liboqs_available"], bool)
    from pqpm_client.feasibility import models

    assert models.find_forbidden_keys(health) == []
