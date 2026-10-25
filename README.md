# PQPM — Post-Quantum Privacy Messenger（FYP 專案）

Post-Quantum Privacy Messenger：以 ML-KEM／ML-DSA／HKDF／AES-256-GCM
為基礎的端對端加密（E2EE）一對一訊息原型。PolyU COMP4913 Capstone Project
（學生：Lee Ying Ho）。

## 目前狀態（2026-10-26）

| 階段 | 狀態 |
|---|---|
| 第 0 階段：React 聊天 UI（MSW mock） | ✅ 完成 |
| **第 1 階段：密碼工具可行性 PoC** | ✅ **完成**（ML-KEM-768／ML-DSA-65／HKDF／AES-256-GCM 真實執行全數通過；desktop 診斷視窗已驗證） |
| 第 2 階段：session specification（待 supervisor 審查） | ⏳ 未開始 |
| 第 3+ 階段：relay／TLS／SQLite／帳號；雙 client E2EE；聊天整合 | 未開始 |

> 過程註記：第 1 階段先以 **B 模式**完成（2026-10-26：bridge／診斷頁／
> HKDF／AES-256-GCM 真實通過；ML-KEM／ML-DSA 因 native liboqs 未配置
> **如實顯示受阻**，exit 2），同日經批准實施**選項 A**（自行編譯官方
> liboqs 0.16.0）後 PQC 轉為真實執行並全數通過。兩段歷程的原始記錄見
> [docs/WORKLOG.md](./docs/WORKLOG.md) §2–3、[docs/stage1.md](./docs/stage1.md) §3.5–3.6。

> **誠實聲明：E2EE 聊天 session 尚未實作。** 第 1 階段的「完成」僅代表
> 本機密碼元件可行性測試（PoC）通過，不代表任何 E2EE 功能上線。

## 技術棧

- **前端**：React 18＋TypeScript＋Vite＋CSS Modules；MSW mock 層
  （`VITE_USE_MOCK` 切換，dev 模式完整 Register→Login→Chat 流程可用）。
- **本機 client core**：Python 3.12（`desktop/pqpm_client`）——
  pywebview desktop shell、受限 JavaScript–Python bridge（allowlist）、
  loopback 靜態伺服。
- **密碼元件**：liboqs 0.16.0（官方原始碼自行編譯，ML-KEM-768／
  ML-DSA-65）＋cryptography（HKDF-SHA-256／AES-256-GCM）。
- **測試**：pytest（28 個：密碼語意、schema 無秘密欄位、bridge 邊界、
  busy 防平行、靜態伺服防逃逸、native 偵測零下載）。

## 快速開始（Windows PowerShell，專案根目錄）

```powershell
# 一次性安裝
npm ci
npm run build
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"

# CLI：本機密碼工具檢查（真實執行；全部通過 exit 0）
.\.venv\Scripts\python.exe -m pqpm_client --check-tools

# 自動化測試
.\.venv\Scripts\python.exe -m pytest -q        # 預期 28 passed

# Desktop 診斷視窗（開啟 /dev/crypto，暴露受限 bridge）
.\.venv\Scripts\python.exe -m pqpm_client --diagnostics

# 一般瀏覽器 mock 模式（原有 UI）
npm run dev                                     # http://localhost:5173
```

前端其他 scripts：`npm run build`（tsc＋vite）、`npm run preview`、
`npm run typecheck`、`npm run lint`。

> ⚠ 不要在任何地方裸 `import oqs`：liboqs-python 內建自動下載／編譯
> 安裝器（已由本專案程式碼封鎖）。native liboqs 位於 `desktop/native/`
> （gitignore）；新機器重建步驟見 [docs/stage1.md](./docs/stage1.md) §2.6。

## 目錄結構（重點）

```text
├── src/                    # React 前端（含 /dev/crypto 診斷頁、bridge adapter）
│   ├── pages/              # Home／Login／Register／Chat／Profile／CryptoDiagnostics
│   ├── bridge/             # 型別化 pywebview bridge adapter
│   ├── api/                # API client＋MSW handlers＋seed
│   ├── context/            # AuthContext（記憶體 JWT）／ThemeContext
│   └── components/         # 共用元件＋chat 殼層元件
├── desktop/
│   ├── pqpm_client/        # Python client core（CLI＋GUI 共用測試服務、bridge）
│   └── native/             # 自行編譯的 oqs.dll（gitignore）
├── tests/unit/             # pytest（28 tests）
├── docs/
│   ├── WORKLOG.md          # 完整工作記錄（時間軸：做了什麼、結果、證據）
│   └── stage1.md           # 第 1 階段完整文件（架構／安裝／結果／狀態／驗收）
├── pyproject.toml          # Python 套件（editable install）
└── package.json            # 前端 scripts／依賴
```

前端路由：`/`（Home）、`/login`、`/register`、`/chat`（需登入）、
`/profile`（需登入）、`/dev/crypto`（開發診斷頁，需 `--diagnostics`
模式才有測試功能）。

## 文件指引

| 想知道… | 看 |
|---|---|
| 專案做過什麼、各階段結果與事件記錄 | [docs/WORKLOG.md](./docs/WORKLOG.md) |
| 架構、安裝、測試結果、驗收清單（第 1 階段） | [docs/stage1.md](./docs/stage1.md) |
| 為什麼某些東西刻意不做（relay、握手、E2EE） | docs/stage1.md §1.1、§4.4 |

## 安全邊界摘要

- 私鑰／shared secret／derived key 永不離開 Python 程序（schema 無秘密
  欄位，有測試保證）；UI 只顯示長度、狀態與公鑰 SHA-256 指紋。
- bridge 僅暴露 `health_check`／`run_feasibility_checks` 兩個方法，只在
  `--diagnostics` 模式存在；`?diagnostics=1` 只是 UI 標記，不是授權。
- 測試金鑰為每次執行的短暫金鑰，不綁帳號、不持久化；不宣稱記憶體完整抹除。

## 版控

- GitHub：https://github.com/FYPwinRM/PQPM_FYP_2（Private）
- 詳細版控與備份狀態：[docs/WORKLOG.md](./docs/WORKLOG.md) §5

---
