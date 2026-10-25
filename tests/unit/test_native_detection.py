"""native liboqs 偵測防護回歸測試。

liboqs-python 0.16.x 的 import oqs 內建自動安裝器（git clone + cmake）。
本測試保證：native 未配置時，detect_liboqs() 完全不會觸發 import oqs、
不會執行任何子程序（在乾淨子程序中把 subprocess 全面設為必炸來驗證）。
"""
import subprocess
import sys
import textwrap

_CHILD = textwrap.dedent(
    """
    import subprocess, sys

    def _blocked(*args, **kwargs):
        raise AssertionError("不應執行任何子程序（自動下載／編譯被封鎖）")

    subprocess.run = _blocked
    subprocess.Popen = _blocked
    subprocess.check_call = _blocked
    subprocess.check_output = _blocked

    from pqpm_client.feasibility.kem_checks import detect_liboqs
    result = detect_liboqs()
    print("available:", result["available"])
    if not result["available"]:
        # 未配置時：連 import 都不應發生（oqs 不在 sys.modules）
        assert "oqs" not in sys.modules, "native 未配置時不應 import oqs"
        print("not_imported: True")
    print("OK")
    """
)


def test_detect_never_imports_or_spawns_when_native_missing():
    result = subprocess.run(
        [sys.executable, "-c", _CHILD], capture_output=True, text=True, timeout=60
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert "OK" in result.stdout
    if "available: False" in result.stdout:
        assert "not_imported: True" in result.stdout


def test_detect_reason_is_safe_text():
    from pqpm_client.feasibility.kem_checks import detect_liboqs

    result = detect_liboqs()
    assert isinstance(result["reason"], str)
    assert "pqpm" not in result["reason"] or "封鎖" in result["reason"]
