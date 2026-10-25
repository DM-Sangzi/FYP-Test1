"""CLI（python -m pqpm_client --check-tools）行為測試。"""
import re
import subprocess
import sys

from pqpm_client.feasibility.kem_checks import detect_liboqs


def _run(args, **kwargs):
    return subprocess.run(
        [sys.executable, *args], capture_output=True, text=True, **kwargs
    )


def test_check_tools_runs_without_gui():
    """--check-tools 不得 import pywebview／GUI 才能執行。"""
    result = _run(
        [
            "-c",
            "import sys\n"
            "from pqpm_client.__main__ import main\n"
            "main(['--check-tools'])\n"
            "sys.exit(0 if 'pywebview' not in sys.modules else 1)\n",
        ]
    )
    assert result.returncode == 0, result.stderr


def test_check_tools_output_and_exit_code():
    result = _run(["-m", "pqpm_client", "--check-tools"])
    stdout = result.stdout
    assert "PQPM" in stdout
    assert "E2EE session：尚未實作" in stdout
    assert "ML-KEM" in stdout and "ML-DSA" in stdout
    assert "HKDF" in stdout and "AES-256-GCM" in stdout
    # run ID（8 hex）
    assert re.search(r"run ID）：[0-9a-f]{8}", stdout)

    detection = detect_liboqs()
    if not detection["available"]:
        # B 模式：PQC 受阻 → exit code 必須非零（不得全部 skip 仍 exit 0）
        assert "受阻" in stdout
        assert result.returncode != 0
        assert result.returncode == 2
    else:
        # native 可用時：全部通過 exit 0；失敗 exit 1
        assert result.returncode in (0, 1)


def test_no_args_shows_help():
    result = _run(["-m", "pqpm_client"])
    assert result.returncode == 2
    assert "--check-tools" in result.stdout
    assert "--diagnostics" in result.stdout
