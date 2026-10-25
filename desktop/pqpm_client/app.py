"""desktop 啟動（僅 --diagnostics 模式）。

- ``--diagnostics`` 才會建立 pywebview 視窗與受限 bridge；
  一般情況下不暴露任何測試 bridge。
- 視窗載入固定的本機 URL（127.0.0.1 靜態 server 只服務 dist/），
  不載入任何遠端內容；診斷頁本身也不含外部連結。
  pywebview 目前沒有硬性「禁止導覽」API——此限制如實記錄於
  docs/architecture.md，而非假裝已有硬性防護。
- ``?diagnostics=1`` 僅是前端 UI 模式標記，不是授權機制。
"""
from __future__ import annotations

import sys
from pathlib import Path

#: 專案根目錄 = desktop/pqpm_client/app.py 往上三層
PROJECT_ROOT = Path(__file__).resolve().parents[2]
DIST_ROOT = PROJECT_ROOT / "dist"


def run_diagnostics() -> int:
    """啟動診斷視窗（blocking）；回傳 process exit code。"""
    index_html = DIST_ROOT / "index.html"
    if not index_html.is_file():
        print(
            "找不到 dist/index.html——請先在專案根目錄執行 npm run build。",
            file=sys.stderr,
        )
        return 2

    from pqpm_client.bridge import DiagnosticsBridge
    from pqpm_client.feasibility.runner import FeasibilityService
    from pqpm_client.static_server import DistServer

    server = DistServer(str(DIST_ROOT))
    host, port = server.start()
    url = f"http://{host}:{port}/dev/crypto?diagnostics=1"

    import webview  # 只有 --diagnostics 模式才 import（--check-tools 不會）

    bridge = DiagnosticsBridge(FeasibilityService())
    webview.create_window(
        title="PQPM — 第 1 階段：密碼工具測試（診斷模式）",
        url=url,
        js_api=bridge,
        width=1100,
        height=860,
        min_size=(900, 700),
    )
    try:
        webview.start()
    finally:
        server.stop()
    return 0
