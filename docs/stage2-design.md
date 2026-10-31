# PQPM 第 2 階段：設計文件（Session Specification 初稿 v0.1）

> **文件狀態聲明（必讀）**
>
> 1. 本文件是**設計文件初稿 v0.1**，供 supervisor review 用——**尚未經
>    supervisor 批准**，所有設計決定均為「建議＋理由＋風險」，等待審查。
> 2. supervisor review 是**設計審查**：不是學校行政批准，也**不是安全
>    證明**。review 通過只代表設計方向獲得指導認可。
> 3. 本文件描述的握手、session、relay 流程**全部尚未實作**；目前唯一
>    已實作並驗證的是第 1 階段的密碼元件可行性測試（PoC）。
> 4. 第 3 節的自訂協定流程**不得被稱為「已證明安全」**；它們是基於
>    FIPS 203/204 標準元件的組合設計，正確性與安全性有待 review、
>    實作與測試檢驗。
> 5. 本階段**沒有**修改任何程式碼、沒有實作握手、沒有建立 relay。

## 目錄

1. [第 1 階段成果摘要](#1-第-1-階段成果摘要)
2. [Client／relay 架構與信任邊界](#2-clientrelay-架構與信任邊界)
3. [Session specification 初稿 v0.1](#3-session-specification-初稿-v01)
4. [待 supervisor review 的設計問題](#4-待-supervisor-review-的設計問題)
5. [下一步與邊界](#5-下一步與邊界)

---

## 1. 第 1 階段成果摘要

### 1.1 已實測通過的結果（真實執行，證據見 stage1.md §3）

| 元件 | 實測結果 | 證據 |
|---|---|---|
| ML-KEM-768（liboqs 0.16.0，FIPS 203） | 4/4 通過：金鑰生成、封裝／解封裝 shared-secret 一致、ciphertext 1088 bytes（＝標準）、錯誤長度應用層拒絕 | `--check-tools` exit 0；GUI；pytest |
| ML-DSA-65（FIPS 204） | 5/5 通過：金鑰生成、正確簽章驗證、修改訊息拒絕、錯誤公鑰拒絕、簽章 3309 bytes（＝標準） | 同上 |
| HKDF-SHA-256 | 相同輸入派生一致；不同 context 派生不同 | 同上 |
| AES-256-GCM | 還原、改密文拒絕、錯 key／nonce／AAD 拒絕（5/5） | 同上 |
| 公鑰尺寸實測 | ML-KEM-768 pk **1184 B**／ct **1088 B**；ML-DSA-65 pk **1952 B**／簽章 **3309 B** | health_check／報告 schema |
| 短暫金鑰行為 | 每次執行生成新金鑰；指紋每次改變；秘密不離開 Python 程序（schema 無秘密欄位有測試保證） | 同上 |
| 工程面 | Python 3.12.1＋cryptography 50.0.2＋pywebview 6.2.1 桌面 bridge；pytest 28/28；Windows GUI 實際驗證 | stage1.md §2–4 |

### 1.2 未完成／刻意不做（與實測結果嚴格區分）

| 項目 | 狀態 |
|---|---|
| Session handshake（任何形式的金鑰交換流程） | ❌ 未實作（本階段只寫規格） |
| Relay／TLS／SQLite／帳號系統 | ❌ 未實作 |
| 正式身分金鑰的生成與持久化 | ❌ 未實作（第 1 階段只有每次執行即棄的短暫測試金鑰） |
| E2EE 聊天整合（Chat UI 接密碼層） | ❌ 未實作（`Chat.tsx` 發送仍是 local-only echo） |
| Fingerprint 驗證 UI／key-change 警告 | ❌ 未實作（第 6 階段範圍） |

### 1.3 第 1 階段結果的限制（誠實記錄，影響 spec 解讀）

- **元件測試 ≠ 協定測試**：HKDF／AES-GCM 是獨立元件測試，不是正式
  key schedule 或 record layer；把它們組合成本專案的 session 流程後，
  「組合是否正確」正是第 2 階段規格要回答、supervisor 要審查的問題。
- **Malformed 輸入靠應用層驗證**：實測 liboqs-python 0.16 不會對錯誤長度
  ciphertext／signature 丟例外（直接傳入 native 有越界讀取風險）——
  spec 因此要求應用層先驗證長度（見 §3.8）。
- **測試金鑰 ≠ 身分金鑰**：第 1 階段的金鑰是每次執行即棄的短暫測試金鑰，
  不綁帳號、不持久化；正式身分金鑰的生成／儲存屬本 spec 範圍但未實作。
- **不宣稱記憶體完整抹除**：Python／native runtime 的秘密擦除只作
  best-effort（context manager 釋放），限制如實記錄。

---

## 2. Client／relay 架構與信任邊界

### 2.1 目標架構圖（設計目標——**未實作**，僅第 1 階段的單機 PoC 存在）

```text
        Alice 裝置（信任）                          Bob 裝置（信任）
┌───────────────────────────┐            ┌───────────────────────────┐
│ React UI（/chat，未接線）   │            │ React UI                  │
│   ↕ 受限本機 bridge（allowlist）│        │   ↕ 受限本機 bridge        │
│ Python client core         │            │ Python client core         │
│  · ML-DSA-65 身分金鑰（長期）│            │  · ML-DSA-65 身分金鑰       │
│  · ML-KEM-768 暫態金鑰/session │         │  · ML-KEM-768 暫態金鑰/session│
│  · HKDF 派生、AES-256-GCM    │            │  · 同左                     │
└─────────────┬─────────────┘            └─────────────▲─────────────┘
              │ HTTPS（client–relay TLS，傳輸層）         │ HTTPS
              ▼                                        │
┌─────────────────────────────────────────┐            │
│ Relay（**不受信任**持有訊息內容）          │────────────┘
│  · 帳戶、公開金鑰目錄                      │
│  · 握手 envelope 轉送（store-and-forward） │
│  · 密文轉送、到期清理                       │
│  · 沒有任何 client 私鑰／shared secret／    │
│    session key                            │
└─────────────────────────────────────────┘
```

### 2.2 信任邊界表

| 邊界 | 信任關係 | 依據／說明 |
|---|---|---|
| Client 本機 | **信任**（用戶自己的裝置與 client 程式） | proposal：clients and their cryptographic runtime are trusted |
| Client ↔ Relay 傳輸 | TLS 保護傳輸層；**TLS 端點是 relay**，不提供端對端保護 | proposal：TLS complementary layer；E2EE 由應用層負責 |
| Relay | **不信任**其讀取訊息內容、**不信任**其持有任何私鑰或 session secret；帳戶授權與公鑰目錄服務屬其職責 | proposal：relay 不做 plaintext crypto service；帳號登入≠peer 認證 |
| Alice ↔ Bob（應用層） | 互相認證靠 **ML-DSA 簽章＋人手 fingerprint 核對**（獨立於 relay 的可信管道） | proposal §methodology；key substitution 由 fingerprint 核對緩解 |
| 攻擊者模型 | 可攔截／篡改／重放網路流量；可控制 relay 觀察 metadata（帳號、時間、大小）；**不在範圍**：端點入侵、可用性攻擊、流量分析 | proposal §methodology，逐字對齊 |

### 2.3 架構現實聲明

- 上圖為**設計目標**。目前實際存在的只有：單機 React 前端（mock 聊天）＋
  單機 Python 密碼元件 PoC（第 1 階段）。relay、TLS、雙 client 皆未存在。
- 公鑰替換（key substitution）的緩解依賴**人手 fingerprint 核對**；此
  UI（key-management verification）屬第 6 階段個人功能，spec 層面先定義
  fingerprint 格式（見 Q2）。

---

## 3. Session specification 初稿 v0.1

> 本節是給 supervisor 審查的主體。所有欄位與流程為**草案**，encoding
> 細節（canonical serialization）待 review 後於 v0.2 固定。

### 3.1 身分（Identity）

| 項目 | 草案設計 | 說明 |
|---|---|---|
| 帳號身分 | username／email＋password，僅用於 **relay 存取授權**（未來第 3+ 階段） | proposal：Account login grants relay access and is **distinct from** cryptographic peer authentication |
| 密碼學身分 | 每使用者（每裝置）一對 **ML-DSA-65 長期金鑰**；公鑰經 relay 目錄交換，私鑰永不離開 client、永不傳給 relay | 私鑰進 relay = 違反信任邊界 |
| Peer 認證 | 驗證「對方 ML-DSA 私鑰持有者」＝簽章驗證＋**人手核對 fingerprint**（獨立可信管道，如當面／視訊口頭核對） | proposal：manual out-of-band key verification |
| Fingerprint 草案 | `SHA-256(ML-DSA-65 public key)` 的完整 64-hex 顯示（格式見 Q2） | 第 1 階段已用同一定義顯示測試公鑰指紋 |

### 3.2 金鑰角色（Key Roles）

| 金鑰 | 演算法／尺寸 | 生命週期 | 用途 | 儲存 |
|---|---|---|---|---|
| 身分簽章金鑰 | ML-DSA-65（pk 1952 B／sk 4032 B／sig 3309 B） | 長期（輪替流程見 Q-list） | 簽署握手 transcript → 相互認證 | client 本機（方式待 review，Q3） |
| KEM 金鑰 | ML-KEM-768（pk 1184 B／sk 4032 B／ct 1088 B／ss 32 B） | **每個 session 一次性**（handshake 時新生成，用後即棄） | 建立 shared secret | 僅記憶體 |
| 方向加密金鑰 | AES-256-GCM，32 B ×2（c2s／s2c 分開） | 該 session 內 | 訊息加解密 | 僅記憶體 |
| Confirmation 金鑰 | HMAC key，32 B ×1 | 該 session 內 | key confirmation（§3.5） | 僅記憶體 |

設計取捨（待 review）：

- **無 pre-key／非同步握手**：初始 session 建立需要雙方 online
  （proposal scope 明示）。避免 pre-key 儲存與其重放面。
- **KEM 金鑰每 session 新生成**：不用長期 KEM 公鑰——減少 relay 端可
  關聯的靜態識別資料，且避免長期 KEM 金鑰洩漏影響歷史 session。
- **無 ratchet**：session 內金鑰不輪轉；**不宣稱 forward secrecy／
  post-compromise security**（proposal scope 明確排除）。

### 3.3 握手訊息草案（Handshake Messages，經 relay store-and-forward）

**角色**：initiator（A，發起方）／responder（B，應答方）。`transcript`
指 §3.4 定義的欄位集合之 canonical encoding（v0.2 固定細節）。

```text
M1  A → relay（轉投 B）：
    { protocol_version = 1,
      session_id       = 128-bit random,
      alice_account, bob_account,
      alice_identity_pk,                      // ML-DSA-65
      kem_pk            (A 新生成的暫態 KEM 公鑰),
      role_assignment   = {A: initiator, B: responder},
      algo_list         = [ML-KEM-768, ML-DSA-65, HKDF-SHA-256, AES-256-GCM],
      sig_A             = Sign_A(transcript_m1) }
    B 收到後驗證：sig_A、欄位完整性、algo_list 與本端支援一致（否則 abort）。

M2  B → relay（轉投 A）：
    { session_id, bob_identity_pk,
      kem_ct            (B 以 kem_pk 封裝 → shared_secret),
      transcript_hash   (B 計算，供 A 核對 binding 一致),
      sig_B             = Sign_B(transcript_m2) }
    A 收到後驗證：sig_B、transcript_hash 一致、decapsulate(kem_ct) 得
    shared_secret（A 端自測與後續 confirmation 一致性）。

C1  A → B（經 relay）：confirmation = HMAC(k_confirm, transcript_hash)
C2  B → A：confirmation = HMAC(k_confirm, transcript_hash)
    （C1/C2 可合併進首條加密訊息的 header——實作選項，待 review）
```

- 兩端在 **C1/C2 皆驗證通過前**不得發送任何應用訊息（proposal：
  finished-style key confirmation precedes application messages）。
- 錯誤長度／格式檢查在任何密碼運算**之前**由應用層執行（§3.8）。
- relay 對 M1/M2 僅做轉送與帳號路由，**不參與簽章或金鑰**（見 Q4）。

### 3.4 認證範圍（Authentication Scope / Transcript Binding）

`transcript` 草案欄位集合（**全部**納入簽章與 transcript_hash）：

```
protocol_version, session_id,
alice_account, bob_account,
alice_identity_pk, bob_identity_pk,
kem_pk（A 的暫態 KEM 公鑰）,
role_assignment, algo_list
```

- **雙向認證**：A 驗 sig_B、B 驗 sig_A——任何一方簽章失敗即 abort。
- 綁定上述欄位的目的是防 **unknown-key-share／身分替換**：簽章覆蓋
  「誰跟誰、用什麼金鑰、什麼演算法、哪個 session」。
- 帳號欄位納入 binding 是**草案選擇**（Q5 討論：帳號是否該進 transcript）。
- 訊息層認證由 AES-GCM tag 提供（tag 驗證失敗＝未認證，交付前丟棄）。

### 3.5 Key Confirmation（finished-style）

```
k_confirm = HKDF-Expand(IKM = shared_secret,
                        info = "pqpm/v1/confirmation" || transcript_hash,
                        L = 32)
C1/C2 = HMAC-SHA-256(k_confirm, transcript_hash)
```

- 目的：證明「雙方持有同一 shared_secret 且 transcript 一致」——
  在傳送任何應用訊息前完成。
- **驗證失敗 → 整個 session abort**，不降級、不重試較弱參數
  （proposal：Failed verification will stop the exchange rather than
  silently downgrade protection）。

### 3.6 金鑰派生（Key Derivation）

```
IKM  = ML-KEM-768 shared_secret（32 B，B 封裝／A 解封裝）
salt = transcript_hash（將 session 上下文綁入派生）

HKDF-SHA-256，不同 info labels（第 1 階段已驗證 context 分離）：
  k_c2s     = HKDF-Expand(..., "pqpm/v1/c2s"     || transcript_hash, 32)
  k_s2c     = HKDF-Expand(..., "pqpm/v1/s2c"     || transcript_hash, 32)
  k_confirm = HKDF-Expand(..., "pqpm/v1/confirm" || transcript_hash, 32)
```

- **方向分離**：c2s 與 s2c 使用不同金鑰——nonce／counter 狀態互不影響。
- 第 1 階段已實測：相同輸入派生一致、不同 context 派生不同（元件級）。
- **正式 transcript binding 的確切定義以本 spec 經 review 後的版本為準**。

### 3.7 Nonce／Counter 與重放防護

| 項目 | 草案設計 |
|---|---|
| Nonce（96-bit） | 4-byte 隨機 session prefix（handshake 時生成）＋ 8-byte big-endian **單調遞增 counter**（每方向獨立，從 1 開始）→ 同一金鑰下 nonce 必不重複 |
| AAD | `{protocol_version, session_id, direction, counter}` 的 canonical encoding——把「這是哪個 session 的第幾條訊息」綁進認證 |
| 重放拒絕 | receiver 維護每方向 `max_seen_counter`；收到 `counter ≤ max_seen` → 拒收（嚴格單調，見 Q6 的 window 討論） |
| 明確聲明 | GCM tag 只提供訊息完整性與真實性，**本身不防重放**——重放防護來自 counter 狀態（第 1 階段已如實標示） |

### 3.8 錯誤處理（Error Handling）

| 類別 | 觸發 | 行為 |
|---|---|---|
| `malformed_input` | 任何欄位長度／格式不符 | **在任何密碼運算前**拒絕（應用層長度驗證——第 1 階段實測 wrapper 不會替我們擋） |
| `handshake_auth_failure` | sig_A／sig_B／transcript_hash 不一致、confirmation MAC 不符 | **abort session**；不降級、不重試 |
| `record_auth_failure` | AES-GCM tag 驗證失敗（InvalidTag） | 丟棄該訊息，**永不交付未驗證明文**；連續失敗 → 建議重建 session（policy 待定） |
| `replay_detected` | counter ≤ max_seen | 拒收並記錄（不含內容） |
| `version_mismatch` | protocol_version 不支援 | abort（無版本協商降級路徑 v1） |

- 錯誤訊息／log **不得含**私鑰、shared secret、明文、session key
  （第 1 階段的秘密邊界原則延續）。

### 3.9 金鑰生命週期（Key Lifecycle）

| 項目 | 草案設計 |
|---|---|
| Session 金鑰 | 僅存在於該 session 的記憶體；**client 重啟 → 一律重新握手建立新 session**（proposal 明示），不持久化 session key |
| KEM 暫態金鑰 | handshake 完成後即棄（best-effort 釋放；不保證 native 記憶體抹除） |
| 身分金鑰 | 長期使用；**輪替流程與 key-change 處理屬第 6 階段 key-management UI**，v0.1 不定義（列為 review 議題） |
| 銷毀聲明 | 只承諾「移除應用層引用」，**不承諾**完整記憶體／native runtime 抹除（第 1 階段同原則） |
| 明確限制 | 無 ratchet → session 金鑰洩漏影響該 session 全部訊息；身分金鑰洩漏影響**認證**（冒充風險）——皆如實記錄，不宣稱 forward secrecy |

### 3.10 明確非目標（Non-Goals，沿 proposal 範圍）

多裝置同步、production-grade pre-key 管理、Double Ratchet、正式協定
驗證（formal verification）、metadata 匿名、端點入侵防護、群聊、
hybrid PQ TLS、公開部署；**不宣稱** strong forward secrecy、
post-compromise security、cryptographic deniability。

---

## 4. 待 supervisor review 的設計問題

> 每題格式：問題 → 建議 → 理由 → 風險。**全部狀態：OPEN（未批准）**。
> review 的結論將逐條記錄回本文件（v0.2）。

### Q1. ML-DSA 參數等級 / ML-DSA parameter set

- **EN**: Should the identity signature algorithm be ML-DSA-65, or
  ML-DSA-44/87? Recommendation: keep ML-DSA-65 (NIST Category 3),
  matching the Stage 1 tested configuration.
- **建議**：維持 ML-DSA-65。**理由**：第 1 階段已實測通過；NIST 安全
  等級 3 與 ML-KEM-768（Cat 3）對稱；44 較小但僅 Cat 2。**風險**：
  簽章 3309 B 使握手訊息較大（僅握手受影響，訊息本體不受影響）。

### Q2. Fingerprint 顯示格式 / Fingerprint format

- **EN**: Full 64-hex SHA-256 of the identity public key, or a shortened
  human-friendly format (e.g. 60-digit safety-number style)? Recommendation:
  full hex in v1 protocol/UI, revisit shortened format in Stage 6.
- **建議**：v1 用完整 64-hex（與第 1 階段顯示一致），第 6 階段再評估
  safety-number 式縮短。**理由**：完整值無歧義、實作零額外風險。
  **風險**：64-hex 對人手逐字核對不友善，可能降低實際核對意願。

### Q3. 身分金鑰儲存 / Identity key storage

- **EN**: Where should the long-term ML-DSA private key live? Options:
  (a) plain file, (b) passphrase-encrypted file (KDF + AEAD),
  (c) OS credential store. Recommendation: (b) or (c) for v1; (a) rejected.
- **建議**：(b) 或 (c)（Windows 可評估 DPAPI/keyring）。**理由**：(a)
  使任何本機檔案讀取即冒充用戶；proposal 明示用「OS 或應用程式支援的
  機制」保護私鑰。**風險**：(b) 的 passphrase 強度取決於使用者；(c)
  增加 Windows 特定依賴；**端點被入侵仍在保護範圍外**（proposal scope）。

### Q4. Relay 是否參與認證 / Relay's role in authentication

- **EN**: Should relay signatures/metadata participate in peer
  authentication? Recommendation: no — pure client-to-client
  authentication; relay is an untrusted forwarder.
- **建議**：relay **零參與**認證（純 client-to-client 簽章）。**理由**：
  與信任邊界一致（§2.2）；避免把信任偷偷擴大到 relay；proposal 將
  relay 定位為 untrusted forwarder。**風險**：公鑰目錄若被污染，防線
  只剩人手 fingerprint 核對（故 Q2 的可用性很重要）。

### Q5. Transcript binding 欄位範圍 / Transcript binding field set

- **EN**: Should account identifiers be included in the signed transcript
  (§3.4)? Recommendation: include them (v0.1 draft) to bind identities to
  accounts; minimum set = version, session_id, both identity pks, kem_pk,
  algo_list, roles.
- **建議**：納入帳號（§3.4 草案）。**理由**：把「帳號 ↔ 身分金鑰」
  綁定進握手，降低目錄污染時的錯誤投遞混淆。**風險**：帳號改名／合併
  時的遷移複雜度；若 supervisor 認為多餘，可降回最小集合——兩案皆可，
  **待審**。

### Q6. 重放防護策略 / Replay policy

- **EN**: Strictly monotonic counter per direction (drop any counter ≤
  max seen) vs sliding window for out-of-order delivery. Recommendation:
  strict monotonic in v1 (relay is store-and-forward; ordering per
  conversation is FIFO).
- **建議**：v1 用嚴格單調（每方向）。**理由**：實作簡單、狀態小；
  relay 為 store-and-forward，單一對話 FIFO 下亂序有限。**風險**：
  若未來 relay 或網路造成亂序，嚴格模式會丟合法訊息——window 大小
  屆時再議（不得因此放棄 counter 認證）。

### Q7. Key confirmation 失敗的使用者呈現 / Key confirmation failure UX

- **EN**: On confirmation/verification failure: silent abort vs explicit
  user-facing error. Recommendation: explicit, prominent failure state;
  never silently retry or downgrade (proposal requirement).
- **建議**：明確向使用者顯示「session 驗證失敗，已中止」；**禁止**
  靜默重試或降級。**理由**：proposal 要求 failed verification stops the
  exchange；靜默失敗會訓練使用者忽略安全狀態。**風險**：UI 需設計
  防混淆文案（屬第 5 階段整合時細化）。

### Q8. 帳號授權與 peer 認證的分離 / Account auth vs peer auth

- **EN**: Confirm the two-layer model: relay account login (server-side
  authorization) is entirely separate from E2EE peer authentication
  (ML-DSA + fingerprint). Recommendation: state both layers explicitly in
  spec and future UI; never present "logged in" as "verified peer".
- **建議**：spec 與未來 UI 明確區分兩層——「已登入」永不顯示為
  「已驗證對方」。**理由**：proposal 明示 account login ≠ cryptographic
  peer authentication；混淆會造成使用者誤判安全性。**風險**：無重大
  技術風險，屬設計紀律。

---

## 5. 下一步與邊界

1. 本文件送 supervisor review；**review 意見回來後**更新為 v0.2
   （逐題記錄結論）。review＝設計審查，不等於行政批准，也不是安全證明。
2. **在 review 通過前**：不實作握手、不開始 relay、不做聊天整合
   （Stage 4 才首次整合無 UI 雙 client E2EE；Stage 5 才接回聊天 UI）。
3. 本階段（第 2 階段）交付物僅本文件＋WORKLOG 記錄；沒有任何程式碼變更。
4. 未完成議題清單（延後）：canonical encoding 細節（v0.2）、身分金鑰
   輪替、錯誤 retry policy、UI 呈現細節（Stage 5/6）。
