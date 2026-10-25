# 可行性測試結果（第 1 階段，2026-10-26）

本文件只記錄**實際執行**的命令與**實際觀察**的輸出；沒有預填的 PASS、
沒有杜撰的時間。所有金鑰均為該次執行的短暫測試金鑰（非正式身分金鑰），
畫面與 terminal 均無私鑰／shared secret／derived key。

## 0. 最終狀態：選項 A 已實施，全部通過

2026-10-26 完成 native liboqs 編譯安裝後（過程見
`development-setup.md` §6），ML-KEM-768 與 ML-DSA-65 轉為**真實執行並通過**：
`--check-tools` 整體「通過」、exit 0；pytest 28/28；GUI（真實 pywebview
視窗）顯示 16 項全部通過、兩次執行指紋改變。逐項數據見下方 §5a。
以下 §1–§6 保留 B 模式時期的原始記錄（作為歷程證據）。

## 1. 環境（health_check 實測值）

```
Python 3.12.1；Windows 11 (AMD64)（build 26300）
cryptography 50.0.2；liboqs-python 0.16.0.1
native liboqs：不可用 — oqs.dll 未配置（檔案預檢即回報，未觸發 import／自動下載／編譯）
pywebview 6.2.1＋pythonnet 3.2.1；WebView2 Runtime 155.0.4283.62
Node v22.21.0／npm 10.9.4
```

## 2. 前端 build（實際記錄）

| 階段 | 命令 | 結果 |
|---|---|---|
| 基線（動工前） | `npm ci`＋`npm run build` | ✅ 成功（tsc -b＋vite，1841 modules，無錯誤） |
| 完成後（含診斷頁） | `npm run build` | ✅ 成功（1844 modules，+3；無新增錯誤） |

## 3. pytest（實際執行：`.venv\Scripts\python.exe -m pytest -q`）

```
28 passed in 4.58s   ← 最終回合（修正 3 個初期失敗後）
```

涵蓋：HKDF／AES-GCM 真實密碼語意、schema 無秘密欄位、busy lock、
bridge allowlist、CLI exit code（B 模式＝2）、靜態伺服 403/404/SPA、
native 偵測零子程序零 import 回歸。無 skip 項目冒充成功。

## 4. GUI 實測紀錄（Windows 上真實開啟＋真實 bridge 呼叫）

以等同 `--diagnostics` 的啟動方式（同 DistServer、同 DiagnosticsBridge、
同 URL 形式）開啟 pywebview 視窗，於視窗內實際執行：

| 觀察 | 實測值 |
|---|---|
| 視窗 URL | `http://127.0.0.1:<臨時port>/dev/crypto?diagnostics=1`（停留不變） |
| bridge 注入 | `window.pywebview.api` 存在；方法＝`health_check,run_feasibility_checks` |
| 「檢查環境」卡 | bridge v1／Python 3.12.1／cryptography 50.0.2／liboqs-python 0.16.0.1／native 不可用 |
| 第一次執行 | run ID `6b9d96a8`；整體＝受阻 |
| 第二次執行 | run ID `7c539932`（新 run；與第一次不同） |
| localStorage | 全程僅 `["pqpm_theme"]`（既有 key；診斷頁零寫入） |

> 自動化備註：初期以 UI 自動化工具綁定視窗時誤綁到另一個 Edge 視窗
> （顯示本 app 的 /login 畫面），曾造成誤導；改以視窗內 JavaScript
> 讀回（上述數據）後確認真實視窗行為正確。此為自動化工具綁定問題，
> 非 app 缺陷；使用者手動驗收步驟見 stage1-manual-test.md。

## 5. 逐項結果（CLI `--check-tools` 實際輸出，run ID e4a850b7，exit code 2）

| 分組 | 檢查項 | 結果 |
|---|---|---|
| ML-KEM-768 | 金鑰生成 | ⛔ 受阻（native 未配置） |
| | Shared-secret equality | ⛔ 受阻（未執行） |
| | Ciphertext 長度 | ⛔ 受阻（未執行） |
| | 錯誤長度 ciphertext 拒絕 | ⛔ 受阻（未執行） |
| | 公鑰長度／指紋 | —（無資料，如實顯示「—（未執行或受阻）」） |
| ML-DSA-65（測試選擇，非最終參數） | 金鑰生成 | ⛔ 受阻 |
| | 正確簽章驗證 | ⛔ 受阻 |
| | 修改訊息後拒絕 | ⛔ 受阻 |
| | 錯誤公鑰拒絕 | ⛔ 受阻 |
| | Signature 長度 | ⛔ 受阻 |
| HKDF-SHA-256 | 相同輸入（新 instance）派生一致 | ✅ **通過**（真實執行） |
| | 不同 context 派生不同結果 | ✅ **通過**（真實執行） |
| AES-256-GCM | 正常加解密還原（byte-for-byte） | ✅ **通過** |
| | 修改密文／tag 拒絕 | ✅ **通過** |
| | 錯誤 key 拒絕 | ✅ **通過** |
| | 錯誤 nonce 拒絕 | ✅ **通過** |
| | 錯誤 AAD 拒絕 | ✅ **通過** |
| **整體** | | ⛔ **受阻**（不得顯示全部通過） |
| E2EE session | | **尚未實作** |

## 5a. 選項 A 之後的逐項結果（真實 PQC，2026-10-26）

CLI 實際輸出（`--check-tools`，run ID 6091b33f，**exit code 0**）：

| 分組 | 檢查項 | 結果 |
|---|---|---|
| ML-KEM-768（native 0.16.0） | 金鑰生成 | ✅ 通過 |
| | Shared-secret equality（封裝／解封裝一致） | ✅ **通過**（真實 KEM 測試） |
| | Ciphertext 長度 | ✅ 1088 bytes（＝標準長度） |
| | 錯誤長度 ciphertext 拒絕 | ✅ 應用層長度驗證拒絕＊ |
| | 公鑰長度／指紋 | 1184 bytes／完整 SHA-256 指紋顯示 |
| ML-DSA-65（測試選擇，非最終參數） | 金鑰生成／正確簽章驗證 | ✅ 通過 |
| | 修改訊息後拒絕／錯誤公鑰拒絕 | ✅ 通過（真實負面測試） |
| | Signature 長度 | ✅ 3309 bytes（＝標準長度） |
| | 公鑰長度／指紋 | 1952 bytes／完整 SHA-256 指紋顯示 |
| HKDF-SHA-256／AES-256-GCM | 同 §5 | ✅ 維持通過 |
| **整體** | | ✅ **通過**（exit 0） |

＊實測 liboqs-python 0.16 不會對錯誤長度丟例外（直接傳入 native 有越界
讀取風險），故依 Stage 1 文件 §6.1 以**安全應用層長度驗證**（比對
`details.length_ciphertext`／`length_signature`）作為拒絕機制，wrapper
行為如實記錄於說明欄。

**指紋改變驗證**（多次執行實測）：ML-KEM 指紋 `803b5720…`→`819a0b7d…`、
ML-DSA `b32d802c…`→`e6ee1644…`；GUI 內兩次執行亦然
（`fa919bda…`→`4eddfaa9…`、`391d3efb…`→`e593e642…`）。
run ID 亦每次不同（8ac7c099→6091b33f→51516422）。此為正常隨機生成下的
預期行為，**不作隨機性安全證明**。

**GUI（真實 pywebview 視窗＋真實 bridge）**：整體「通過」、16 項全過、
指紋完整顯示、localStorage 全程僅 `["pqpm_theme"]`、E2EE session 固定
「尚未實作」。native liboqs 版本：0.16.0（`oqs.oqs_version()`）。

**pytest**：`28 passed`（含 native 路徑下的調適型斷言）。

## 6. 備註與限制（如實聲明）

- HKDF／AES-GCM 為**獨立元件測試**，非正式協定 key schedule／record layer。
- AES-GCM「每次加密新 nonce；GCM tag 不防重放」如實標示於結果說明。
- ~~B 模式下 ML-KEM／ML-DSA 公鑰指紋為 null~~ → 選項 A 後已完成「重新執行
  後指紋改變」驗證（見 §5a）。
- ML-DSA-65 是第 1 階段測試選擇，未經 supervisor 核定為最終參數。
- 測試金鑰每次執行後以 context manager 釋放；不保證 native runtime
  完整記憶體抹除，不宣稱「已安全擦除所有私鑰」。
