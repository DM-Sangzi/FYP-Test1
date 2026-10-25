# What Have We Done — PQPM Frontend Changelog

> **English / 中文對照**  
> This document explains every major part of the PQPM frontend codebase, with code snippets, line references, and bilingual descriptions.  
> 本文檔說明 PQPM 前端專案的每一個主要部分，包含程式碼片段、檔案行號，以及中英對照說明。

---

## Table of Contents / 目錄

1. [Project Setup / 專案設定](#1-project-setup--專案設定)
2. [Global Styles & Design Tokens / 全域樣式與設計標記](#2-global-styles--design-tokens--全域樣式與設計標記)
3. [Type Definitions / 型別定義](#3-type-definitions--型別定義)
4. [Context Providers / 狀態提供者](#4-context-providers--狀態提供者)
5. [API Client — The Single Seam / API 客戶端——唯一的切換縫隙](#5-api-client--the-single-seam--唯一的切換縫隙)
6. [MSW Mock Layer — Handlers / MSW 模擬層——處理常式](#6-msw-mock-layer--handlers--msw-模擬層-處理常式)
7. [Why MSW + localStorage? / 為什麼用 MSW + localStorage？](#7-why-msw--localstorage--為什麼用-msw--localstorage)
8. [localStorage User Store / localStorage 使用者儲存](#8-localstorage-user-store--localStorage-使用者儲存)
9. [Seed Data / 種子資料](#9-seed-data--種子資料)
10. [Pages / 頁面](#10-pages--頁面)
11. [Chat Shell Components / 聊天殼層元件](#11-chat-shell-components--聊天殼層元件)
12. [Routing & Guards / 路由與保護](#12-routing--guards--路由與保護)
13. [Data Flow Summary / 資料流程總結](#13-data-flow-summary--資料流程總結)

---

## 1. Project Setup / 專案設定

### `package.json`
**File:** `package.json`  
**Lines:** 1–31

```json
{
  "name": "pqpm-frontend",
  "private": true,
  "version": "2.0.0",
  "dependencies": {
    "lucide-react": "^0.460.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.28.0"
  },
  "devDependencies": {
    "msw": "^2.6.6",
    "typescript": "^5.6.3",
    "vite": "^5.4.11"
  }
}
```

| English | 中文 |
|---------|------|
| `react` + `react-dom` — the core UI framework. | `react` + `react-dom` —— 核心 UI 框架。 |
| `react-router-dom` — client-side routing for SPA navigation. | `react-router-dom` —— 單頁應用程式的路由系統。 |
| `msw` — Mock Service Worker to intercept API calls during development. | `msw` —— 模擬 Service Worker，開發時攔截所有 API 請求。 |
| `vite` — fast build tool and dev server. | `vite` —— 快速建構工具與開發伺服器。 |
| `lucide-react` — lightweight SVG icon library. | `lucide-react` —— 輕量級 SVG 圖示庫。 |

### `vite.config.ts`
**File:** `vite.config.ts`  
**Lines:** 1–11

```ts
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, open: true },
});
```

| English | 中文 |
|---------|------|
| Uses the React plugin and sets the dev server on port 5173. | 使用 React 插件，開發伺服器設為 5173 埠。 |

### `tsconfig.json` (monorepo-style)
**File:** `tsconfig.json`  
**Lines:** 1–7

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

| English | 中文 |
|---------|------|
| Split into `tsconfig.app.json` (for `src/`) and `tsconfig.node.json` (for Vite config). Enables strict mode, path aliases (`@/*` → `src/*`). | 拆分為 `tsconfig.app.json`（用於 `src/`）與 `tsconfig.node.json`（用於 Vite 設定）。啟用嚴格模式與路徑別名（`@/*` → `src/*`）。 |

### `.env` & `.env.example`
**File:** `.env` / `.env.example`

```env
VITE_USE_MOCK=true
VITE_API_BASE_URL=http://localhost:8080
```

| English | 中文 |
|---------|------|
| `VITE_USE_MOCK=true` enables the MSW mock layer by default. | `VITE_USE_MOCK=true` 預設啟用 MSW 模擬層。 |
| `VITE_API_BASE_URL` is only used when mock is disabled. | `VITE_API_BASE_URL` 僅在關閉模擬時使用。 |
| **This is the single config change needed to connect a real backend.** (PRD §5.3) | **這是連接真實後端所需的全部設定變更。**（PRD §5.3） |

---

## 2. Global Styles & Design Tokens / 全域樣式與設計標記

### `src/index.css`
**File:** `src/index.css`  
**Lines:** 1–233

```css
/* Light theme (default) */
:root {
  --color-bg:       #f5f5f5;
  --color-surface:  #ffffff;
  --color-accent:   #0e7490;   /* teal */
  --color-text:     #1a1a1a;
  --color-bubble-sent:     #dbeafe;
  --color-bubble-received: #f3f4f6;
}

/* Dark theme */
[data-theme="dark"] {
  --color-bg:       #111827;
  --color-surface:  #1f2937;
  --color-accent:   #22d3ee;
  --color-text:     #f9fafb;
  --color-bubble-sent:     #1e3a5f;
  --color-bubble-received: #374151;
}
```

| English | 中文 |
|---------|------|
| All colours, radii, typography, and spacing are defined as CSS custom properties (design tokens). | 所有顏色、圓角、字體排版和間距都以 CSS 自訂屬性（設計標記）定義。 |
| Light theme uses the exact hex values from PRD §8.2. | 淺色主題使用 PRD §8.2 中的精確十六進位值。 |
| Dark theme toggles via `[data-theme="dark"]` attribute on `<html>`. | 深色主題透過 `<html>` 上的 `[data-theme="dark"]` 屬性切換。 |
| Global reset, `font-size: 16px`, focus-visible outlines, reduced-motion support. | 全域重置、`16px` 字體大小、focus-visible 外框、減少動態效果支援。 |

---

## 3. Type Definitions / 型別定義

### `src/types/index.ts`
**File:** `src/types/index.ts`  
**Lines:** 1–67

```ts
export interface User {
  id: string;
  username: string;
  email: string;
  password: string;   /* plaintext — mock only, never log */
  createdAt: string;
}

export interface PublicUser {
  id: string;
  username: string;
  email: string;
}

export interface Conversation {
  id: string;
  name: string;
  initials: string;
  color: AvatarColor;
  status: 'online' | 'offline';
  lastMessage: string;
  lastMessageAt: string;
  unread: number;
}

export interface Message {
  id: string;
  conversationId: string;
  direction: 'sent' | 'received';
  text: string;
  at: string;
}
```

| English | 中文 |
|---------|------|
| `User` contains the password field; `PublicUser` strips it for API responses. | `User` 包含密碼欄位；`PublicUser` 在 API 回應中移除它。 |
| `Conversation` mirrors the sidebar card structure (avatar, name, last message, unread badge). | `Conversation` 對應側邊欄卡片結構（頭像、名稱、最後訊息、未讀徽標）。 |
| `Message.direction` determines bubble alignment: `sent` → right, `received` → left. | `Message.direction` 決定氣泡對齊：`sent` → 右側，`received` → 左側。 |

---

## 4. Context Providers / 狀態提供者

### `src/context/AuthContext.tsx`
**File:** `src/context/AuthContext.tsx`  
**Lines:** 1–126

```tsx
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const login = useCallback(async (identifier, password) => {
    const session = await apiLogin(identifier, password);
    setToken(session.token);
    setUser(session.user);
    return true;
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setToken(null);
    setUser(null);
  }, []);
}
```

| English | 中文 |
|---------|------|
| Holds the JWT token and current user **in memory only** — never written to localStorage. | JWT 權杖與目前使用者**僅存在記憶體中** —— 永不寫入 localStorage。 |
| `login()` calls the API client, stores session on success, sets error on failure. | `login()` 呼叫 API 客戶端，成功時儲存會話，失敗時設定錯誤。 |
| `logout()` calls the API, then clears both token and user. | `logout()` 呼叫 API，然後清除權杖與使用者。 |
| `useAuth()` hook provides `{ user, token, isAuthenticated, login, register, logout, loading, error }`. | `useAuth()` Hook 提供 `{ user, token, isAuthenticated, login, register, logout, loading, error }`。 |

### `src/context/ThemeContext.tsx`
**File:** `src/context/ThemeContext.tsx`  
**Lines:** 1–67

```tsx
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const stored = window.localStorage.getItem('pqpm_theme') as Theme | null;
      if (stored === 'light' || stored === 'dark') return stored;
    } catch { /* storage blocked */ }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    window.localStorage.setItem('pqpm_theme', theme);
  }, [theme]);
}
```

| English | 中文 |
|---------|------|
| Persists the theme preference to localStorage so it survives page refreshes. | 將主題偏好儲存至 localStorage，使頁面重新整理後仍保留。 |
| Falls back to the OS preference (`prefers-color-scheme`) if no stored value. | 若無儲存值則回退至作業系統偏好（`prefers-color-scheme`）。 |
| Sets `data-theme` attribute on `<html>` to trigger CSS variable swaps. | 在 `<html>` 上設定 `data-theme` 屬性以觸發 CSS 變數切換。 |

---

## 5. API Client — The Single Seam / API 客戶端——唯一的切換縫隙

### `src/api/client.ts`
**File:** `src/api/client.ts`  
**Lines:** 1–93

```ts
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
const BASE_URL = String(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

function url(path: string): string {
  return USE_MOCK ? path : `${BASE_URL}${path}`;
}

export async function login(identifier: string, password: string): Promise<AuthSession> {
  const res = await fetch(url('/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  return parse<AuthSession>(res);
}
```

| English | 中文 |
|---------|------|
| **This is the only file that knows whether we are in mock or real mode.** | **這是唯一知道我們處於模擬模式還是真實模式的檔案。** |
| `USE_MOCK` reads the env variable at module evaluation time. | `USE_MOCK` 在模組評估時讀取環境變數。 |
| When mock: `url('/api/auth/login')` → `/api/auth/login` (intercepted by MSW). | 模擬模式時：`url('/api/auth/login')` → `/api/auth/login`（由 MSW 攔截）。 |
| When real: `url('/api/auth/login')` → `http://localhost:8080/api/auth/login`. | 真實模式時：`url('/api/auth/login')` → `http://localhost:8080/api/auth/login`。 |
| `parse<T>()` extracts JSON and throws `ApiError` on non-2xx responses. | `parse<T>()` 解析 JSON，非 2xx 回應時拋出 `ApiError`。 |
| **Components never call `fetch` directly — they import from `api/client.ts`.** | **元件從不直接呼叫 `fetch` —— 它們從 `api/client.ts` 匯入。** |

---

## 6. MSW Mock Layer — Handlers / MSW 模擬層——處理常式

### `src/api/browser.ts`
**File:** `src/api/browser.ts`  
**Lines:** 1–11

```ts
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);
```

| English | 中文 |
|---------|------|
| Creates an MSW Service Worker instance with all handlers. | 建立包含所有處理常式的 MSW Service Worker 實例。 |

### `src/api/handlers.ts`
**File:** `src/api/handlers.ts`  
**Lines:** 1–177

```ts
// POST /api/auth/register
http.post(`${BASE}/auth/register`, async ({ request }) => {
  await delay(250);
  const body = await request.json();
  const users = readUsers();
  const usernameTaken = users.some(
    (u) => u.username.toLowerCase() === body.username.toLowerCase(),
  );
  if (usernameTaken) {
    return HttpResponse.json({ error: 'That username is already taken.' }, { status: 409 });
  }
  const newUser = { id: generateId(), ...body };
  writeUsers([...users, newUser]);
  return HttpResponse.json({ success: true }, { status: 201 });
});
```

| English | 中文 |
|---------|------|
| `delay(250)` simulates network latency so the UI shows loading states. | `delay(250)` 模擬網路延遲，讓 UI 顯示載入狀態。 |
| Register checks for duplicate usernames (PRD US-09) and returns 409 Conflict. | 註冊檢查重複使用者名稱（PRD US-09），回傳 409 衝突。 |
| Login matches on username OR email (case-insensitive), returns fake JWT or 401. | 登入可匹配使用者名稱或電子郵件（不分大小寫），回傳假 JWT 或 401。 |
| Logout returns a 200 OK (no-op in mock mode). | 登出回傳 200 OK（模擬模式下為空操作）。 |
| `GET /api/conversations` returns the seed conversation list. | `GET /api/conversations` 回傳種子對話列表。 |
| `GET /api/conversations/:id/messages` returns messages keyed by conversation ID. | `GET /api/conversations/:id/messages` 依對話 ID 回傳訊息。 |
| `GET /api/users/search?q=` filters the searchable user list. | `GET /api/users/search?q=` 篩選可搜尋的使用者列表。 |

### `src/main.tsx` — MSW Bootstrap
**File:** `src/main.tsx`  
**Lines:** 13–23

```ts
async function bootstrap() {
  const useMock = import.meta.env.VITE_USE_MOCK !== 'false';
  if (useMock) {
    const { worker } = await import('./api/browser');
    await worker.start({
      onUnhandledRequest: 'bypass',
      serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
      quiet: true,
    });
  }
  createRoot(document.getElementById('root')!).render(<App />);
}
```

| English | 中文 |
|---------|------|
| The Service Worker is started **before** the React app renders. | Service Worker 在 React 應用程式渲染**之前**啟動。 |
| Dynamic `import('./api/browser')` keeps the MSW code out of the production bundle when mock is disabled. | 動態 `import('./api/browser')` 確保關閉模擬時 MSW 程式碼不會進入生產打包。 |
| `onUnhandledRequest: 'bypass'` prevents errors for assets (CSS, images) that aren't API calls. | `onUnhandledRequest: 'bypass'` 防止非 API 呼叫的資源（CSS、圖片）報錯。 |

---

## 7. Why MSW + localStorage? / 為什麼用 MSW + localStorage？

### What is MSW? / 什麼是 MSW？

**MSW (Mock Service Worker)** is a browser-level API mocking library. It works by installing a **Service Worker** in your browser that intercepts all `fetch` and `XMLHttpRequest` calls *before* they reach the network.

**MSW（模擬 Service Worker）** 是一個瀏覽器層級的 API 模擬庫。它的工作方式是安裝一個 **Service Worker**，在請求到達網路**之前**攔截所有的 `fetch` 和 `XMLHttpRequest` 呼叫。

```
User clicks "Login"
        ↓
React calls fetch('/api/auth/login') ← browser sees this as a real request
        ↓
MSW Service Worker intercepts it ← request never leaves the browser
        ↓
handlers.ts returns { token: "...", user: { ... } }
        ↓
Browser receives the response as if it came from a real server
        ↓
React continues normally — no code changes needed
```

| English | 中文 |
|---------|------|
| Requests appear as real network calls in DevTools (Network tab, Console). | 請求在開發者工具（Network 分頁、Console）中看起來像真實的網路呼叫。 |
| Works at the Service Worker level, so it doesn't need to patch `fetch` globally. | 在 Service Worker 層級運作，不需要全域 patch `fetch`。 |
| Handles both `fetch` and `XMLHttpRequest`. | 同時支援 `fetch` 和 `XMLHttpRequest`。 |
| Returns proper HTTP status codes (200, 401, 409, etc.). | 回傳正確的 HTTP 狀態碼（200、401、409 等）。 |

### What is localStorage? / 什麼是 localStorage？

**localStorage** is a browser-native key-value storage API that persists data on disk across page refreshes and browser restarts.

**localStorage** 是瀏覽器原生的鍵值對儲存 API，資料會持久化到磁碟，跨頁面重新整理和瀏覽器重新開啟都保留。

```js
// Writing a user account
localStorage.setItem('pqpm_users', JSON.stringify([
  { id: 'u_abc', username: 'alice', email: 'a@b.com', password: 'secret' }
]));

// Reading it back on page refresh
const users = JSON.parse(localStorage.getItem('pqpm_users') ?? '[]');
```

| English | 中文 |
|---------|------|
| Data survives page refresh and browser restart. | 資料在頁面重新整理和瀏覽器重新開啟後仍然存在。 |
| Scoped to the current origin (domain + port). | 範圍限定在目前來源（網域 + 埠）。 |
| Synchronous API — no `await` needed. | 同步 API —— 不需要 `await`。 |
| Stores strings only — objects must be `JSON.stringify`ed / `JSON.parse`d. | 只儲存字串 —— 物件必須 `JSON.stringify` / `JSON.parse`。 |

### Why use them TOGETHER? / 為什麼要一起用？

MSW and localStorage solve **different problems**. Using them together gives us the best of both worlds:

MSW 和 localStorage 解決**不同的問題**。將它們一起使用可以兼顧兩者的優點：

| | MSW alone | localStorage alone | MSW + localStorage |
|---|---|---|---|
| **Looks like a real API in DevTools** (Network tab shows actual requests) | ✅ | ❌ | ✅ |
| **Data survives page refresh** | ❌ | ✅ | ✅ |
| **Easy to swap for a real backend later** (just change env vars) | ✅ | ❌ | ✅ |
| **Works when deployed** (e.g. on Vercel) | ✅ | ⚠️ (depends on environment) | ✅ |

#### Breakdown / 詳細說明

| English | 中文 |
|---------|------|
| **MSW alone** — Mocks the API perfectly, but data lives only in memory. If you refresh the page, all registered users disappear. | **單獨使用 MSW** —— 完美模擬 API，但資料只在記憶體中。重新整理頁面後，所有註冊的使用者都會消失。 |
| **localStorage alone** — Data persists, but there's no API layer. Components would call `localStorage.getItem()` directly, making it impossible to swap for a real backend later. | **單獨使用 localStorage** —— 資料持久化，但沒有 API 層。元件會直接呼叫 `localStorage.getItem()`，使得之後無法切換到真實後端。 |
| **MSW + localStorage together** — MSW handles the API layer (intercepts `fetch`, returns proper HTTP responses), while localStorage handles persistence. The React components never know which one is backing the data. | **MSW + localStorage 一起使用** —— MSW 處理 API 層（攔截 `fetch`、回傳正確的 HTTP 回應），而 localStorage 處理持久化。React 元件從不知道資料背後是哪個機制。 |

### How it works step by step / 逐步說明

```
Step 1: User submits Register form
        ↓
Step 2: React calls apiRegister() → fetch('/api/auth/register')
        ↓
Step 3: MSW intercepts the fetch call (never hits any server)
        ↓
Step 4: handlers.ts reads localStorage ('pqpm_users')
        ↓
Step 5: Checks username uniqueness → writes new user to localStorage
        ↓
Step 6: Returns { success: true } with HTTP 201 status
        ↓
Step 7: React navigates to /login
        ↓
Step 8: User refreshes page
        ↓
Step 9: User submits Login form
        ↓
Step 10: Same flow — MSW intercepts → reads localStorage → finds user → returns token
        ↓
Step 11: Login succeeds because the user data survived the refresh (localStorage)
```

| English | 中文 |
|---------|------|
| **MSW** makes the frontend look like a real app talking to a real API. | **MSW** 讓前端看起來像一個正在與真實 API 溝通的真實應用程式。 |
| **localStorage** makes the data survive page refreshes. | **localStorage** 讓資料在頁面重新整理後仍然存在。 |
| Together, they enable a **fully demonstrable app with zero backend** — perfect for academic demos and classroom presentations. | 兩者結合，實現了一個**完全無需後端即可演示的應用程式** —— 非常適合學術演示和課堂展示。 |

### Why the token is in memory, not localStorage / 為什麼權杖在記憶體中而非 localStorage？

Per PRD §5.3 and §14 (Glossary), the JWT token is stored **only in React's `useState`** (in-memory), never in localStorage:

根據 PRD §5.3 和 §14（詞彙表），JWT 權杖**僅存在 React 的 `useState`**（記憶體中），永不寫入 localStorage：

```tsx
// AuthContext.tsx — token lives here, in memory only
const [token, setToken] = useState<string | null>(null);

// On login
setToken(session.token);  // ← in memory

// On logout
setToken(null);  // ← cleared, no trace anywhere
```

| English | 中文 |
|---------|------|
| Storing the JWT in localStorage would make it vulnerable to XSS attacks (any JavaScript on the page could read it). | 將 JWT 存在 localStorage 中會使其容易受到 XSS 攻擊（頁面上的任何 JavaScript 都可以讀取它）。 |
| In-memory storage means the token is automatically cleared on page refresh or tab close — the user must log in again. | 記憶體儲存意味著頁面重新整理或分頁關閉時權杖會自動清除 —— 使用者必須重新登入。 |
| This is the correct security practice for a demo app. | 這是示範應用程式的正確安全實踐。 |
| The *backend* team will handle real token storage (HttpOnly cookies) when implementing the cryptographic services. | *後端*團隊將在實作加密服務時處理真實的權杖儲存（HttpOnly cookies）。 |

---

## 8. localStorage User Store / localStorage 使用者儲存

### `src/api/userStore.ts`
**File:** `src/api/userStore.ts`  
**Lines:** 1–52

```ts
const USERS_KEY = 'pqpm_users';
const DEMO_USER: User = {
  id: 'u_demo',
  username: 'demo',
  email: 'demo@pqpm.local',
  password: 'password123',
  createdAt: new Date('2026-05-01T00:00:00Z').toISOString(),
};

export function readUsers(): User[] {
  try {
    const seeded = window.localStorage.getItem('pqpm_users_seeded');
    if (!seeded) {
      window.localStorage.setItem(USERS_KEY, JSON.stringify([DEMO_USER]));
      window.localStorage.setItem('pqpm_users_seeded', '1');
      return [DEMO_USER];
    }
    return JSON.parse(window.localStorage.getItem(USERS_KEY) ?? '[]');
  } catch {
    return memoryFallback; // storage blocked fallback
  }
}
```

| English | 中文 |
|---------|------|
| All user accounts live in `localStorage` under the key `pqpm_users`. | 所有使用者帳號都儲存在 `localStorage` 的 `pqpm_users` 鍵下。 |
| A demo account (`demo` / `password123`) is auto-seeded on first visit. | 示範帳號（`demo` / `password123`）在首次造訪時自動建立。 |
| `readUsers()` and `writeUsers()` are wrapped in try/catch so the app still works if localStorage is blocked (e.g. iframe). | `readUsers()` 與 `writeUsers()` 用 try/catch 包起來，即使 localStorage 被阻止（如 iframe 環境）也能正常運作。 |
| `generateId()` creates unique IDs combining random strings and timestamps. | `generateId()` 結合隨機字串與時間戳記產生唯一 ID。 |

---

## 9. Seed Data / 種子資料

### `src/api/seed.ts`
**File:** `src/api/seed.ts`  
**Lines:** 1–142

```ts
export const seedConversations: Conversation[] = [
  { id: 'c1', name: 'Alice Tan', initials: 'AT', color: 'teal', status: 'online',
    lastMessage: 'Did the post-quantum key exchange work?', lastMessageAt: minutesFromNow(-2), unread: 2 },
  { id: 'c2', name: 'Backend Team', initials: 'BT', color: 'slate', status: 'offline',
    lastMessage: 'Pushed the Dilithium signing endpoint 🎉', lastMessageAt: minutesFromNow(-35), unread: 0 },
  // ... 4 more conversations
];

export const seedMessages: Record<string, Message[]> = {
  c1: [
    msg('c1', 'received', 'Hey! Are you ready for the presentation?', -64),
    msg('c1', 'sent', 'Almost. Just finishing the slides.', -62),
    msg('c1', 'received', 'Nice. By the way, did the post-quantum key exchange work?', -2),
  ],
  // ... messages for c2-c6
};
```

| English | 中文 |
|---------|------|
| 6 pre-built conversations with realistic names and messages. | 6 個內建對話，具有真實的名稱與訊息。 |
| Messages use `minutesFromNow(offset)` to generate relative ISO timestamps. | 訊息使用 `minutesFromNow(offset)` 產生相對 ISO 時間戳記。 |
| Each conversation has avatar initials, a colour token, online/offline status, and unread count. | 每個對話都有頭像縮寫、色彩標記、線上/離線狀態和未讀計數。 |
| `seedSearchableUsers` powers the `/api/users/search` endpoint. | `seedSearchableUsers` 驅動 `/api/users/search` 端點。 |

---

## 10. Pages / 頁面

### `src/pages/Home.tsx` — Landing Page
**File:** `src/pages/Home.tsx`  
**Lines:** 1–192

```tsx
<section className={styles.hero}>
  <div className={styles.heroCopy}>
    <p className={styles.eyebrow}>Post-Quantum Privacy Messenger</p>
    <h1 className={styles.title}>Private conversations,<br />built for the <span className={styles.accent}>post-quantum</span> era.</h1>
    <p className={styles.subtitle}>A familiar, modern chat experience...</p>
    <div className={styles.heroActions}>
      <Link to="/register" className={styles.primaryBtnLg}>Get Started</Link>
      <Link to="/login" className={styles.ghostBtnLg}>Log in</Link>
    </div>
  </div>
  <div className={styles.mockup} aria-hidden="true">
    {/* Static chat UI mockup */}
  </div>
</section>
```

| English | 中文 |
|---------|------|
| Three sections: Hero, "Why use our platform" (3 feature cards), "How it works" (3 steps). | 三個區塊：Hero、"Why use our platform"（3 張功能卡片）、"How it works"（3 個步驟）。 |
| The hero contains a static chat mockup — a visual preview of the product. | Hero 包含一個靜態聊天模擬圖 —— 產品的視覺預覽。 |
| "How it works" uses `<ol>` with custom numbered badges (`.stepNum`) instead of browser-default numbers. | "How it works" 使用 `<ol>` 搭配自訂編號徽章（`.stepNum`），而非瀏覽器預設數字。 |
| Responsive: stacks to single column on mobile (≤ 900px). | 響應式：在手機版（≤ 900px）堆疊為單欄。 |

### `src/pages/Login.tsx` — Login Page
**File:** `src/pages/Login.tsx`  
**Lines:** 1–126

```tsx
<form className={styles.form} onSubmit={handleSubmit} noValidate>
  <input type="text" value={identifier} placeholder="e.g. demo" />
  <PasswordField label="Password" value={password} autoComplete="current-password" />
  {error && <p className={styles.errorText} role="alert">{error}</p>}
  <button type="submit" disabled={loading}>
    {loading ? 'Logging in…' : 'Log in'}
  </button>
</form>
```

| English | 中文 |
|---------|------|
| Accepts username OR email as the identifier field. | 接受使用者名稱或電子郵件作為識別欄位。 |
| Uses the `PasswordField` component with a show/hide toggle (PRD US-08). | 使用 `PasswordField` 元件，含顯示/隱藏切換（PRD US-08）。 |
| Shows inline error messages for wrong credentials (PRD US-07). | 顯示錯誤憑證的內嵌錯誤訊息（PRD US-07）。 |
| After successful login, redirects to the originally intended route (preserved in `location.state`). | 登入成功後，重新導向到原本要前往的路徑（保留在 `location.state` 中）。 |
| Displays demo credentials hint on the card. | 在卡片上顯示示範帳號提示。 |

### `src/pages/Register.tsx` — Registration Page
**File:** `src/pages/Register.tsx`  
**Lines:** 1–170

```tsx
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  if (!validate()) return;
  const result = await register(username.trim(), email.trim(), password);
  if (result.success) {
    navigate('/login', { state: { registered: true } });
  } else {
    setApiError(result.error ?? 'Registration failed.');
  }
}
```

| English | 中文 |
|---------|------|
| Client-side validation: username ≥ 3 chars, valid email, password ≥ 8 chars, confirm password match. | 客戶端驗證：使用者名稱 ≥ 3 字元、有效電子郵件、密碼 ≥ 8 字元、確認密碼相符。 |
| Calls `register()` from AuthContext, which routes through the API client → MSW handler. | 呼叫 AuthContext 中的 `register()`，該呼叫透過 API 客戶端 → MSW 處理常式路由。 |
| On success, navigates to `/login` with a `registered: true` flag to show a success banner. | 成功後導航至 `/login`，帶有 `registered: true` 旗標以顯示成功橫幅。 |
| On failure (duplicate username), shows the MSW handler's 409 error message. | 失敗時（重複使用者名稱），顯示 MSW 處理常式的 409 錯誤訊息。 |

### `src/pages/Profile.tsx` — Profile / Settings
**File:** `src/pages/Profile.tsx`  
**Lines:** 1–137

```tsx
<button className={styles.themeBtn} onClick={() => toggleTheme()}>
  <Sun size={18} /> <span>Light</span>
</button>
<button className={styles.themeBtn} onClick={() => toggleTheme()}>
  <Moon size={18} /> <span>Dark</span>
</button>
<button className={styles.logoutBtn} onClick={handleLogout}>
  <LogOut size={18} /> <span>Log out</span>
</button>
```

| English | 中文 |
|---------|------|
| Shows the authenticated user's name, username, and email. | 顯示已認證使用者的名稱、使用者名稱和電子郵件。 |
| Theme toggle buttons call `toggleTheme()` from `useTheme()`. | 主題切換按鈕呼叫 `useTheme()` 中的 `toggleTheme()`。 |
| Logout button calls `logout()` which clears the in-memory session and navigates to `/login`. | 登出按鈕呼叫 `logout()`，清除記憶體中的會話並導航至 `/login`。 |
| A "Security" card explains that the session token is memory-only. | 「安全性」卡片說明會話權杖僅存在記憶體中。 |

---

## 11. Chat Shell Components / 聊天殼層元件

### `src/pages/Chat.tsx` — The Main Chat Page
**File:** `src/pages/Chat.tsx`  
**Lines:** 1–145

```tsx
// Load conversation list once
useEffect(() => {
  getConversations().then(setConversations);
}, []);

// Load messages when active conversation changes
useEffect(() => {
  getMessages(activeId).then(setMessages);
}, [activeId]);

function handleSend() {
  const newMsg: Message = {
    id: `local-${Date.now()}`,
    conversationId: activeId,
    direction: 'sent',
    text: draft.trim(),
    at: new Date().toISOString(),
  };
  setMessages((prev) => [...prev, newMsg]); // optimistic append
  setDraft('');
}
```

| English | 中文 |
|---------|------|
| Two-pane layout: sidebar (conversation list) + chat area (header, thread, composer). | 雙欄佈局：側邊欄（對話列表）+ 聊天區（標題、訊息流、輸入框）。 |
| Loads conversations on mount, messages on active conversation change. | 掛載時載入對話，活躍對話改變時載入訊息。 |
| `handleSend()` does an **optimistic** append — the message appears instantly without waiting for a server response. | `handleSend()` 執行**樂觀更新** —— 訊息立即出現，不需要等待伺服器回應。 |
| Mobile responsive: shows only the list or only the thread at a time via `data-pane` attribute. | 手機版響應式：透過 `data-pane` 屬性一次只顯示列表或訊息流。 |
| Real-time WebSocket is deferred (PRD §2.2 Non-Goal). | 即時 WebSocket 功能延期（PRD §2.2 非目標）。 |

### `src/components/chat/Sidebar.tsx`
**File:** `src/components/chat/Sidebar.tsx`  
**Lines:** 1–143

```tsx
<div className={styles.search}>
  <Search size={16} className={styles.searchIcon} />
  <input
    id="chat-search"
    placeholder="Search chats or contacts"
    value={query}
    onChange={(e) => setQuery(e.target.value)}
  />
</div>
<ul>
  {filtered.map((c) => (
    <li key={c.id}>
      <button className={`${styles.item} ${c.id === activeId ? styles.active : ''}`}
              onClick={() => handleSelect(c.id)}>
        <Avatar initials={c.initials} color={c.color} name={c.name} online={c.status === 'online'} />
        <div className={styles.itemBody}>
          <span className={styles.itemName}>{c.name}</span>
          <span className={styles.itemTime}>{formatListTime(c.lastMessageAt)}</span>
          <span className={styles.itemPreview}>{c.lastMessage}</span>
          {c.unread > 0 && <span className={styles.badge}>{c.unread}</span>}
        </div>
      </button>
    </li>
  ))}
</ul>
```

| English | 中文 |
|---------|------|
| App header with logo, profile icon, settings icon. | 包含 Logo、個人資料圖示、設定圖示的應用程式標題列。 |
| Search input filters the conversation list by name (client-side). | 搜尋輸入框按名稱過濾對話列表（客戶端）。 |
| Each list item shows: avatar, name, last message preview, timestamp, unread badge. | 每個列表項目顯示：頭像、名稱、最後訊息預覽、時間戳記、未讀徽標。 |
| Active conversation is highlighted with `.active` class. | 活躍對話以 `.active` 類別高亮顯示。 |

### `src/components/chat/ChatHeader.tsx`
**File:** `src/components/chat/ChatHeader.tsx`  
**Lines:** 1–93

```tsx
<span className={styles.secured} title="This chat is secured" aria-label="Secured chat">
  <ShieldCheck size={16} />
</span>
```

| English | 中文 |
|---------|------|
| Shows contact avatar, name, online status. | 顯示聯絡人头像、名稱、線上狀態。 |
| Includes a "secured" lock icon to communicate privacy (PRD §1.2). | 包含「已保護」鎖形圖示以傳達隱私概念（PRD §1.2）。 |
| Back button appears only on mobile (≤ 767px). | 返回按鈕僅在手機版（≤ 767px）顯示。 |

### `src/components/chat/MessageBubble.tsx`
**File:** `src/components/chat/MessageBubble.tsx`  
**Lines:** 1–39

```tsx
<li className={styles.row} data-sent={sent ? 'true' : 'false'}>
  {showDateDivider && <div className={styles.divider}><span>{showDateDivider}</span></div>}
  <div className={`${styles.bubble} ${sent ? styles.sent : styles.received}`}>
    <p className={styles.text}>{message.text}</p>
    <time className={styles.time} dateTime={message.at}>
      {formatTime(message.at)}
    </time>
  </div>
</li>
```

| English | 中文 |
|---------|------|
| Sent messages get `.sent` class (right-aligned, tinted bubble). | 發送訊息取得 `.sent` 類別（右對齊、彩色氣泡）。 |
| Received messages get `.received` class (left-aligned, grey bubble). | 接收訊息取得 `.received` 類別（左對齊、灰色氣泡）。 |
| Date dividers ("Today", "Yesterday") are inserted between day groups. | 日期分隔線（"Today"、"Yesterday"）插入在每天的群組之間。 |

### `src/components/chat/MessageList.tsx`
**File:** `src/components/chat/MessageList.tsx`  
**Lines:** 1–69

```tsx
useEffect(() => {
  endRef.current?.scrollIntoView({ block: 'end' });
}, [messages]);
```

| English | 中文 |
|---------|------|
| Auto-scrolls to the bottom whenever messages change. | 訊息改變時自動捲動到底部。 |
| `role="log"` and `aria-live="polite"` for accessibility. | 使用 `role="log"` 與 `aria-live="polite"` 以符合無障礙標準。 |

### `src/components/chat/MessageInput.tsx`
**File:** `src/components/chat/MessageInput.tsx`  
**Lines:** 1–60

```tsx
function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    onSend();
  }
}
```

| English | 中文 |
|---------|------|
| Enter sends the message; Shift+Enter adds a new line. | Enter 發送訊息；Shift+Enter 換行。 |
| Textarea auto-resizes up to 160px height. | 文字區域自動調整高度，最高 160px。 |

### `src/components/PasswordField.tsx`
**File:** `src/components/PasswordField.tsx`  
**Lines:** 1–77

```tsx
<button type="button" onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}>
  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
</button>
```

| English | 中文 |
|---------|------|
| Toggle between `type="password"` and `type="text"` (PRD US-08). | 在 `type="password"` 與 `type="text"` 之間切換（PRD US-08）。 |
| `aria-label` and `aria-pressed` ensure screen reader accessibility. | `aria-label` 與 `aria-pressed` 確保螢幕閱讀器無障礙。 |

---

## 12. Routing & Guards / 路由與保護

### `src/App.tsx`
**File:** `src/App.tsx`  
**Lines:** 1–50

```tsx
<ThemeProvider>
  <AuthProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/chat" element={
          <SessionGuard><Chat /></SessionGuard>
        } />
        <Route path="/profile" element={
          <SessionGuard><Profile /></SessionGuard>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </AuthProvider>
</ThemeProvider>
```

| English | 中文 |
|---------|------|
| `ThemeProvider` wraps everything so all components can call `useTheme()`. | `ThemeProvider` 包裹一切，所有元件都能呼叫 `useTheme()`。 |
| `AuthProvider` wraps everything so all components can call `useAuth()`. | `AuthProvider` 包裹一切，所有元件都能呼叫 `useAuth()`。 |
| `SessionGuard` wraps `/chat` and `/profile` — redirects to `/login` if not authenticated. | `SessionGuard` 包裹 `/chat` 和 `/profile` —— 若未認證則重新導向至 `/login`。 |
| Catch-all `*` route redirects to the landing page. | 萬用路由 `*` 重新導向至首頁。 |

### `src/components/SessionGuard.tsx`
**File:** `src/components/SessionGuard.tsx`  
**Lines:** 1–20

```tsx
export function SessionGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
```

| English | 中文 |
|---------|------|
| Checks `isAuthenticated` from AuthContext. | 檢查 AuthContext 中的 `isAuthenticated`。 |
| Preserves the intended destination in `state.from` so the user lands on the right page after login. | 保留 `state.from` 中的意圖目的地，使登入後能到達正確頁面。 |

---

## 13. Data Flow Summary / 資料流程總結

### Registration Flow / 註冊流程

```
User fills Register form
       ↓
React calls register() from AuthContext
       ↓
AuthContext calls apiRegister() from api/client.ts
       ↓
client.ts calls fetch('/api/auth/register')
       ↓
MSW intercepts (because VITE_USE_MOCK=true)
       ↓
handlers.ts reads localStorage (userStore.ts)
       ↓
checks duplicate username → saves new user to localStorage
       ↓
returns { success: true }
       ↓
AuthContext navigates to /login
```

| English | 中文 |
|---------|------|
| Registration goes through the full API client → MSW → localStorage pipeline. | 註冊走過完整的 API 客戶端 → MSW → localStorage 流程。 |
| The user is persisted in `localStorage` under key `pqpm_users`. | 使用者儲存在 `localStorage` 的 `pqpm_users` 鍵下。 |
| No network request ever leaves the browser. | 沒有任何網路請求離開瀏覽器。 |

### Login Flow / 登入流程

```
User enters credentials
       ↓
AuthContext.login() calls apiLogin()
       ↓
MSW intercepts → handlers.ts reads localStorage
       ↓
Matches username/email + password
       ↓
Returns { token: "fake-jwt-...", user: { id, username, email } }
       ↓
AuthContext stores token + user in memory (useState)
       ↓
Navigates to /chat
```

| English | 中文 |
|---------|------|
| The fake JWT is stored in `useState` (memory only). | 假 JWT 儲存在 `useState` 中（僅記憶體）。 |
| Token is **never** written to localStorage (PRD §5.3). | 權杖**永不**寫入 localStorage（PRD §5.3）。 |
| On page refresh, the token is lost and the user is redirected to `/login`. | 頁面重新整理後，權杖消失，使用者被重新導向至 `/login`。 |

### Chat Message Send Flow / 聊天訊息發送流程

```
User types message + presses Enter
       ↓
MessageInput triggers handleSend()
       ↓
Creates a local Message object with direction: 'sent'
       ↓
Optimistically appends to messages state
       ↓
Updates the sidebar conversation preview
       ↓
(no server call — WebSocket is deferred, PRD §2.2)
```

| English | 中文 |
|---------|------|
| Messages are sent optimistically — they appear instantly. | 訊息以樂觀方式發送 —— 立即出現。 |
| No server round-trip because real-time WebSocket is a Non-Goal. | 沒有伺服器往返，因為即時 WebSocket 是非目標。 |
| When the real backend is connected, `handleSend()` will call the API client. | 當連接真實後端時，`handleSend()` 將呼叫 API 客戶端。 |

---

## File Tree / 檔案樹

```
src/
├── main.tsx                  # Entry point; bootstraps MSW worker
├── App.tsx                   # Router + providers (Theme, Auth, SessionGuard)
├── index.css                 # Global styles + design tokens (light/dark)
│
├── types/
│   └── index.ts              # User, PublicUser, Conversation, Message, etc.
│
├── context/
│   ├── AuthContext.tsx       # login/register/logout + in-memory JWT
│   └── ThemeContext.tsx     # light/dark toggle + localStorage persistence
│
├── api/
│   ├── browser.ts            # MSW setupWorker
│   ├── handlers.ts           # All mock API endpoint handlers
│   ├── client.ts             # API client — single seam (mock ↔ real)
│   ├── userStore.ts          # localStorage CRUD for user accounts
│   └── seed.ts               # Hardcoded conversations, messages, search users
│
├── components/
│   ├── SessionGuard.tsx      # Route guard for /chat, /profile
│   ├── Avatar.tsx            # Circular initials avatar with online dot
│   ├── PasswordField.tsx     # Password input with show/hide toggle
│   └── chat/
│       ├── Sidebar.tsx       # App header + search + conversation list
│       ├── ChatHeader.tsx    # Contact avatar, name, status, secured icon
│       ├── MessageBubble.tsx # Individual message with sent/received styling
│       ├── MessageList.tsx   # Scrollable thread with date dividers
│       └── MessageInput.tsx  # Textarea + send button, Enter to send
│
└── pages/
    ├── Home.tsx              # Landing page (hero, features, steps)
    ├── Login.tsx             # Mock login form
    ├── Register.tsx          # Mock registration form with validation
    ├── Chat.tsx              # Two-pane chat shell
    └── Profile.tsx           # User info, theme toggle, logout
```

---

## How to Swap to a Real Backend / 如何切換到真實後端

Per PRD §5.3, only two changes are needed:

根據 PRD §5.3，只需兩個變更：

```diff
# .env
-VITE_USE_MOCK=true
+VITE_USE_MOCK=false

-VITE_API_BASE_URL=http://localhost:8080
+VITE_API_BASE_URL=https://your-backend.example.com
```

| English | 中文 |
|---------|------|
| `VITE_USE_MOCK=false` tells `api/client.ts` to use the real base URL. | `VITE_USE_MOCK=false` 告訴 `api/client.ts` 使用真實的基礎 URL。 |
| The MSW worker is never started (skipped in `main.tsx`). | MSW worker 永遠不會啟動（在 `main.tsx` 中被跳過）。 |
| All React components, types, and routing remain unchanged. | 所有 React 元件、型別和路由保持不變。 |

---

*Generated for PQPM Frontend v2.0 · June 2026*  
*為 PQPM 前端 v2.0 生成 · 2026 年 6 月*
