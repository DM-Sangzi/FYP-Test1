# 開發環境設置（第 1 階段，實際驗證於 2026-10-26）

本文件只包含**實際執行過**的命令與**實際查到**的版本；沒有杜撰的版本號。

## 1. 前置需求（實際環境）

| 項目 | 實際版本 | 備註 |
|---|---|---|
| OS | Windows 11（build 26300，AMD64） | |
| Node.js | v22.21.0 | |
| npm | 10.9.4 | lockfileVersion 3 |
| Python（venv 用） | 3.12.1（`py -3.12`） | 不改系統預設（3.14） |
| WebView2 Runtime | 155.0.4283.62 | pywebview 需要；已內建 |
| git | 2.45.1.windows.1 | |

**native liboqs：未配置（B 模式）**。ML-KEM／ML-DSA 檢查因此如實顯示
「受阻」。安裝方案（選項 A）見 `implementation-status.md`，需另行批准。

## 2. 安裝步驟（專案根目錄，PowerShell）

```powershell
npm ci                      # 還原前端依賴（lockfile）
npm run build               # tsc -b && vite build（desktop 需要本地 dist/）
py -3.12 -m venv .venv      # 專案 venv（不動系統 Python）
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
```

實際安裝結果（PyPI wheel，無任何 native 編譯）：

| 套件 | 版本 |
|---|---|
| cryptography | 50.0.2 |
| liboqs-python | 0.16.0.1 |
| pywebview | 6.2.1 |
| pythonnet | 3.2.1 |
| pytest | 9.1.1 |
| pqpm-client（本專案） | 0.1.0（editable） |

> ⚠ liboqs-python 0.16.x 的 `import oqs` 內建自動下載／編譯安裝器。
> 我們的程式碼已雙層封鎖（見 `architecture.md` §4），任何情況下都不會
> 自動下載或編譯；native 未配置時直接回報 blocked。

## 3. CLI 測試

```powershell
.\.venv\Scripts\python.exe -m pqpm_client --check-tools   # 本機密碼工具檢查（不啟動 GUI）
.\.venv\Scripts\python.exe -m pytest -q                   # 單元／邊界測試
```

- `--check-tools` 不會 import pywebview／GUI（有測試保證）。
- exit code：全部通過＝0；有失敗＝1；有受阻＝2（B 模式預期 exit 2）。

## 4. Desktop 診斷視窗

```powershell
npm run build                                            # 需先有 dist/
.\.venv\Scripts\python.exe -m pqpm_client --diagnostics
```

- 只在此模式暴露 bridge（`health_check`、`run_feasibility_checks`）。
- 視窗自動開在 `http://127.0.0.1:<臨時port>/dev/crypto?diagnostics=1`。
- 關閉視窗即結束；靜態伺服器隨後關閉。

## 5. 一般瀏覽器模式（mock 回歸）

```powershell
npm run dev    # http://localhost:5173
```

- 原有 Register→Login→Chat mock 流程不受影響。
- 開 `/dev/crypto?diagnostics=1` 會顯示「bridge 不可用」並停用測試按鈕。

## 6. 選項 A（native liboqs）實施時的配置方式（待批准，現階段勿執行）

1. 以 VS Build Tools + CMake 從官方 liboqs release 原始碼編譯 `oqs.dll`。
2. 放置於專案 `desktop/native/bin/oqs.dll`。
3. 啟動前設定環境變數 `OQS_INSTALL_PATH=<專案>\desktop\native`
   （liboqs-python 的偵測邏輯會找 `<OQS_INSTALL_PATH>\bin\oqs.dll`）。
4. 重跑 `--check-tools`：ML-KEM-768／ML-DSA-65 應變為實際執行（passed/failed）。

## 7. 常見問題

- **`--diagnostics` 顯示找不到 dist/index.html**：先 `npm run build`。
- **ML-KEM／ML-DSA 顯示受阻**：這是 B 模式的正確行為（native liboqs
  未配置），不是錯誤；不要嘗試讓 `import oqs`「自動修好」。
- **pytest 出現 GUI 相關錯誤**：測試不應啟動 GUI；若發生請回報，
  不要略過（不得以 skip 代替成功）。
