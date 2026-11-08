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
| 2026-10-26 | 第 2 階段：設計文件 | session specification 初稿 v0.1、威脅模型、8 題中英 supervisor review 問題集 | 📝 文件完成（**待 review**） |
| 2026-10-31 | 前端深色重設計＋可用性精修 | dark-default 主題、chat shell 重構、New chat 專屬視圖、ESLint 10 導入 | ✅ 完成（commit 7bd77b1） |
| 2026-11-03 | 聯絡人個人資料頁 | 唯讀 Contact Profile 覆蓋層、雙頭像入口、狀態保留實測 | ✅ 完成（含於 7bd77b1） |
| 2026-11-07 | 好友邀請功能 | 可持久化、可切帳戶驗證的邀請／好友關係；28 項 mock API 負面測試全過 | ✅ 完成（commit aa0d7cc） |
| 2026-11-07 | TOTP 兩步驟驗證（2FA） | RFC 6238 TOTP＋recovery codes；challenge 登入；6/6 RFC 向量＋35 項實測全過 | ✅ 完成（mock 層） |
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
- **第 2 階段（設計文件完成，待 review）**：`stage2-design.md` v0.1——
  第 1 階段成果摘要（實測 vs 未完成分欄）、client／relay 信任邊界、
  session specification 初稿（身分／金鑰角色／握手訊息／認證範圍／key
  confirmation／金鑰派生／nonce-counter／錯誤／生命週期）、8 題中英
  supervisor review 問題（每題含建議／理由／風險，狀態 OPEN）。
  **文件尚未經 supervisor 批准；review 是設計審查，不是行政批准，
  也不是安全證明。** 本階段零程式碼變更。
- supervisor review 是**設計審查**，不是行政批准，也不是安全證明。
- 未決設計問題（ML-DSA 參數核定等）將在第 2 階段文件中列出建議、理由
  與風險，不預先假設已批准。

## 5. 版控與備份狀態

| 項目 | 狀態 |
|---|---|
| GitHub | https://github.com/FYPwinRM/PQPM_FYP_2（Private，`main`） |
| Commits | `9fd97e5`（B 模式全部產出）→ `c76d5a3`（選項 A 完成）→ `a0e1198`（第 2 階段設計文件，使用者自行提交）→ `7bd77b1`（前端重設計＋聯絡人資料頁） |
| 動工前備份 | `C:/Users/admin/PQPM_backups/PQPM_FYP-main_stage1_prework_2026-10-26_011049/` |
| `Desktop/.git` | 全程未動（專案是巢狀獨立 repo） |
| 本文件整理 | 2026-10-26 進行（7 份 MD → 3 份）；**依使用者指示未 commit**，改動留在工作目錄供檢查 |

## 6. 第 2 階段：設計文件（2026-10-26，待 review）

- **交付物**：`docs/stage2-design.md`（v0.1），經使用者批准大綱後撰寫：
  1. **第 1 階段成果摘要**——實測結果（ML-KEM-768 4/4、ML-DSA-65 5/5、
     HKDF 2/2、AES-GCM 5/5、公鑰 1184/1952 B、簽章 3309 B）與
     「未完成／刻意不做」（握手、relay、身分金鑰持久化、聊天整合）
     **嚴格分欄**；並記錄 Stage 1 結果的限制（元件測試≠協定測試、
     malformed 靠應用層驗證、測試金鑰≠身分金鑰）。
  2. **Client／relay 架構與信任邊界**——ASCII 架構圖（標明「設計目標，
     未實作」）、信任邊界表（relay 不持有任何私鑰／session secret；
     帳號登入≠peer 認證）、攻擊者模型（對齊 proposal：攔截／篡改／重放／
     好奇 relay；端點入侵不在範圍）。
  3. **Session specification 初稿 v0.1**——身分（ML-DSA-65 長期金鑰＋
     fingerprint 人手核對）、金鑰角色（KEM 每 session 暫態、無 pre-keys、
     無 ratchet）、握手訊息草案（M1/M2/C1/C2 經 relay store-and-forward）、
     認證範圍（transcript binding：identities＋session id＋KEM pk＋
     algo list＋roles）、key confirmation（finished-style HMAC，失敗即
     abort 不降級）、HKDF-SHA-256 分方向派生（c2s／s2c／confirm）、
     nonce（隨機 prefix＋單調 counter）與重放拒絕、錯誤分類（密碼運算前
     先做應用層長度驗證）、金鑰生命週期（重啟即重新握手；不宣稱
     forward secrecy）。
  4. **8 題中英 supervisor review 問題**——ML-DSA 參數、fingerprint
     格式、身分金鑰儲存、relay 認證角色（建議：零參與）、transcript
     binding 欄位、重放策略、confirmation 失敗 UX、帳號授權與 peer 認證
     分離。每題：問題（中英）→建議→理由→風險，**狀態全部 OPEN**。
- **原則遵守**：全文未將自訂流程稱為「已證明安全」；未假設 supervisor
  已批准；明確聲明 review≠行政批准≠安全證明；本階段**零程式碼變更**
  （唯讀檢查後僅新增文件）。
- **狀態**：📝 文件完成，**待 supervisor review**；review 意見回饋後
  才更新 v0.2，批准前不進入任何握手實作。

## 7. 前端深色重設計＋聯絡人個人資料頁（2026-10-31 – 11-03）

### 7.1 前端深色重設計（16 檔）

- dark-default 主題 tokens（變數名稱不變，全站 CSS 相容）、重構 chat shell、
  SecurityPanel（焦點管理：開啟聚焦／關閉返回）、New chat 專屬視圖、
  composer Demo note、MessageList 分組（data-first）。
- **ApiError 修復**（既有 bug）：`client.ts` 拋普通 Error 但 AuthContext 用
  `instanceof ApiError` 判斷——登入錯誤永遠顯示籠統訊息；修後正確顯示
  PRD US-07 的「Wrong username or password」。

### 7.2 可用性精修＋ESLint（經使用者批准）

- New chat 專屬視圖（取代浮動面板）、footer 入口、composer Demo note。
- **ESLint 10 工具鏈**（devDependencies）＋flat config；修復全部發現問題
  （effect 內同步 setState 模式、render 期間 ref 存取）。
- **ApiError 修復**如上。

### 7.3 聯絡人個人資料頁（Contact Profile，2026-11-03）

- **唯讀覆蓋層**：/chat 內主區域顯示聯絡人資料（Display name／@username／
  Online），不離開 /chat——草稿、選取對話、捲動位置**實測保留**。
- **雙頭像入口**：Sidebar 對話列頭像拆為獨立按鈕（點頭像＝開 Profile，
  點其餘＝選取，拆列不嵌套）；ChatHeader 頭像按鈕（View …'s profile）。
- **背景互動防護**：開啟時 chatPane 設 `inert`（不可點／不可聚焦）；手機
  375 全螢幕 modal＋Tab 循環鎖定＋sidebar 一併 inert；桌面 sidebar 保持
  可操作（點另一頭像切換 Profile、點對話列關閉並選取）。
- **資料**：Display name／@username（名字比對既有 seedSearchableUsers，
  無配對即省略列）／About（seed 新增 `about` 欄位，經批准）；不含 Email／
  最後上線。
- **驗收**：頭像入口、切換 Profile、列點擊關閉＋選取、草稿/捲動/選取
  保留、inert、手機 modal、明暗主題——全部實測通過。
- **seed `about` 欄位**：決策 2 經批准後新增（Alice/Priya/Chloe 有值，
  Ben/Marcus 省略→示範缺列行為）；`types/index.ts` 加 `about?: string`。

### 7.4 Sidebar 視覺回歸修正（2026-11-03）

- 症狀：頭像白框、頭像與文字上下排列、選取背景只在文字上。
- **實證原因**：`Sidebar.module.css` 被還原回拆列前版本（itemRow/avatarBtn/
  activeRow 樣式消失），TSX 拆列結構保留→CSS Modules 類別無對應樣式。
- 修正：重套拆列樣式＋li 加 `activeRow`＋移除無對應的 `styles.active`；
  computed styles 與截圖雙重核實。

### 7.5 事件：node_modules 三度半殘＋dev server 檔案監看失效

- node_modules 三次被中斷的 npm 操作清空（症狀：`tsc`/`eslint` 不存在），
  均由 lockfile 還原；教訓：npm 命令需跑完。
- dev server 檔案監看一度失效（HMR 未推送 CSS clamp 更新）→ 重啟修復；
  交付前以 computed styles 掃描證實瀏覽器收到的是舊規則，重啟後收到新規則。

## 8. 好友邀請功能（2026-11-07）

> 經使用者逐條批准後實作（方案甲：關係持久化、對話殼與訊息 session-only）。
> commit `aa0d7cc`（14 檔，+2,239／−183）。備份：
> `Desktop\PQPM_FYP-main_backup_2026-11-07`（2,842 檔 SHA-256 逐檔比對 0 差異）。

- **資料層**：`socialStore.ts`（`pqpm_social_v1`）——驗證式 read-modify-write、
  損壞即停寫不覆寫、單次 setItem（接受＝更新邀請＋建好友一次完成）。
- **Mock API**：Bearer 身分標記（解碼 fake-jwt `sub`，非簽章驗證）、合併
  帳戶＋sample 搜尋附關係狀態、`GET /api/friends`（重新登入可載入）、
  send／accept／decline／cancel 全防護（自邀、sample、重複、反向、
  僅收件人可接受、僅寄件人可取消）。
- **UI**：Sidebar Friend requests 入口＋徽章、Received／Sent 視圖、
  關係感知搜尋列、空白搜尋顯示 Friends 分組、Contact Profile 共用同一份
  關係狀態、aria-live 成功／失敗提示；Message 以排序後雙方 user ID 配對，
  不重複建對話、不以姓名比對（移除 seed Contact Profile 的姓名猜測
  username heuristic，屬預期變更）。
- **驗證**：typecheck／lint／build 全過；UI 全流程（註冊→邀請→刷新→接受→
  Message 不重複→雙向同步→跨分頁 storage event）＋ **28 項 mock API 負面
  測試**全過；資料損壞停寫實測（原值逐字未動）；亮色／手機 375px 迴歸正常。
- **聲明**：跨分頁同時寫入仍可能 lost update；mock 無正式後端授權。

## 9. TOTP 兩步驟驗證（2026-11-07）

> 經使用者十項條件批准後實作。備份：
> `Desktop\PQPM_FYP-main_backup_2fa_2026-11-07`（2,870 檔 0 差異）。
> 新增依賴：`otpauth`、`qrcode`（runtime）、`@types/qrcode`（dev）——13 檔。

- **帳戶資料**：`User.twoFactor`（secret、lastUsedCounter 防重播、recovery
  codes 僅存 SHA-256 雜湊、暫存 enrollment 10 分鐘到期）。
- **登入分支**：啟用 2FA 的帳戶密碼正確後只取得 5 分鐘 challenge（回應**無
  token 無 user**）；驗 TOTP 或 recovery code 才發 session；challenge id
  密碼學隨機、記錄帳戶／到期／次數（5 次錯即死）、Back／Cancel 經
  `challenge/cancel` 端點撤銷 handler 端。
- **敏感操作**：enrollment／disable／regenerate 一律重新驗證（密碼＋當前
  TOTP）；disable 亦接受密碼＋未用 recovery code（手機遺失路徑）；已啟用
  者拒絕重新 enrollment（409）；帳戶級 10 分鐘 5 次失敗鎖定；enrollment
  錯 5 碼作廢重來。
- **Recovery codes**：每組 128 bits（16 bytes CSPRNG）→ base32 分組顯示、
  單次使用、重新產生即撤銷舊碼、只顯示一次、只存雜湊。
- **userStore 強化**：解析／欄位驗證失敗改為拋錯保護原值（不覆寫）；
  setItem 失敗拋錯不假報成功（副作用：storage 被封鎖時 register 誠實失敗）。
- **驗證**：typecheck／lint／build 全過；**RFC 6238 附錄 B 六組向量全過**
  （獨立 WebCrypto 實作核對，再以該實作交叉驗證 otpauth 接線）；UI 全流程
  ＋35 項 API 實測（重播、跨挑戰重播、鎖定、到期、取消撤銷、偽造
  challenge、secret 不外洩、損壞保護、好友迴歸）全過。截圖：恢復碼一次性
  顯示、登入第二步。
- **待手動**：手機 authenticator 掃 QR／手動 setup key 實機驗收（無法由
  自動化取代）。
- **聲明**：挑戰與鎖定計數在 handler 記憶體（重整即歸零、可繞過）；跨分頁
  並行下 counter／recovery code 消耗有 read-modify-write 競態，mock 無可靠
  的全域單次使用保證；信任錨點是瀏覽器自身——**不是 production-ready
  MFA**；正式後端不存在，`VITE_USE_MOCK=false` 不構成安全部署。2FA 不影響
  好友、Identity verified、E2EE 狀態。
- **事件**：dev server 檔案監看再次失效（日誌宣稱 HMR 已更新、transform
  快取未失效，伺服舊模組）→ 重啟解決；背景 dev server 曾無預警結束
  （exit 1、日誌無錯誤）→ 重啟接續。

## 10. 個人頭像與對方頭像顯示（2026-11-08）

> 經使用者批准後實作（15 檔＝新增 3＋修改 12；再批准擴充 ChatHeader／
> 聊天列表 3 檔）。備份：`Desktop\PQPM_FYP-main_backup_avatar_2026-11-08`
> （119 檔，實作前）與 `Desktop\PQPM_FYP-main_backup_avatar_chat_2026-11-08`
> （124 檔，含未提交頭像變更），皆 SHA-256 逐檔比對 0 差異。零新增依賴。

- **圖片處理**（`utils/avatarImage.ts`）：真實解碼（createImageBitmap）＋
  MIME／空檔／2 MiB／64–4096px 檢查，中央裁切 256×256，JPEG 品質遞減
  重編碼至 ≤150 KiB；ImageBitmap 必釋放；僅接受 JPEG／PNG／WebP。
- **Mock API**（`POST /api/auth/avatar`）：body 嚴格二擇一（`{dataUrl}` 或
  `{remove:true}`，鍵集恰一）、先限長度→base64→大小→**SW 內真實解碼**驗
  256×256（偽造 JPEG 標記被攔）；僅改 caller 的 avatar 欄位；remove 冪等；
  `stripPrivate` 白名單擴充 `avatarUrl`（password／twoFactor／recovery
  hashes 永不外洩）。
- **相容修正**：2FA disable 由固定五欄位重建改為複製後只刪 `twoFactor`——
  實測停用 2FA 後頭像／password／createdAt 全保留。search／friends／
  friend-requests 回應經穩定 user ID join 出 `avatarUrl`，不以姓名猜測。
- **AuthContext**：新增 `updateAvatar` 經 tokenRef／userIdRef 防污染——
  登出或重新登入（含同帳戶）後的舊回應一律捨棄、不套用。
- **顯示範圍**：Settings 編輯器（單一預覽位置、Preview — not saved yet、
  選擇與移除均須 Save 才生效、處理期間停用衝突按鈕、選圖序號＋unmount
  守衛）、Sidebar footer、搜尋／Friends／Friend requests／Contact Profile
  （participantIds／social data 穩定 ID），以及第二階段批准的 ChatHeader 與
  聊天列表——三處共用 `peerAvatarUrl()` 同一解析規則；seed 對話無可靠 ID
  一律 initials。
- **驗證**：typecheck／lint／build 全過；UI 全流程＋7 種檔案錯誤案例
  （GIF/SVG/空檔/3 MiB/32×32/4500×4500/損壞）＋API 負面測試（401、XOR
  body、壞 base64、偽造 JPEG、尺寸 300×300）＋保存失敗模擬（無假成功、
  可重試）＋A/B 帳戶隔離＋2FA 啟用／停用相容（頁內 RFC 6238 計碼實測）
  ＋壞圖 onError fallback（注入後還原無污染）＋跨分頁「不即時」行為證實
  ＋375px／明暗主題／鍵盤焦點／草稿保留全過。截圖：未保存預覽、保存成功、
  移除後、Friends／Contact Profile 對方頭像、ChatHeader/列表對方頭像、
  375px。
- **聲明**：頭像為 localStorage data URL（≤150 KiB／帳戶；`pqpm_users` 每次
  寫入序列化全部帳戶，容量無固定保證、寫入失敗如實報錯）；跨分頁**不**
  即時同步（對方寫 `pqpm_users` 無 storage event，需重載／重登／social
  action 重抓）；正式後端應另行設計影像儲存與 URL。
- **事件**：使用者 Chrome 端 `pqpm_social_v1` 報損壞——診斷為開發期中間
  版本舊 schema（`schemaVersion`＋`conversations` 欄位，2026-11-07 寫入），
  store 依設計拒寫不覆寫；由使用者在 Console 最小修復（`schemaVersion`→
  `version`），邀請資料全保留。IAB 端資料一直有效，App 全程正常。
