# 第 1 階段手動驗收清單（B 模式）

依第 1 階段文件第 7 節整理，命令皆可在專案根目錄（PowerShell）直接照做。
預期結果皆為**實測驗證過**的行為；若與預期不符，請停下來回報，不要略過。

## A. 安裝與基線（一次性）

```powershell
npm ci
npm run build
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
```

- [ ] `npm run build` 成功（tsc＋vite 無錯誤）。
- [ ] pip 安裝成功（cryptography 50.0.2、liboqs-python 0.16.0.1、
      pywebview 6.2.1、pytest 9.1.1）。

## B. CLI 真實測試

```powershell
.\.venv\Scripts\python.exe -m pqpm_client --check-tools
```

- [ ] 輸出含「執行編號（run ID）」8 位 hex。
- [ ] `[ML-KEM（ML-KEM-768）] 狀態：通過`：金鑰生成／Shared-secret
      equality／Ciphertext 長度（1088 bytes）／錯誤長度拒絕全通過；
      公鑰 1184 bytes＋完整 SHA-256 指紋。
- [ ] `[ML-DSA（ML-DSA-65）] 狀態：通過`：5 項全通過；簽章 3309 bytes、
      公鑰 1952 bytes＋指紋。
- [ ] `[HKDF-SHA-256] 狀態：通過`（2 項皆通過）。
- [ ] `[AES-256-GCM] 狀態：通過`（5 項皆通過）。
- [ ] `整體狀態：通過`；`E2EE session：尚未實作`。
- [ ] exit code 為 **0**（PowerShell：`$LASTEXITCODE`）。

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

- [ ] `28 passed`（無 skip 冒充成功）。

## C. Desktop UI 驗收（Windows 實際開窗）

```powershell
.\.venv\Scripts\python.exe -m pqpm_client --diagnostics
```

1. - [ ] 開啟本地視窗，網址為 `http://127.0.0.1:<port>/dev/crypto?diagnostics=1`。
2. - [ ] 頁面可見「僅測試本機密碼元件。**尚未建立 E2EE 聊天 session。**」
3. - [ ] 執行來源顯示「本機 Python bridge（診斷模式）」。
4. - [ ] 按「檢查環境」：顯示 bridge v1／Python 3.12.1／cryptography 50.0.2／
      liboqs-python 0.16.0.1／native liboqs 不可用。
5. - [ ] 按「產生測試金鑰並執行檢查」：先出現「測試執行中…」，再逐項顯示：
      ML-KEM-768 與 ML-DSA-65 全部「通過」並顯示公鑰長度、完整 SHA-256
      指紋（64 位 hex）；HKDF 兩項通過、AES-256-GCM 五項通過。
6. - [ ] 「執行編號」每次不同，且 **ML-KEM／ML-DSA 的公鑰指紋每次改變**
      （新短暫金鑰；指紋改變本身不作隨機性安全證明）。
7. - [ ] 整體狀態＝通過；底部固定「E2EE session：尚未實作」。
8. - [ ] 快速連點「產生測試金鑰」：不會出現兩份結果交錯
      （Python 端 busy 保護；若剛好趕上前一次執行會顯示 busy 訊息）。
9. - [ ] F5 重新整理：回到「尚未執行測試」，**不會**恢復舊結果。
10. - [ ] DevTools（如可開）檢查 localStorage：只有既有 `pqpm_theme`，
       沒有診斷頁寫入的任何 key。
11. - [ ] 畫面與 terminal 輸出**沒有**私鑰／shared secret／derived key。
12. - [ ] 關閉視窗後程式結束（server 隨視窗關閉）。

> 不需要、也不應該登入真實 relay——本階段沒有 relay。

## D. 一般瀏覽器／mock 回歸

```powershell
npm run dev
```

- [ ] `http://localhost:5173/` 首頁正常。
- [ ] demo／password123 登入 → `/chat` mock 流程正常。
- [ ] 開 `http://localhost:5173/dev/crypto?diagnostics=1`：顯示
      「偵測不到本機 Python bridge（不可用）」＋「測試功能不可用」，
      「檢查環境」與「產生測試金鑰並執行檢查」**按鈕停用**。
- [ ] 開 `http://localhost:5173/dev/crypto`（無參數）：同樣停用並提示
      需以診斷模式開啟。
- [ ] 一般頁面無 crash。

## E. 缺依賴行為（已由 pytest 自動覆蓋，供理解）

- 缺 native liboqs → PQC 受阻、HKDF／AES-GCM 仍獨立回報、整體不顯示
  全部通過（`test_report_schema.py`）。
- bridge 呼叫失敗 → UI 顯示錯誤並恢復可操作（逾時包裝＋錯誤處理）。
- 平行呼叫 → busy 回覆（`test_runner_busy.py`、`test_bridge_surface.py`）。
- 嚴禁讓 `import oqs`「自動修好」：liboqs-python 內建自動下載／編譯，
  已由程式碼封鎖（`test_native_detection.py`）。

## F. 驗收結論判定

- 以上全過（選項 A 已實施，2026-10-26）→ 可記錄為
  **「第 1 階段全部完成：ML-KEM-768／ML-DSA-65／HKDF／AES-256-GCM
  真實執行通過、desktop UI 驗收通過」**。
- **任何情況下都不宣稱 E2EE 聊天已完成**（E2EE session：尚未實作；
  屬第 2–5 階段範圍）。
