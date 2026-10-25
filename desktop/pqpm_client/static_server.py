"""只服務前端 build（dist/）的 127.0.0.1 靜態檔 HTTP server。

範圍限制（Stage 1）：
- 只綁定 127.0.0.1 loopback、臨時 port，不對外網卡開放。
- 只允許 GET／HEAD；沒有任何 API route，也不是本機 crypto REST API。
- 只服務 ``dist/`` 目錄內的檔案；路徑逃逸（..）直接 403。
- 無副檔名的路徑（SPA route，如 /dev/crypto）回 index.html，
  讓 BrowserRouter 的直接開啟／重新整理能運作；
  有副檔名但找不到的檔案回 404（方便發現 assets 問題）。
- 不提供目錄列表。
"""
from __future__ import annotations

import http.server
import os
import socketserver
import threading
import urllib.parse
from functools import partial


class _DistRequestHandler(http.server.SimpleHTTPRequestHandler):
    """dist/ 專用 handler；由 DistServer 以 partial(root=...) 建構。"""

    def __init__(self, *args, root: str, **kwargs) -> None:
        self.root_dir = os.path.realpath(root)
        super().__init__(*args, **kwargs)

    def _is_suspicious_path(self) -> bool:
        """原始路徑含 ..／反斜線／編碼點段——直接視為逃逸嘗試（403）。"""
        raw = self.path.split("?")[0]
        unquoted = urllib.parse.unquote(raw)
        return ".." in unquoted.lower() or "\\" in unquoted or "%2e" in raw.lower()

    def _safe_translate(self, path: str) -> str | None:
        candidate = super().translate_path(path)
        candidate_real = os.path.realpath(candidate)
        if candidate_real != self.root_dir and not candidate_real.startswith(
            self.root_dir + os.sep
        ):
            return None  # 路徑逃逸出 dist/：拒絕
        return candidate

    def _resolve_target(self) -> str | None:
        """回傳要服務的檔案路徑；SPA route 回 index.html；不合法回 None。"""
        target = self._safe_translate(self.path)
        if target is None:
            return None
        if os.path.isdir(target):
            return os.path.join(self.root_dir, "index.html")
        if os.path.isfile(target):
            return target
        has_extension = bool(os.path.splitext(self.path.split("?")[0])[1])
        if has_extension:
            return target  # 保持 404：缺檔的 asset 不該退回 index.html
        return os.path.join(self.root_dir, "index.html")  # SPA fallback

    def do_GET(self) -> None:  # noqa: N802 — http.server 命名
        if self._is_suspicious_path():
            # send_error 的說明文字需為 ASCII（HTTP 標頭以 latin-1 編碼）
            self.send_error(403, "Forbidden - path traversal rejected")
            return
        target = self._resolve_target()
        if target is None:
            self.send_error(403, "Forbidden - dist static files only")
            return
        self._serve_file(target)

    def do_HEAD(self) -> None:  # noqa: N802
        if self._is_suspicious_path():
            self.send_error(403, "Forbidden - path traversal rejected")
            return
        target = self._resolve_target()
        if target is None:
            self.send_error(403, "Forbidden - dist static files only")
            return
        self._serve_file(target, head_only=True)

    def _serve_file(self, filepath: str, head_only: bool = False) -> None:
        try:
            with open(filepath, "rb") as handle:
                stat = os.fstat(handle.fileno())
                content_type = self.guess_type(filepath)
                self.send_response(200)
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Length", str(stat.st_size))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                if not head_only:
                    self.wfile.write(handle.read())
        except OSError:
            self.send_error(404, "File not found")


class DistServer:
    """包裝 threading HTTP server；start() 回傳實際綁定的 (host, port)。"""

    def __init__(self, root: str) -> None:
        self.root = os.path.realpath(root)
        self._httpd: socketserver.TCPServer | None = None
        self._thread: threading.Thread | None = None

    def start(self) -> tuple[str, int]:
        handler = partial(_DistRequestHandler, root=self.root, directory=self.root)
        self._httpd = socketserver.ThreadingTCPServer(("127.0.0.1", 0), handler)
        self._httpd.daemon_threads = True
        host, port = self._httpd.server_address[:2]
        self._thread = threading.Thread(
            target=self._httpd.serve_forever, name="pqpm-dist-server", daemon=True
        )
        self._thread.start()
        return str(host), int(port)

    def stop(self) -> None:
        if self._httpd is not None:
            self._httpd.shutdown()
            self._httpd.server_close()
            self._httpd = None
        if self._thread is not None:
            self._thread.join(timeout=5)
            self._thread = None
