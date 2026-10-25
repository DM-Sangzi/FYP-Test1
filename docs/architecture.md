# PQPM 架構說明（第 1 階段）

> 狀態聲明：第 1 階段採 **B 模式（部分完成）**。本文件描述的「未來完整架構」
> 只是目標藍圖，尚未實作；目前已實作的只有「本階段實際架構」一節的範圍。
> **尚未建立任何 E2EE 聊天 session。**

## 1. 未來完整架構（藍圖，本階段不建立）

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
client–relay TLS 保留為傳輸層，應用層採 E2EE；relay 不持有 plaintext 或私鑰；
ML-KEM-768 為暫定 KEM 候選、ML-DSA 用於 session 資料認證；
session 規格需先通過 supervisor 設計審查（第 2 階段）才算正式整合。

**本階段沒有**：relay、TLS 服務、SQLite、帳號系統、session handshake、
正式身分金鑰、WebSocket、檔案分享、群聊、ratchet。

## 2. 本階段實際架構（已實作並驗證）

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
  → native liboqs 預檢；未配置 → 如實 blocked（B 模式）
         ↓
只回傳非秘密 schema（run ID、狀態、長度、公鑰 SHA-256 指紋）
         ↓
React 顯示結果；私鑰／shared secret／derived key 不進入 JavaScript
```

### 2.1 檔案對應

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
| 前端 bridge adapter | `src/bridge/desktop.ts` |
| 診斷頁 | `src/pages/CryptoDiagnostics.tsx`（route `/dev/crypto`） |
| 診斷結果型別 | `src/types/crypto.ts` |

## 3. 信任邊界與安全設計

### 3.1 bridge 閘門（誰能呼叫我們）

- bridge **只**在 `python -m pqpm_client --diagnostics` 啟動視窗時建立
  （`app.py`）；不帶旗標就不會有任何 `js_api` 物件。
- `?diagnostics=1` URL 參數**只是前端 UI 模式標記**，不具授權意義：
  一般瀏覽器加上此參數仍沒有 bridge，按鈕停用並顯示「bridge 不可用」。
- 暴露方法採嚴格 allowlist：`health_check`、`run_feasibility_checks`
  （測試 `test_bridge_surface.py` 驗證 public callable 集合完全等於這兩個）。
- 不提供任意 Python、shell、檔案路徑、演算法程式碼或私鑰輸入介面；
  suite 參數固定，減少 bridge 攻擊面。
- bridge 錯誤只回傳例外類別（如 `RuntimeError`），不外洩 traceback。

### 3.2 本機靜態伺服器（static_server.py）

- 只綁 `127.0.0.1` loopback、臨時 port；不對外網卡開放。
- 只允許 GET／HEAD；**沒有任何 API route**，不是本機 crypto REST API。
- 只服務 `dist/` 內檔案：原始路徑含 `..`／反斜線／編碼點段 → 403；
  realpath 逃逸 → 403；目錄不下載列表。
- 無副檔名路徑（如 `/dev/crypto`）→ 回 `index.html`（SPA fallback，
  讓 BrowserRouter 直接開啟／重新整理可用）；有副檔名但缺檔 → 404
  （方便發現 assets 問題）。
- 以上皆有 pytest 覆蓋（`test_static_server.py`）。

### 3.3 秘密邊界

- schema（`models.py`）沒有任何秘密欄位；測試以遞迴掃描欄位名稱
  （`find_forbidden_keys`）驗證。
- 私鑰／shared secret／derived AES key 只存在於 Python 函式區域變數，
  不進入回傳值、不寫 log／檔案／localStorage。
- 每次執行生成新的短暫測試金鑰與 run ID；不綁定帳號、不持久化。
  native 物件以 context manager 釋放；Python／native runtime 的完整
  記憶體抹除**不作保證**，不得宣稱「已安全擦除所有私鑰」。
- 前端診斷頁零 localStorage 寫入（GUI 驗證實測 keys 全程只有既有 `pqpm_theme`）。

### 3.4 已知限制（如實記錄，不假裝有防護）

- pywebview 6.2.1 沒有硬性「禁止遠端導覽」API。目前緩解：視窗載入固定
  本機 URL、診斷頁不含任何外部連結、靜態伺服只服務 dist。若未來需要
  硬性限制，需評估其他 shell 或 WebView2 設定。
- 在本機實測中，pywebview 6.2.1 的視窗以 Edge（WebView2／InPrivate 標記）
  承載內容；此為 wrapper 行為，非我們可控制的外觀差異，功能驗證不受影響。

## 4. liboqs-python 自動安裝器事件與防護（重要）

**事件**：`liboqs-python 0.16.0.1` 的 `import oqs` 內建自動安裝器——找不到
native library 時會倒數 5 秒後自動 `git clone` liboqs 原始碼並以 `cmake`
編譯安裝到 `~/_oqs`。實作期間一次偵測呼叫意外觸發它：clone 曾下載到
temp 目錄，因本機無 cmake 而建置失敗中止；`~/_oqs` 從未被建立。
事後已刪除該 temp clone 並確認無殘留。

**現行防護**（`kem_checks.detect_liboqs()`，雙層）：

1. **純檔案預檢**：依 liboqs-python 的搜尋邏輯（`OQS_INSTALL_PATH` 或
   `~/_oqs` 下的 `bin\oqs.dll`／`bin\liboqs.dll`，加 PATH 掃描）先確認
   DLL 是否存在；不存在直接回 `blocked`，**連 `import oqs` 都不執行**。
2. **子程序封鎖**：確有候選 DLL 需要 import 時，暫時以會丟例外的 stub
   取代 `subprocess.run`／`subprocess.Popen`，就算 wrapper 決定自動安裝
   也會被擋下，並在 `finally` 還原。

回歸測試 `test_native_detection.py`：在乾淨子程序中把 subprocess 全部
設為必炸，驗證 native 未配置時 `detect_liboqs()` 不觸發 import、零子程序。

## 5. 候選工具（後續階段評估，本階段未採用）

- relay：FastAPI（Python）、HTTPS long-polling 候選 —— 第 3+ 階段。
- desktop shell：目前 pywebview 6.2.1（已實測可用）。
- native liboqs：選項 A（VS Build Tools + CMake 自行編譯）待使用者批准。
