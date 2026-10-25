# 第 1 階段完整文件（密碼工具可行性 PoC）

> **狀態聲明（2026-10-26 選項 A 實施後）：第 1 階段全部完成。**
> ML-KEM-768／ML-DSA-65（native liboqs 0.16.0）、HKDF-SHA-256、
> AES-256-GCM 皆真實執行並通過；desktop GUI 於 Windows 實際驗證。
> **此完成僅代表密碼工具可行性 PoC——E2EE 聊天 session 尚未實作。**
>
> 本文件由原本五份文件（architecture／development-setup／
> feasibility-results／implementation-status／stage1-manual-test）合併而成，
> 原檔保存於 git 歷史（`9fd97e5`、`c76d5a3`）。

## 目錄

1. [架構說明](#1-架構說明)
2. [開發環境設置](#2-開發環境設置)
3. [可行性測試結果](#3-可行性測試結果)
4. [實作狀態](#4-實作狀態)
5. [手動驗收清單](#5-手動驗收清單)

---

## 1. 架構說明

### 1.1 未來完整架構（藍圖，本階段不建立）

```text
Alice 裝置
┌─────────────────────────────────────────┐
│ Desktop application                     │
│ React UI                                │
│    ↕ 受限制的本機 JavaScript–Python bridge │
│ Python client core                      │
│ 金鑰／身分驗證／session／加解密／本地歷史  │
└────────────────────┬────────────────────┘
                     │ HTTPS / TLS
                     ▼
┌─────────────────────────────────────────┐
│ Remote relay                            │
│ 帳戶、公開金鑰、握手 envelope、訊息密文    │
│ SQLite、授權、密文轉送及到期清理           │
│ 不持有 client 私鑰或 E2EE session secrets │
└────────────────────┬────────────────────┘
                     │ HTTPS / TLS
                     ▼
Bob 裝置：React UI ↔ 本機 Python client core
```

依依據 proposal（Proposal_LeeYingHo_25134228d.docx）與 supervisor 意見：
client–relay TLS 保留為傳輸層，應用層採 E2EE；relay 不持有 plaintext 或
私鑰；ML-KEM-768 為暫定 KEM 候選、ML-DSA 用於 session 資料認證；
session 規格需先通過 supervisor 設計審查（第 2 階段）才算正式整合。

**第 1 階段沒有**：relay、TLS 服務、SQLite、帳號系統、session handshake、
正式身分金鑰、WebSocket、檔案分享、群聊、ratchet。

### 1.2 第 1 階段實際架構（已實作並驗證）

```text
前端「/dev/crypto 開發診斷頁」（React）
         ↓ 使用者按測試按鈕
pywebview js_api bridge（僅 --diagnostics 模式建立）
  allowlist：health_check、run_feasibility_checks
         ↓
本機 FeasibilityService（UI／CLI 共用同一實作）
  threading.Lock 防 parallel（busy 回覆）
         ↓
kdf_checks（HKDF-SHA-256）與 aead_checks（AES-256-GCM）
  → 經 cryptography 真實執行
kem_checks（ML-KEM-768）與 signature_checks（ML-DSA-65）
  → native liboqs（desktop/native，0.16.0）真實執行；
    未配置時檔案預檢即回報 blocked（不觸發 import）
         ↓
只回傳非秘密 schema（run ID、狀態、長度、公鑰 SHA-256 指紋）
         ↓
React 顯示結果；私鑰／shared secret／derived key 不進入 JavaScript
```

### 1.3 檔案對應

| 元件 | 檔案 |
|---|---|
| 共用測試服務 | `desktop/pqpm_client/feasibility/runner.py` |
| 非秘密 schema | `desktop/pqpm_client/feasibility/models.py` |
| ML-KEM 檢查＋native 偵測防護 | `desktop/pqpm_client/feasibility/kem_checks.py` |
| ML-DSA 檢查 | `desktop/pqpm_client/feasibility/signature_checks.py` |
| HKDF 檢查 | `desktop/pqpm_client/feasibility/kdf_checks.py` |
| AES-256-GCM 檢查 | `desktop/pqpm_client/feasibility/aead_checks.py` |
| bridge allowlist | `desktop/pqpm_client/bridge.py` |
| loopback 靜態伺服 | `desktop/pqpm_client/static_server.py` |
| desktop 啟動 | `desktop/pqpm_client/app.py`、`__main__.py` |
| native liboqs（自行編譯，gitignore） | `desktop/native/bin/oqs.dll` |
| 前端 bridge adapter | `src/bridge/desktop.ts` |
| 診斷頁 | `src/pages/CryptoDiagnostics.tsx`（route `/dev/crypto`） |
| 診斷結果型別 | `src/types/crypto.ts` |

### 1.4 信任邊界與安全設計

**bridge 閘門（誰能呼叫我們）**

- bridge **只**在 `python -m pqpm_client --diagnostics` 啟動視窗時建立
  （`app.py`）；不帶旗標就不會有任何 `js_api` 物件。
- `?diagnostics=1` URL 參數**只是前端 UI 模式標記**，不具授權意義：
  一般瀏覽器加上此參數仍沒有 bridge，按鈕停用並顯示「bridge 不可用」。
- 暴露方法採嚴格 allowlist：`health_check`、`run_feasibility_checks`
  （`test_bridge_surface.py` 驗證 public callable 集合完全等於這兩個）。
- 不提供任意 Python、shell、檔案路徑、演算法程式碼或私鑰輸入介面；
  suite 參數固定，減少 bridge 攻擊面。
- bridge 錯誤只回傳例外類別（如 `RuntimeError`），不外洩 traceback。

**本機靜態伺服器（static_server.py）**

- 只綁 `127.0.0.1` loopback、臨時 port；不對外網卡開放。
- 只允許 GET／HEAD；**沒有任何 API route**，不是本機 crypto REST API。
- 只服務 `dist/` 內檔案：原始路徑含 `..`／反斜線／編碼點段 → 403；
  realpath 逃逸 → 403；目錄不下載列表。
- 無副檔名路徑（如 `/dev/crypto`）→ 回 `index.html`（SPA fallback）；
  有副檔名但缺檔 → 404。以上皆有 pytest 覆蓋。

**秘密邊界**

- schema（`models.py`）沒有任何秘密欄位；測試以遞迴掃描欄位名稱
  （`find_forbidden_keys`）驗證。
- 私鑰／shared secret／derived AES key 只存在於 Python 函式區域變數，
  不進入回傳值、不寫 log／檔案／localStorage。
- 每次執行生成新的短暫測試金鑰與 run ID；不綁定帳號、不持久化。
  native 物件以 context manager 釋放；完整記憶體抹除**不作保證**，
  不得宣稱「已安全擦除所有私鑰」。
- 前端診斷頁零 localStorage 寫入（GUI 驗證實測全程只有既有 `pqpm_theme`）。

**已知限制（如實記錄，不假裝有防護）**

- pywebview 6.2.1 沒有硬性「禁止遠端導覽」API。目前緩解：視窗載入固定
  本機 URL、診斷頁不含任何外部連結、靜態伺服只服務 dist。若未來需要
  硬性限制，需評估其他 shell 或 WebView2 設定。
- 實測中 pywebview 6.2.1 的視窗以 Edge（WebView2／InPrivate 標記）承載
  內容；此為 wrapper 行為，功能驗證不受影響。

### 1.5 liboqs-python 自動安裝器事件與防護（重要）

**事件**：`liboqs-python 0.16.0.1` 的 `import oqs` 內建自動安裝器——找不到
native library 時會倒數 5 秒後自動 `git clone` liboqs 原始碼並以 `cmake`
編譯安裝到 `~/_oqs`。實作期間共意外觸發**兩次**（偵測呼叫一次、選項 A
期間的裸 import 除錯一次）：兩次 clone 都有下載到 temp，但均因當時
cmake 不可用而建置失敗中止；`~/_oqs` 從未被建立；兩次 temp clone 都已
刪除並確認無殘留。教訓：任何情況下不要裸 `import oqs`，一律透過
`pqpm_client` 套件。

**現行防護**（`kem_checks.detect_liboqs()`，雙層）：

1. **純檔案預檢**：依 liboqs-python 的搜尋邏輯（`OQS_INSTALL_PATH` 或
   `~/_oqs` 下的 `bin\oqs.dll`／`bin\liboqs.dll`，加 PATH 掃描）先確認
   DLL 是否存在；不存在直接回 `blocked`，**連 `import oqs` 都不執行**。
2. **子程序封鎖**：確有候選 DLL 需要 import 時，暫時以會丟例外的 stub
   取代 `subprocess.run`／`subprocess.Popen`，就算 wrapper 決定自動安裝
   也會被擋下，並在 `finally` 還原。

回歸測試 `test_native_detection.py`：在乾淨子程序中把 subprocess 全部
設為必炸，驗證 native 未配置時 `detect_liboqs()` 不觸發 import、零子程序。

### 1.6 候選工具狀態

- relay：FastAPI（Python）、HTTPS long-polling 候選 —— 第 3+ 階段評估。
- desktop shell：pywebview 6.2.1（已實測可用）。
- native liboqs：**已實施**（VS Build Tools＋CMake 編譯官方 0.16.0，
  見 §2.6）。

---

## 2. 開發環境設置

本節只包含**實際執行過**的命令與**實際查到**的版本；沒有杜撰的版本號。

### 2.1 前置需求（實際環境）

| 項目 | 實際版本 | 備註 |
|---|---|---|
| OS | Windows 11（build 26300，AMD64） | |
| Node.js | v22.21.0 | |
| npm | 10.9.4 | lockfileVersion 3 |
| Python（venv 用） | 3.12.1（`py -3.12`） | 不改系統預設（3.14） |
| WebView2 Runtime | 155.0.4283.62 | pywebview 需要；已內建 |
| git | 2.45.1.windows.1 | |

**native liboqs：已配置（選項 A 已實施，2026-10-26）**。liboqs 0.16.0
安裝於 `desktop/native/bin/oqs.dll`；`pqpm_client` 套件 import 時會自動
把未設定的 `OQS_INSTALL_PATH` 指向該目錄。ML-KEM-768／ML-DSA-65 為
真實執行。

### 2.2 安裝步驟（專案根目錄，PowerShell）

```powershell
npm ci                      # 還原前端依賴（lockfile）
npm run build               # tsc -b && vite build（desktop 需要本地 dist/）
py -3.12 -m venv .venv      # 專案 venv（不動系統 Python）
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
```

實際安裝結果（PyPI wheel，無任何 native 編譯）：
cryptography 50.0.2、liboqs-python 0.16.0.1、pywebview 6.2.1、
pythonnet 3.2.1、pytest 9.1.1、pqpm-client 0.1.0（editable）。

> ⚠ liboqs-python 0.16.x 的 `import oqs` 內建自動下載／編譯安裝器。
> 我們的程式碼已雙層封鎖（見 §1.5）；native 未配置時直接回報 blocked。

### 2.3 CLI 測試

```powershell
.\.venv\Scripts\python.exe -m pqpm_client --check-tools   # 本機密碼工具檢查（不啟動 GUI）
.\.venv\Scripts\python.exe -m pytest -q                   # 單元／邊界測試
```

- `--check-tools` 不會 import pywebview／GUI（有測試保證）。
- exit code：全部通過＝**0**；有失敗＝1；native 缺配置受阻＝2。

### 2.4 Desktop 診斷視窗

```powershell
npm run build                                            # 需先有 dist/
.\.venv\Scripts\python.exe -m pqpm_client --diagnostics
```

- 只在此模式暴露 bridge（`health_check`、`run_feasibility_checks`）。
- 視窗自動開在 `http://127.0.0.1:<臨時port>/dev/crypto?diagnostics=1`。
- 關閉視窗即結束；靜態伺服器隨後關閉。

### 2.5 一般瀏覽器模式（mock 回歸）

```powershell
npm run dev    # http://localhost:5173
```

- 原有 Register→Login→Chat mock 流程不受影響。
- 開 `/dev/crypto?diagnostics=1` 會顯示「bridge 不可用」並停用測試按鈕。

### 2.6 選項 A 實施記錄（native liboqs 編譯，可重現）

1. **VS 2022 Build Tools**（官網 `aka.ms/vs/17/release/vs_BuildTools.exe`）：
   `--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools
   --includeRecommended --add Microsoft.VisualStudio.Component.VC.CMake.Project`
   → MSVC 14.44.35207＋Windows SDK＋VS 內建 CMake（安裝約數 GB，需 UAC）。
2. **liboqs 0.16.0 原始碼**：GitHub 官方 release tarball
   `https://github.com/open-quantum-safe/liboqs/archive/refs/tags/0.16.0.tar.gz`
   （與 liboqs-python 0.16.0.1 版本對應）。
3. **CMake 組態／編譯／安裝**：
   `cmake -S <src> -B <build> -G "Visual Studio 17 2022" -A x64
   -DBUILD_SHARED_LIBS=ON -DOQS_BUILD_ONLY_LIB=ON
   -DCMAKE_WINDOWS_EXPORT_ALL_SYMBOLS=TRUE
   -DCMAKE_INSTALL_PREFIX=<專案>/desktop/native`
   → `cmake --build <build> --config Release --parallel 8`
   → `cmake --build <build> --config Release --target install`
   → 產物 `desktop/native/bin/oqs.dll`（未啟用任何 stateful／hazardous
   選項；ML-KEM／ML-DSA 為預設啟用）。
4. **接線**：`desktop/pqpm_client/__init__.py` 在 `desktop/native/` 存在且
   使用者未自設 `OQS_INSTALL_PATH` 時自動指向該路徑。
5. 驗證：`--check-tools` 整體「通過」、exit 0；GUI 兩次執行指紋改變。

`desktop/native/` 已被 gitignore；新機器需依本節步驟重新編譯，
或以安全方式傳遞 dll。

### 2.7 常見問題

- **`--diagnostics` 顯示找不到 dist/index.html**：先 `npm run build`。
- **ML-KEM／ML-DSA 顯示受阻**：代表 native liboqs 未配置（例如新機器）
  ——如實受阻是正確行為，不要嘗試讓 `import oqs`「自動修好」
  （自動安裝器已被防護封鎖）；應依 §2.6 重新編譯。
- **pytest 出現 GUI 相關錯誤**：測試不應啟動 GUI；若發生請回報，
  不要略過（不得以 skip 代替成功）。

---

## 3. 可行性測試結果

本節只記錄**實際執行**的命令與**實際觀察**的輸出。所有金鑰均為該次執行
的短暫測試金鑰（非正式身分金鑰），畫面與 terminal 均無私鑰／shared
secret／derived key。

### 3.1 最終狀態（選項 A 後）：全部通過

`--check-tools` 整體「通過」、exit 0；pytest 28/28；GUI 16 項全過、
兩次執行指紋改變。§3.5 保留 B 模式時期的原始記錄作為歷程證據。

> **B 模式 vs 選項 A**：兩者是同一個第 1 階段的兩種執行方式，差別只在
> 有沒有安裝 native liboqs——B 模式（先做）PQC 如實受阻、exit 2、
> 公鑰指紋無資料；選項 A（後補）PQC 真實執行通過、exit 0、指紋完整顯示；
> HKDF／AES-256-GCM 兩者皆真實通過。完整對照表見
> [WORKLOG.md](./WORKLOG.md) §3.4。

### 3.2 環境（health_check 實測值）

```
Python 3.12.1；Windows 11 (AMD64)（build 26300）
cryptography 50.0.2；liboqs-python 0.16.0.1；native liboqs 0.16.0
pywebview 6.2.1＋pythonnet 3.2.1；WebView2 Runtime 155.0.4283.62
Node v22.21.0／npm 10.9.4
```

### 3.3 前端 build 與 pytest（實際記錄）

| 階段 | 命令 | 結果 |
|---|---|---|
| 基線（動工前） | `npm ci`＋`npm run build` | ✅ 成功（1841 modules，無錯誤） |
| 完成後（含診斷頁） | `npm run build` | ✅ 成功（1844 modules，無新增錯誤） |
| pytest（最終） | `pytest -q` | ✅ `28 passed`（涵蓋密碼語意、schema 無秘密欄位、busy lock、bridge allowlist、CLI exit code、靜態伺服 403/404/SPA、native 偵測零子程序；無 skip 冒充成功） |

### 3.4 GUI 實測（Windows 真實開啟＋真實 bridge 呼叫）

| 觀察 | 實測值 |
|---|---|
| 視窗 URL | `http://127.0.0.1:<臨時port>/dev/crypto?diagnostics=1`（停留不變） |
| bridge 注入 | `window.pywebview.api` 存在；方法＝`health_check,run_feasibility_checks`（＝allowlist） |
| 「檢查環境」卡 | bridge v1／Python 3.12.1／cryptography 50.0.2／liboqs-python 0.16.0.1／native 可用（0.16.0） |
| 執行結果 | 整體「通過」、16 項全過、指紋完整顯示 |
| 兩次執行 | run ID 與 ML-KEM／ML-DSA 指紋皆改變（新短暫金鑰） |
| localStorage | 全程僅 `["pqpm_theme"]`（既有 key；診斷頁零寫入） |

> 自動化備註：初期以 UI 自動化工具綁定視窗時曾誤綁另一個 Edge 視窗，
> 改以視窗內 JavaScript 讀回後確認真實視窗行為正確（自動化綁定問題，
> 非 app 缺陷）。

### 3.5 B 模式時期原始記錄（歷程證據，2026-10-26 選項 A 之前）

native 未配置時，`--check-tools`（run ID e4a850b7，exit code 2）如實
輸出：ML-KEM-768 與 ML-DSA-65 全項「受阻」（檔案預檢即回報，未觸發
import／自動下載／編譯）；HKDF-SHA-256 2 項、AES-256-GCM 5 項「通過」
（真實執行）；整體「受阻」。GUI 探針實錄（run ID `6b9d96a8`→`7c539932`）
與瀏覽器回歸（bridge 不可用＋按鈕停用）同日完成。

### 3.6 選項 A 之後的逐項結果（真實 PQC）

CLI 實際輸出（run ID 6091b33f，**exit code 0**）：

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
| HKDF-SHA-256／AES-256-GCM | 同 §3.5 | ✅ 維持通過 |
| **整體** | | ✅ **通過**（exit 0） |
| E2EE session | | **尚未實作**（固定顯示） |

＊實測 liboqs-python 0.16 不會對錯誤長度丟例外（直接傳入 native 有越界
讀取風險），故依任務文件 §6.1 以**安全應用層長度驗證**（比對
`details.length_ciphertext`／`length_signature`）作為拒絕機制，wrapper
行為如實記錄於說明欄。期間亦修正：liboqs-python 0.16 的
`Signature.verify()` 必須明確傳入 `public_key`（無預設值）。

**指紋改變驗證**（多次實測）：ML-KEM `803b5720…`→`819a0b7d…`、
ML-DSA `b32d802c…`→`e6ee1644…`；GUI 內 `fa919bda…`→`4eddfaa9…`、
`391d3efb…`→`e593e642…`；run ID 亦每次不同（8ac7c099→6091b33f→51516422）。
此為正常隨機生成下的預期行為，**不作隨機性安全證明**。

### 3.7 備註與限制（如實聲明）

- HKDF／AES-GCM 為**獨立元件測試**，非正式協定 key schedule／record layer。
- AES-GCM「每次加密新 nonce；GCM tag 不防重放」如實標示於結果說明。
- ML-DSA-65 是第 1 階段測試選擇，未經 supervisor 核定為最終參數。
- 測試金鑰每次執行後以 context manager 釋放；不保證 native runtime
  完整記憶體抹除，不宣稱「已安全擦除所有私鑰」。

---

## 4. 實作狀態

### 4.1 總結論

**第 1 階段全部完成（2026-10-26，選項 A 實施後）。** ML-KEM-768 與
ML-DSA-65 由 native liboqs 0.16.0（自行編譯）真實執行並通過；
HKDF-SHA-256、AES-256-GCM 通過；desktop GUI 於 Windows 實際開啟、
bridge 實際呼叫成功；pytest 28/28。**僅代表密碼工具可行性 PoC 完成，
不是 E2EE 聊天完成。**

### 4.2 原有功能（未變動，已回歸確認）

- React + TS + Vite 前端：Home／Login／Register／Chat／Profile。
- MSW + localStorage mock 層（`VITE_USE_MOCK` 預設 true）。
- `Chat.tsx` 發送仍是 local-only optimistic echo（未接後端，符合現況）。
- 瀏覽器回歸實測：首頁正常；`/dev/crypto?diagnostics=1` 顯示
  「bridge 不可用」並停用測試按鈕，無 crash。
- 第 1 階段僅修改兩個既有檔：`src/App.tsx`（新增 route）、`.gitignore`
  （追加規則，未刪原規則）；其餘全部為新增檔案。

### 4.3 完成項目與證據

| 項目 | 狀態 | 證據 |
|---|---|---|
| Python 3.12 venv＋editable install | ✅ | 實際安裝版本記錄（§2.2） |
| FeasibilityService（UI／CLI 共用） | ✅ | `--check-tools` 與 GUI 輸出一致 |
| bridge allowlist（2 方法） | ✅ | `test_bridge_surface.py`＋GUI 實測 |
| busy 防平行（Python lock） | ✅ | `test_runner_busy.py`；bridge 回 busy |
| HKDF-SHA-256 | ✅ 2/2 通過 | CLI＋GUI＋pytest |
| AES-256-GCM | ✅ 5/5 通過 | 同上 |
| ML-KEM-768 | ✅ 4/4 通過（native 真實執行） | CLI exit 0＋GUI＋pytest |
| ML-DSA-65 | ✅ 5/5 通過（含負面測試） | 同上 |
| loopback 靜態伺服（防逃逸、SPA） | ✅ | `test_static_server.py` |
| 前端診斷頁（固定 E2EE 標示） | ✅ | 瀏覽器＋GUI 實測 |
| Windows GUI 實際驗證 | ✅ | §3.4 |
| pytest 自動化 | ✅ 28/28 | 含缺依賴／busy／邊界案例 |
| liboqs 自動安裝器防護 | ✅ | §1.5＋`test_native_detection.py` |
| 選項 A（native 編譯） | ✅ | §2.6＋§3.6 |

事件記錄（自動安裝器兩次觸發、node_modules 半殘事件）見
[WORKLOG.md](./WORKLOG.md) §2.5 與 §3.2。

### 4.4 尚未做／後續階段（不自動開始）

- 第 2 階段：session specification 撰寫與 supervisor 審查
  （ML-DSA 參數正式核定亦屬此階段）。
- 第 3+ 階段：relay（FastAPI 候選）、TLS、SQLite、帳號。
- 第 4 階段：無 UI 雙 client E2EE 整合；第 5 階段：聊天 UI 接回。
- 第 6 階段：正式 key-management UI（本診斷頁不取代它）。

**在兩個 client 的 authenticated session、relay 密文轉送與相關測試完成前，
不得稱「E2EE 聊天已完成」。**

### 4.5 版控狀態

- GitHub：https://github.com/FYPwinRM/PQPM_FYP_2（Private，`main`）。
- Commits：`9fd97e5`（B 模式全部產出）→ `c76d5a3`（選項 A 完成）。
- 動工前完整備份：`C:/Users/admin/PQPM_backups/PQPM_FYP-main_stage1_prework_2026-10-26_011049/`。
- `Desktop/.git` 全程未動（專案為巢狀獨立 repo）。
- 2026-10-26 文件整理（7 份 MD→3 份）：依使用者指示**未 commit**。

---

## 5. 手動驗收清單

依第 1 階段任務文件第 7 節整理，命令皆可在專案根目錄（PowerShell）直接
照做。預期結果皆為**實測驗證過**的行為；若與預期不符，請停下來回報。

### A. 安裝與基線（一次性）

```powershell
npm ci
npm run build
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
```

- [ ] `npm run build` 成功（tsc＋vite 無錯誤）。
- [ ] pip 安裝成功（cryptography 50.0.2、liboqs-python 0.16.0.1、
      pywebview 6.2.1、pytest 9.1.1）。
- [ ] native liboqs：本機已有 `desktop/native/bin/oqs.dll`；新機器依 §2.6 編譯。

### B. CLI 真實測試

```powershell
.\.venv\Scripts\python.exe -m pqpm_client --check-tools
```

- [ ] 輸出含「執行編號（run ID）」8 位 hex。
- [ ] `[ML-KEM（ML-KEM-768）] 狀態：通過`：金鑰生成／Shared-secret
      equality／Ciphertext 長度（1088 bytes）／錯誤長度拒絕全通過；
      公鑰 1184 bytes＋完整 SHA-256 指紋。
- [ ] `[ML-DSA（ML-DSA-65）] 狀態：通過`：5 項全通過；簽章 3309 bytes、
      公鑰 1952 bytes＋指紋。
- [ ] `[HKDF-SHA-256] 狀態：通過`（2 項）。
- [ ] `[AES-256-GCM] 狀態：通過`（5 項）。
- [ ] `整體狀態：通過`；`E2EE session：尚未實作`。
- [ ] exit code 為 **0**（PowerShell：`$LASTEXITCODE`）。

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

- [ ] `28 passed`（無 skip 冒充成功）。

### C. Desktop UI 驗收（Windows 實際開窗）

```powershell
.\.venv\Scripts\python.exe -m pqpm_client --diagnostics
```

1. - [ ] 開啟本地視窗，網址為 `http://127.0.0.1:<port>/dev/crypto?diagnostics=1`。
2. - [ ] 頁面可見「僅測試本機密碼元件。**尚未建立 E2EE 聊天 session。**」
3. - [ ] 執行來源顯示「本機 Python bridge（診斷模式）」。
4. - [ ] 按「檢查環境」：顯示 bridge v1／Python 3.12.1／cryptography 50.0.2／
      liboqs-python 0.16.0.1／native liboqs 可用（0.16.0）。
5. - [ ] 按「產生測試金鑰並執行檢查」：先出現「測試執行中…」，再逐項顯示
      ML-KEM-768 與 ML-DSA-65 全部「通過」並顯示公鑰長度、完整 SHA-256
      指紋（64 位 hex）；HKDF 兩項通過、AES-256-GCM 五項通過。
6. - [ ] 「執行編號」每次不同，且 **ML-KEM／ML-DSA 的公鑰指紋每次改變**
      （新短暫金鑰；指紋改變本身不作隨機性安全證明）。
7. - [ ] 整體狀態＝通過；底部固定「E2EE session：尚未實作」。
8. - [ ] 快速連點「產生測試金鑰」：不會出現兩份結果交錯（Python 端 busy
      保護；若剛好趕上前一次執行會顯示 busy 訊息）。
9. - [ ] F5 重新整理：回到「尚未執行測試」，**不會**恢復舊結果。
10. - [ ] DevTools（如可開）檢查 localStorage：只有既有 `pqpm_theme`。
11. - [ ] 畫面與 terminal 輸出**沒有**私鑰／shared secret／derived key。
12. - [ ] 關閉視窗後程式結束（server 隨視窗關閉）。

> 不需要、也不應該登入真實 relay——本階段沒有 relay。

### D. 一般瀏覽器／mock 回歸

```powershell
npm run dev
```

- [ ] `http://localhost:5173/` 首頁正常。
- [ ] demo／password123 登入 → `/chat` mock 流程正常。
- [ ] 開 `/dev/crypto?diagnostics=1`：顯示「偵測不到本機 Python bridge
      （不可用）」＋「測試功能不可用」，兩顆測試按鈕**停用**。
- [ ] 開 `/dev/crypto`（無參數）：同樣停用並提示需以診斷模式開啟。
- [ ] 一般頁面無 crash。

### E. 缺依賴行為（已由 pytest 自動覆蓋，供理解）

- 缺 native liboqs → PQC 受阻、HKDF／AES-GCM 仍獨立回報、整體不顯示
  全部通過（`test_report_schema.py`）。
- bridge 呼叫失敗 → UI 顯示錯誤並恢復可操作。
- 平行呼叫 → busy 回覆（`test_runner_busy.py`、`test_bridge_surface.py`）。
- 嚴禁讓 `import oqs`「自動修好」：liboqs-python 內建自動下載／編譯，
  已由程式碼封鎖（`test_native_detection.py`）。

### F. 驗收結論判定

- 以上全過 → 可記錄為**「第 1 階段全部完成：ML-KEM-768／ML-DSA-65／
  HKDF／AES-256-GCM 真實執行通過、desktop UI 驗收通過」**。
- **任何情況下都不宣稱 E2EE 聊天已完成**（屬第 2–5 階段範圍）。
