"""python -m pqpm_client 入口。

- ``--check-tools``：只執行本機密碼工具檢查並輸出非秘密摘要；
  不會 import pywebview 或任何 GUI 模組。必要檢查失敗或受阻時
  exit code 非零（failed=1、blocked/partial=2），不會以 skip
  代替成功。
- ``--diagnostics``：啟動 desktop 診斷視窗（受限 bridge 只在此模式暴露）。
"""
from __future__ import annotations

import argparse
import sys


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="pqpm_client",
        description=(
            "PQPM 第 1 階段本機 client core（僅密碼工具可行性測試；"
            "不是 E2EE 聊天 client）"
        ),
    )
    group = parser.add_mutually_exclusive_group()
    group.add_argument(
        "--check-tools",
        action="store_true",
        help="執行本機密碼工具檢查（CLI，非秘密摘要；不啟動 GUI）",
    )
    group.add_argument(
        "--diagnostics",
        action="store_true",
        help="啟動 desktop 診斷視窗（暴露受限測試 bridge）",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.check_tools:
        from pqpm_client.feasibility.runner import (
            BusyError,
            FeasibilityService,
            format_cli_summary,
        )

        service = FeasibilityService()
        try:
            report = service.run_checks()
        except BusyError:
            print("已有測試 suite 執行中（busy），請稍後再試。", file=sys.stderr)
            return 2
        print(format_cli_summary(report))
        return {"passed": 0, "failed": 1}.get(report["overall"], 2)

    if args.diagnostics:
        from pqpm_client.app import run_diagnostics  # lazy import：只有此分支載入 GUI

        return run_diagnostics()

    parser.print_help()
    return 2


if __name__ == "__main__":
    sys.exit(main())
