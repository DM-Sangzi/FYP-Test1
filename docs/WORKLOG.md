# PQPM 工作記錄（WORKLOG）

> 本文件是專案的**完整工作時間軸**：每個階段做了什麼、結果如何、有什麼證據。
> 技術細節與操作手冊見 [stage1.md](./stage1.md)；專案總覽見根目錄 [README.md](../README.md)。
> 記錄原則：只寫實際做過的事與實際觀察到的結果，不預填、不美化。

## 0. 總覽時間軸

| 時期 | 階段 | 內容 | 狀態 |

|---|---|---|---|
| 2026-06 | 第 0 階段：UI 時期 | React 前端＋MSW mock 聊天 UI | ✅ 完成（mock 層） |
| 2026-10-26 | 第 1 階段 B 模式 | Python desktop core、bridge、診斷頁；HKDF／AES 真實通過；PQC 如實受阻 | ✅ 完成 |
| 2026-10-26 | 第 1 階段 選項 A | 編譯 native liboqs 0.16.0；ML-KEM-768／ML-DSA-65 真實全數通過 | ✅ 完成 |
| — | **第 1 階段整體** | **密碼工具可行性 PoC** | ✅ **全部完成** |
| 待定 | 第 2 階段 | session specification、威脅模型、測試矩陣、supervisor review note | ⏳ 等待文件 |
| 待定 | 第 3+ 階段 | relay、TLS、SQLite、帳號；雙 client E2EE；聊天整合 | 未開始 |

**固定聲明：E2EE 聊天 session 尚未實作。第 1 階段的「完成」僅指密碼工具
可行性 PoC 完成，不代表 E2EE 聊天完成。**

## 1. 第 0 階段：UI 時期（2026-06）

> 完整原文（1,044 行中英對照）保存於 git 歷史 commit `9fd97e5`
> （`what_have_done.md`），本節為精華摘要。

- **技術棧**：React 18＋TypeScript＋Vite；CSS Modules＋design tokens
  （light／dark 主題）；React Router v6。
- **頁面**：Home（landing）／Login／Register／Chat（雙欄聊天殼）／Profile，
  加上 SessionGuard（未登入導向 /login）與 chat 元件
  （Sidebar／ChatHeader／MessageList／MessageBubble／MessageInput）。
- **mock 資料層**：MSW（Mock Service Worker）攔截 API＋localStorage 持久化
  （`pqpm_users`，demo 帳號 `demo`／`password123`）；seed 對話與訊息。
- **認證**：AuthContext，JWT 只存記憶體（不寫 localStorage），
  重新整理即登出。
- **聊天發送**：local-only optimistic echo——`Chat.tsx` 的 `handleSend`
  只更新本地狀態，沒有任何後端或加密（截至第 1 階段結束仍是如此）。
- **切換真實後端的設計**：`VITE_USE_MOCK=false`＋`VITE_API_BASE_URL`
  兩個環境變數即可，元件程式碼不用改。
- 當時 README 稱「後端密碼引擎由其他組員負責」——此描述已因專案改採
  Python desktop client 方向而過時（見第 1 階段）。

## 2. 第 1 階段 B 模式（2026-10-26）

依「第 1 階段任務文件」執行，經使用者條件批准後開工。

### 2.1 動工前保護措施

- **完整備份**（專案目錄以外）：
  `C:/Users/admin/PQPM_backups/PQPM_FYP-main_stage1_prework_2026-10-26_011049/`
  （50 檔／243,987 bytes，逐檔比對一致）。
- 基線記錄：`npm ci`＋`npm run build` 成功（1841 modules，無原有錯誤）。
- 版控規則（當時）：不 git init／commit／push、不動 `Desktop/.git`
  （專案後來才建立自己的 repo，見 §4）。

### 2.2 環境建立

- Python **3.12.1** 專案 `.venv`（不改系統預設 3.14、不用全域套件）。
- 實際安裝（PyPI wheel，零 native 編譯）：cryptography 50.0.2、
  liboqs-python 0.16.0.1、pywebview 6.2.1、pythonnet 3.2.1、pytest 9.1.1、
  pqpm-client 0.1.0（editable）。
- 前端依賴照舊用 npm lockfile，不升級任何套件。

### 2.3 新增的軟體（全部為新檔案，僅改 2 個既有檔）

- **`desktop/pqpm_client/`**（Python client core）：
  - `feasibility/`：`runner.py`（UI／CLI 共用測試服務＋threading.Lock 防
    平行）、`models.py`（非秘密 schema＋欄位名掃描）、`kem_checks.py`
    （ML-KEM-768＋native 偵測雙層防護）、`signature_checks.py`
    （ML-DSA-65）、`kdf_checks.py`（HKDF-SHA-256）、`aead_checks.py`
    （AES-256-GCM）。
  - `bridge.py`：pywebview js_api **allowlist**（僅 `health_check`、
    `run_feasibility_checks` 兩個方法；有測試保證）。
  - `static_server.py`：127.0.0.1 loopback 臨時 port 靜態伺服——只服務
    `dist/`、只 GET/HEAD、路徑逃逸 403、SPA fallback、無任何 API route。
  - `app.py`／`__main__.py`：`--check-tools`（CLI，不載入 GUI）與
    `--diagnostics`（桌面視窗，唯一暴露 bridge 的模式）。
- **前端**：`src/bridge/desktop.ts`（型別化 bridge adapter，等
  `pywebviewready` 含逾時）、`src/pages/CryptoDiagnostics.tsx`＋CSS
  （route `/dev/crypto`，固定顯示「尚未建立 E2EE 聊天 session」，
  零 localStorage 寫入）、`src/types/crypto.ts`。
  僅修改既有檔：`src/App.tsx`（加一條 route）、`.gitignore`（追加規則）。
- **測試**：`tests/unit/` 8 個檔案、28 個 pytest 測試。
- Gate 設計：`?diagnostics=1` 只是 UI 標記；bridge 由 Python
  `--diagnostics` 啟動模式控制。

### 2.4 B 模式結果（全部實測）

- **HKDF-SHA-256**：2/2 通過（相同輸入一致／不同 context 不同）——真實執行。
- **AES-256-GCM**：5/5 通過（還原／改密文／錯 key／nonce／AAD 拒絕）——真實執行。
- **ML-KEM-768／ML-DSA-65**：如實「受阻」（native 未配置；檔案預檢即回報，
  不觸發 import）。
- `--check-tools` exit code 2（受阻非零，符合規定）；pytest **28/28**。
- **GUI 實證**（真實 pywebview 視窗）：bridge 注入成功、方法＝allowlist、
  結果卡正確、localStorage 全程只有既有 `pqpm_theme`。
- **瀏覽器回歸**：`/dev/crypto` 顯示「bridge 不可用」＋按鈕停用；
  首頁／mock 登入流程無 crash。

### 2.5 事件記錄（誠實保留）

- **liboqs-python 自動安裝器（第一次）**：`liboqs-python 0.16.0.1` 的
  `import oqs` 內建「倒數→git clone→cmake 編譯到 `~/_oqs`」安裝器。
  一次偵測意外觸發：clone 已下載到 temp，因當時無 cmake 而建置失敗中止，
  `~/_oqs` 從未建立；temp clone 已刪除並確認無殘留。之後改寫偵測為
  **雙層防護**（純檔案預檢：無 DLL 就完全不 import；import 期間以 stub
  封鎖 subprocess），並加回歸測試保證零下載零編譯。
- **node_modules 半殘事件**：一次被中斷的 `npm ci` 使 node_modules 只剩
  16 個套件（vite 消失）＋一個殘留的 zombie vite 行程佔用 5173。已用
  `npm ci` 從 lockfile 完整還原並清理行程；`dist/`、`.venv`、程式碼無影響。

### 2.6 版控建立（經使用者指示）

- 建立 GitHub repo **[FYPwinRM/PQPM_FYP_2](https://github.com/FYPwinRM/PQPM_FYP_2)**
  （Private），分支 `main`。
- Commit `9fd97e5`：79 檔／10,971 行（第 1 階段 B 模式全部產出）。
  提交前掃描確認無 token／私鑰／API key；`Desktop/.git` 全程未動。

## 3. 第 1 階段 選項 A：native liboqs（2026-10-26，經使用者批准）

### 3.1 安裝與編譯（實際執行）

1. **VS 2022 Build Tools**（Microsoft 官方安裝器，quiet 模式，UAC 經使用者
   確認）：VCTools 工作負載＋Windows SDK＋CMake 元件
   → MSVC 14.44.35207。
2. **liboqs 0.16.0 官方 release tarball**（GitHub open-quantum-safe，
   與 liboqs-python 0.16.0.1 版本對應）。
3. CMake 組態（`Visual Studio 17 2022` x64、`BUILD_SHARED_LIBS=ON`、
   `OQS_BUILD_ONLY_LIB=ON`、無 stateful/hazardous 選項）→ Release 編譯 →
   安裝 **`desktop/native/bin/oqs.dll`**（約 6 MB；已被 gitignore，
   重建步驟記錄於 stage1.md §2.6）。
4. 接線：`pqpm_client/__init__.py` 在 `desktop/native/` 存在時自動把
   `OQS_INSTALL_PATH` 指向該處（使用者不需手動設環境變數）。

### 3.2 期間發現並修正的兩個真實問題

1. liboqs-python 0.16 的 `Signature.verify()` **必須明確傳入 `public_key`**
   （無預設值，與常見範例不同）→ 修正 ML-DSA 檢查的呼叫方式。
2. wrapper 實測**不會**對錯誤長度 ciphertext／signature 丟例外（直接傳入
   native 更有越界讀取風險）→ 依任務文件 §6.1 改為**應用層長度驗證**
   （比對 `details` 的標準長度後拒絕），wrapper 行為如實寫在結果說明欄。
3. 另一次自己的除錯指令在防護路徑外裸 `import oqs`，又觸發自動安裝器
   clone（未安裝任何東西；已清除並記錄教訓：一律透過 `pqpm_client` 套件）。

### 3.3 選項 A 結果（全部實測）

| 項目 | 實測結果 |
|---|---|
| ML-KEM-768 | **4/4 通過**：金鑰生成、shared-secret equality（封裝／解封裝一致）、ciphertext 1088 bytes（＝FIPS 203 標準）、錯誤長度應用層拒絕；公鑰 1184 bytes＋完整 SHA-256 指紋 |
| ML-DSA-65（測試選擇，非最終核定參數） | **5/5 通過**：金鑰生成、正確簽章驗證、修改訊息拒絕、錯誤公鑰拒絕、簽章 3309 bytes（＝FIPS 204 標準）；公鑰 1952 bytes＋指紋 |
| HKDF／AES-256-GCM | 維持通過 |
| `--check-tools` | 整體「**通過**」、**exit 0** |
| 指紋改變驗證 | 每次執行指紋皆不同（如 ML-KEM `803b5720…`→`819a0b7d…`；GUI 內亦驗證）。此為正常隨機生成的預期行為，不作隨機性安全證明 |
| GUI（真實視窗） | 16 項全過、指紋完整顯示、localStorage 零寫入、「E2EE session：尚未實作」固定顯示 |
| pytest | **28/28**（含 native 路徑調適型斷言） |
| native 版本 | liboqs 0.16.0（`oqs.oqs_version()`） |

- Commit `c76d5a3`（7 檔變更）推送至 GitHub。
- **第 1 階段全部完成**（依任務文件 §8 定義）。

### 3.4 B 模式 vs 選項 A：差異對照

> 觀念釐清：A 與 B 不是兩個「階段」，而是**同一個第 1 階段的兩種執行方式**
> （先做 B 降低風險，經批准後再實施 A 補齊）。差別只在**有沒有安裝
> native liboqs**。B 的成果全部保留，A 只是疊加上去。

| | **B 模式**（先做） | **選項 A**（後補） |
|---|---|---|
| 定義 | 不安裝 native liboqs，只做能做的 | 安裝 native liboqs（自行編譯），補齊 PQC 測試 |
| native liboqs（oqs.dll） | ❌ 沒有 | ✅ 官方 0.16.0 原始碼＋VS Build Tools＋CMake 自行編譯 |
| ML-KEM-768 測試 | ⛔ 受阻（如實顯示，未執行） | ✅ 真實執行通過（secret 一致、ciphertext 1088 bytes） |
| ML-DSA-65 測試 | ⛔ 受阻（同上） | ✅ 真實執行通過（正負面測試、簽章 3309 bytes） |
| HKDF-SHA-256 | ✅ 真實執行通過 | ✅ 維持通過（不變） |
| AES-256-GCM | ✅ 真實執行通過 | ✅ 維持通過（不變） |
| `--check-tools` exit code | **2**（受阻非零，防「受阻被誤當成功」） | **0**（全部通過） |
| 公鑰指紋顯示 | 「—（未執行或受阻）」 | 完整 64 位 SHA-256 指紋，每次執行改變 |
| 第 1 階段狀態 | **部分完成**（依使用者指示：不得宣稱 PQC 已測） | **全部完成**（依任務文件 §8 驗收定義） |

分兩步的原因：native 編譯是全案最高風險步驟（數 GB 工具鏈＋CMake），
先確認不需 native 的部分（bridge、診斷頁、HKDF／AES）全通過再投入；
且 B 模式下 PQC「不能測」就誠實標「受阻」，不造假。

## 4. 現況與下一步

- **目前狀態**：第 1 階段（密碼工具可行性 PoC）✅ 完成；
  **E2EE session 尚未實作**；無 relay／TLS／SQLite／帳號／握手。
- **第 2 階段（等待開始）**：產出可審閱的 session specification、威脅模型、
  測試矩陣及中英 supervisor review note——等待使用者提供第 2 階段任務
  文件後，依「唯讀檢查→計劃→確認→執行」流程進行。
- supervisor review 是**設計審查**，不是行政批准，也不是安全證明。
- 未決設計問題（ML-DSA 參數核定等）將在第 2 階段文件中列出建議、理由
  與風險，不預先假設已批准。

## 5. 版控與備份狀態

| 項目 | 狀態 |
|---|---|
| GitHub | https://github.com/FYPwinRM/PQPM_FYP_2（Private，`main`） |
| Commits | `9fd97e5`（B 模式全部產出）→ `c76d5a3`（選項 A 完成） |
| 動工前備份 | `C:/Users/admin/PQPM_backups/PQPM_FYP-main_stage1_prework_2026-10-26_011049/` |
| `Desktop/.git` | 全程未動（專案是巢狀獨立 repo） |
| 本文件整理 | 2026-10-26 進行（7 份 MD → 3 份）；**依使用者指示未 commit**，改動留在工作目錄供檢查 |
