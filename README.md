# PQPM — Post-Quantum Privacy Messenger (Frontend Web)

A neutral, modern, web-based messaging interface for **PQPM**, built with React + TypeScript + Vite. It provides a familiar Telegram / WhatsApp Web–style chat experience and communicates that the platform is privacy-focused and secure.

This is the **frontend layer only** of a Final Year Group Project. The backend cryptographic engine (Kyber KEM, Dilithium signing, key management) is handled by other team members. During the UI development phase the app runs fully standalone using an **MSW + localStorage mock layer** that can be swapped for a real backend later with no component code changes.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 |
| Language | TypeScript |
| Styling | CSS Modules + CSS custom properties (light/dark) |
| Routing | React Router v6 |
| Mock API | MSW (Mock Service Worker) |
| Data persistence | localStorage (only inside MSW handlers) |
| Auth state | React Context (in-memory JWT, never in localStorage) |
| Build tool | Vite |
| Icons | Lucide React |

## Getting started

```bash
npm install
npm run dev
```

The app starts on http://localhost:5173. MSW is enabled by default (`VITE_USE_MOCK=true`), so the full Register → Login → Chat flow works without any backend.

## Scripts

- `npm run dev` — start the Vite dev server
- `npm run build` — type-check and build for production
- `npm run preview` — preview the production build locally
- `npm run typecheck` — TypeScript type-check only

## Switching to a real backend

When the backend is ready, only two environment changes are needed (see PRD §5.3):

1. Set `VITE_USE_MOCK=false` in `.env`
2. Set `VITE_API_BASE_URL=http://localhost:8080` (or production URL)

All React components, forms, and routing remain unchanged.

## Routes

| Page | Route |
|------|-------|
| Home / Landing | `/` |
| Login | `/login` |
| Register | `/register` |
| Chat shell | `/chat` (auth required) |
| Profile / Settings | `/profile` (auth required) |

## Layout

```
src/
├── main.tsx                 # App entry; starts MSW in mock mode
├── App.tsx                  # Router + route definitions
├── index.css                # Global styles + design tokens (light/dark)
├── types/                   # Shared TypeScript types
├── context/                 # AuthContext, ThemeContext
├── api/                     # API client + MSW handlers + seed data
├── components/              # Shared UI (SessionGuard, PasswordField, icons)
└── pages/                   # Home, Login, Register, Chat, Profile
```

---
Frontend PRD v2.0 · 26-6-2026
