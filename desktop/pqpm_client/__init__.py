"""PQPM 第 1 階段本機 client core。

範圍聲明：本套件只提供「密碼工具可行性測試」的 shared service 與
--diagnostics 模式的受限 desktop bridge。它不是 E2EE 聊天 client，
不實作 session handshake、帳號身分金鑰、relay 或任何持久化。

native liboqs 設定（選項 A）：若專案內存在 ``desktop/native/``（內含
CMake 安裝的 ``bin/oqs.dll``）且使用者未自行設定 ``OQS_INSTALL_PATH``，
套件會自動把該路徑設為預設值，讓 liboqs-python 的載入器與
kem_checks.detect_liboqs() 的檔案預檢都指向同一位置。
此設定不會安裝、下載或編譯任何東西；路徑不存在時完全沒有作用。
"""
from __future__ import annotations

import os
from pathlib import Path

#: 專案根目錄 = desktop/pqpm_client/__init__.py 往上兩層
_PROJECT_ROOT = Path(__file__).resolve().parents[2]
#: 選項 A 的 native liboqs 安裝位置（CMAKE_INSTALL_PREFIX 目標）
_DEFAULT_NATIVE_DIR = _PROJECT_ROOT / "desktop" / "native"

if _DEFAULT_NATIVE_DIR.is_dir() and "OQS_INSTALL_PATH" not in os.environ:
    os.environ["OQS_INSTALL_PATH"] = str(_DEFAULT_NATIVE_DIR)
