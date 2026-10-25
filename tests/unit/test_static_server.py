"""static server：服務範圍、SPA fallback、路徑逃逸防護。"""
import http.client
import urllib.error
import urllib.request
from pathlib import Path

import pytest

from pqpm_client.static_server import DistServer

INDEX_HTML = "<!doctype html><html><body>index</body></html>"


@pytest.fixture()
def dist_server(tmp_path):
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text(INDEX_HTML, encoding="utf-8")
    (dist / "assets" / "app.js").write_text("console.log('ok');", encoding="utf-8")
    # 伺服器根目錄之外的秘密檔（路徑逃逸不應拿到）
    (tmp_path / "outside-secret.txt").write_text("should-not-leak", encoding="utf-8")

    server = DistServer(str(dist))
    host, port = server.start()
    yield host, port, str(tmp_path)
    server.stop()


def _get(host, port, path):
    return urllib.request.urlopen(f"http://{host}:{port}{path}", timeout=5)


def _raw_get(host, port, path):
    """绕过 urllib 的路徑正規化，送出原始請求行。"""
    conn = http.client.HTTPConnection(host, port, timeout=5)
    conn.request("GET", path)
    response = conn.getresponse()
    body = response.read().decode("utf-8", "replace")
    conn.close()
    return response.status, body


def test_index_and_assets_served(dist_server):
    host, port, _ = dist_server
    with _get(host, port, "/") as response:
        assert response.status == 200
        assert response.headers["Content-Type"].startswith("text/html")
        assert response.read().decode("utf-8") == INDEX_HTML
    with _get(host, port, "/assets/app.js") as response:
        assert response.status == 200
        assert "javascript" in response.headers["Content-Type"]


def test_spa_route_direct_open_and_refresh(dist_server):
    """直接開啟／重新整理 /dev/crypto 都拿到 index.html（BrowserRouter 用）。"""
    host, port, _ = dist_server
    for path in ("/dev/crypto", "/dev/crypto?diagnostics=1"):
        with _get(host, port, path) as response:
            assert response.status == 200
            assert response.read().decode("utf-8") == INDEX_HTML


def test_missing_asset_returns_404_not_index(dist_server):
    host, port, _ = dist_server
    try:
        _get(host, port, "/assets/missing.js")
        raised = False
    except urllib.error.HTTPError as error:
        raised = error.code == 404
    assert raised


def test_path_traversal_forbidden(dist_server):
    host, port, tmp = dist_server
    assert (Path(tmp) / "outside-secret.txt").is_file()
    for raw_path in ("/../outside-secret.txt", "/..%5Coutside-secret.txt"):
        status, body = _raw_get(host, port, raw_path)
        assert status == 403, raw_path
        assert "should-not-leak" not in body


def test_post_not_allowed(dist_server):
    host, port, _ = dist_server
    conn = http.client.HTTPConnection(host, port, timeout=5)
    conn.request("POST", "/", body="x")
    response = conn.getresponse()
    assert response.status in (405, 501)
    conn.close()
