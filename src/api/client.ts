/**
 * API client — the single seam between the UI and the data source (PRD §5.3).
 *
 * When `VITE_USE_MOCK=true` (default), every call is intercepted by MSW and
 * answered from localStorage/seed data, so the app runs with no backend.
 * When `VITE_USE_MOCK=false`, the same calls hit `VITE_API_BASE_URL`.
 * React components import these functions only — they never know which mode
 * is active, which is what makes the backend swap a config-only change.
 */
import type {
  AuthSession,
  Conversation,
  Message,
  PublicUser,
  UserSearchResult,
} from '../types';

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
const BASE_URL = String(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

/** Prefixes a path with the real backend base URL (unused in mock mode). */
function url(path: string): string {
  return USE_MOCK ? path : `${BASE_URL}${path}`;
}

async function parse<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      (body && typeof body === 'object' && 'error' in body && String(body.error)) ||
      `Request failed (${res.status})`;
    const err = new Error(message) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  return body as T;
}

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

export async function login(identifier: string, password: string): Promise<AuthSession> {
  const res = await fetch(url('/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  return parse<AuthSession>(res);
}

export async function register(
  username: string,
  email: string,
  password: string,
): Promise<{ success: true }> {
  const res = await fetch(url('/api/auth/register'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  });
  return parse(res);
}

export async function logout(): Promise<{ success: true }> {
  const res = await fetch(url('/api/auth/logout'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  return parse(res);
}

/* ------------------------------------------------------------------ */
/* Conversations & messages                                            */
/* ------------------------------------------------------------------ */

export async function getConversations(): Promise<Conversation[]> {
  const res = await fetch(url('/api/conversations'));
  return parse<Conversation[]>(res);
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const res = await fetch(url(`/api/conversations/${conversationId}/messages`));
  return parse<Message[]>(res);
}

export async function searchUsers(q: string): Promise<UserSearchResult[]> {
  const res = await fetch(url(`/api/users/search?q=${encodeURIComponent(q)}`));
  return parse<UserSearchResult[]>(res);
}

/** Expose the current user to non-auth callers (e.g. chat avatar initials). */
export type { PublicUser };
