"""bridge allowlist：只暴露明確方法，且 busy 路徑正確。"""
from pqpm_client.bridge import DiagnosticsBridge
from pqpm_client.feasibility.runner import BusyError, FeasibilityService


def test_bridge_public_surface_is_allowlist_only():
    bridge = DiagnosticsBridge(FeasibilityService())
    public = {
        name
        for name in dir(bridge)
        if not name.startswith("_") and callable(getattr(bridge, name))
    }
    # pywebview 會把實例的 public callable 全部暴露給 JS；
    # 因此 allowlist 必須嚴格等於這兩個方法
    assert public == {"health_check", "run_feasibility_checks"}
    assert set(DiagnosticsBridge.METHOD_ALLOWLIST) == public


def test_bridge_exposes_no_dangerous_helpers():
    bridge = DiagnosticsBridge(FeasibilityService())
    public = {
        name for name in dir(bridge) if not name.startswith("_")
    }
    for banned in ("eval", "exec", "system", "popen", "run", "shell",
                   "read_file", "write_file", "import", "load"):
        assert banned not in public


def test_bridge_busy_response_when_service_locked():
    service = FeasibilityService()
    bridge = DiagnosticsBridge(service)
    service._lock.acquire()
    try:
        result = bridge.run_feasibility_checks()
        assert result == {"busy": True, "detail": "已有一個測試 suite 執行中"}
    finally:
        service._lock.release()


def test_bridge_error_response_is_category_only():
    class _Exploding:
        def run_checks(self):
            raise RuntimeError("不應外洩的細節：sekrit-value")

        def health_check(self):
            raise RuntimeError("boom")

    bridge = DiagnosticsBridge(_Exploding())  # type: ignore[arg-type]
    result = bridge.run_feasibility_checks()
    assert result["failed"] is True
    # 只回傳例外類別，不包含訊息（避免敏感細節跨 bridge）
    assert "detail" in result and result["detail"] == "RuntimeError"
    assert "sekrit" not in repr(result)
