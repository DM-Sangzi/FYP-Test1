# 實作狀態（第 1 階段，B 模式）

> **結論：B 模式部分完成。** frontend／desktop bridge、HKDF-SHA-256、
> AES-256-GCM 已由本機 Python 真實執行並通過；ML-KEM-768 與 ML-DSA-65
> 因 native liboqs 未配置而如實「受阻」，**不得宣稱已測試成功**。
> **第 1 階段整體尚未全部完成；尚未建立任何 E2EE 聊天 session。**

## 1. 原有功能（未變動，已回歸確認）

- React + TS + Vite 前端：Home／Login／Register／Chat／Profile。
- MSW + localStorage mock 層（`VITE_USE_MOCK` 預設 true）。
- `Chat.tsx` 發送仍是 local-only optimistic echo（未接後端，符合現況）。
- 瀏覽器回歸實測（2026-10-26）：首頁正常渲染；`/dev/crypto?diagnostics=1`
  顯示「bridge 不可用」並停用測試按鈕，無 crash。

僅修改兩個既有檔案：`src/App.tsx`（新增 `/dev/crypto` route）、
`.gitignore`（追加 Python runtime 規則，未刪原規則）。

## 2. 本次實際完成（B 模式）

| 項目 | 狀態 | 證據 |
|---|---|---|
| Python 3.12 專案 venv + editable install | ✅ 完成 | pywebview 6.2.1 等實際安裝 |
| FeasibilityService（UI／CLI 共用） | ✅ 完成 | `--check-tools` 與 GUI 輸出一致 |
| bridge allowlist（2 方法） | ✅ 完成 | `test_bridge_surface.py`；GUI 實測 `Object.keys(api)`＝兩方法 |
| busy 防平行（Python lock） | ✅ 完成 | `test_runner_busy.py`；bridge 回 `{"busy":true}` |
| HKDF-SHA-256 真實測試 | ✅ **通過**（2/2 檢查） | CLI＋GUI＋pytest |
| AES-256-GCM 真實測試 | ✅ **通過**（5/5 檢查） | CLI＋GUI＋pytest |
| ML-KEM-768 | ⛔ **受阻**（native 未配置） | 檔案預檢，未觸發 import |
| ML-DSA-65 | ⛔ **受阻**（native 未配置） | 同上 |
| loopback 靜態伺服（僅 dist、防逃逸、SPA fallback） | ✅ 完成 | `test_static_server.py`（403/404/200 各案例） |
| 前端診斷頁 `/dev/crypto`（固定「尚未建立 E2EE」標示） | ✅ 完成 | 瀏覽器＋GUI 實測 |
| Windows GUI 實際開啟＋bridge 實際呼叫 | ✅ 已驗證 | 探針實錄（見 feasibility-results.md §4） |
| pytest 自動化 | ✅ 28/28 通過 | 含缺依賴／busy／邊界案例 |
| 文件（本目錄五份） | ✅ 完成 | |

## 3. 受阻項目與原因

- **ML-KEM-768／ML-DSA-65**：native `oqs.dll` 未配置。B 模式如實顯示
  受阻；安裝方案（選項 A：VS Build Tools + CMake 編譯官方 liboqs）
  已另行提出，**等待批准後才會實施**。
- 附帶觀察：本機無 cmake、無 vcpkg（唯讀檢查確認）。

## 4. 事件記錄：liboqs-python 自動安裝器（已處理）

- **發生**：2026-10-26 實作期間，一次 `import oqs` 偵測觸發
  liboqs-python 0.16.0.1 內建自動安裝器：`git clone` liboqs 0.16.0
  原始碼到 temp（下載已發生），隨後因本機無 cmake 建置失敗中止。
- **影響範圍**：`~/_oqs` 從未建立；僅一個 temp clone 殘留。
- **處理**：已刪除該 temp clone 並驗證無殘留；改寫偵測為
  「純檔案預檢（無 DLL 就不 import）＋import 期間封鎖 subprocess」雙層
  防護；新增回歸測試保證零子程序、零 import（native 缺失時）。
- 之後所有偵測均在 0.2 秒內如實回報受阻，無任何下載。

## 5. 尚未做／後續階段（不自動開始）

- 選項 A：native liboqs 編譯安裝（待批准）→ 之後 ML-KEM／ML-DSA 實測。
- 第 2 階段：session specification 撰寫與 supervisor 審查。
- 第 3+ 階段：relay（FastAPI 候選）、TLS、SQLite、帳號。
- 第 4 階段：無 UI 雙 client E2EE 整合；第 5 階段：聊天 UI 接回。
- 第 6 階段：正式 key-management UI（本診斷頁不取代它）。

**在兩個 client 的 authenticated session、relay 密文轉送與相關測試完成前，
不得稱「E2EE 聊天已完成」。**

## 6. 版控狀態

- 依指示：未 git init／commit／push／設定 remote；未動 `Desktop/.git`。
- 動工前完整備份：`C:/Users/admin/PQPM_backups/PQPM_FYP-main_stage1_prework_2026-10-26_011049/`
  （50 檔／243,987 bytes，與來源逐檔一致）。
- 專案版控由使用者另行處理。
