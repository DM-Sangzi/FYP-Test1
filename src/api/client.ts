/**
 * API client — the single seam between the UI and the data source (PRD §5.3).
 *
 * When `VITE_USE_MOCK=true` (default), every call is intercepted by MSW and
 * answered from localStorage/seed data, so the app runs with no backend.
 * When `VITE_USE_MOCK=false`, the same calls hit `VITE_API_BASE_URL`.
 * React components import these functions only — they never know which mode
 * is active, which is what makes the backend swap a config-only change.
 *
 * Caller identity: AuthContext stores the in-memory session token here via
 * setAuthToken(); friend/search/settings endpoints attach it as
 * `Authorization: Bearer`. The mock handlers decode the payload's `sub` to
 * identify the caller — this is identity marking for the demo, NOT signature
 * verification.
 */
import type {
  AuthSession,
  Conversation,
  FriendEntry,
  FriendRequestsOverview,
  LoginResult,
  Message,
  PeopleResult,
  PublicUser,
  TwoFactorEnrollmentStart,
  TwoFactorStatus,
} from '../types';

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
const BASE_URL = String(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

let authToken: string | null = null;

/** AuthContext sets the in-memory session token (cleared on logout). */
export function setAuthToken(token: string | null): void {
  authToken = token;
}

function authHeaders(): Record<string, string> {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

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
    // ApiError so callers can distinguish API errors with `instanceof`
    // (AuthContext re-exports this class for compatibility).
    throw new ApiError(message, res.status);
  }
  return body as T;
}

function post<T>(path: string, body?: unknown, withAuth = false): Promise<T> {
  return fetch(url(path), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(withAuth ? authHeaders() : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then(parse<T>);
}

/** Error thrown by the API client when the server returns a non-2xx status. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

/** Password login step. Accounts with 2FA enabled resolve to a challenge —
 *  the session is only issued by verifyTwoFactorLogin(). */
export async function login(identifier: string, password: string): Promise<LoginResult> {
  return post<LoginResult>('/api/auth/login', { identifier, password });
}

export async function register(
  username: string,
  email: string,
  password: string,
): Promise<{ success: true }> {
  return post<{ success: true }>('/api/auth/register', { username, email, password });
}

export async function logout(): Promise<{ success: true }> {
  return post<{ success: true }>('/api/auth/logout');
}

/* ------------------------------------------------------------------ */
/* Two-factor authentication                                           */
/* ------------------------------------------------------------------ */

export async function verifyTwoFactorLogin(
  challengeId: string,
  payload: { code?: string; recoveryCode?: string },
): Promise<AuthSession> {
  return post<AuthSession>('/api/auth/2fa/verify', { challengeId, ...payload });
}

/** Revokes the challenge server-side (Login Back/Cancel). */
export async function cancelLoginChallenge(challengeId: string): Promise<{ success: true }> {
  return post<{ success: true }>('/api/auth/2fa/challenge/cancel', { challengeId });
}

export async function getTwoFactorStatus(): Promise<TwoFactorStatus> {
  const res = await fetch(url('/api/auth/2fa/status'), { headers: authHeaders() });
  return parse<TwoFactorStatus>(res);
}

export async function startTwoFactorEnrollment(
  password: string,
): Promise<TwoFactorEnrollmentStart> {
  return post<TwoFactorEnrollmentStart>('/api/auth/2fa/enrollment/start', { password }, true);
}

/** Returns the plaintext recovery codes exactly once. */
export async function verifyTwoFactorEnrollment(
  code: string,
): Promise<{ recoveryCodes: string[] }> {
  return post<{ recoveryCodes: string[] }>('/api/auth/2fa/enrollment/verify', { code }, true);
}

export async function cancelTwoFactorEnrollment(): Promise<{ success: true }> {
  return post<{ success: true }>('/api/auth/2fa/enrollment/cancel', undefined, true);
}

export async function disableTwoFactor(payload: {
  password: string;
  code?: string;
  recoveryCode?: string;
}): Promise<{ success: true; usedRecoveryCode?: boolean }> {
  return post('/api/auth/2fa/disable', payload, true);
}

/** Returns the new plaintext recovery codes exactly once. */
export async function regenerateRecoveryCodes(payload: {
  password: string;
  code: string;
}): Promise<{ recoveryCodes: string[] }> {
  return post<{ recoveryCodes: string[] }>(
    '/api/auth/2fa/recovery-codes/regenerate',
    payload,
    true,
  );
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

/* ------------------------------------------------------------------ */
/* People & friends                                                    */
/* ------------------------------------------------------------------ */

/** Directory search: real accounts (login-capable) + sample contacts, each
 *  with the caller's relationship to that entry. */
export async function searchPeople(q: string): Promise<PeopleResult[]> {
  const res = await fetch(url(`/api/users/search?q=${encodeURIComponent(q)}`), {
    headers: authHeaders(),
  });
  return parse<PeopleResult[]>(res);
}

/** The signed-in user's friends — derived from persisted friendships, so the
 *  list survives re-login without depending on request history. */
export async function getFriends(): Promise<FriendEntry[]> {
  const res = await fetch(url('/api/friends'), { headers: authHeaders() });
  return parse<FriendEntry[]>(res);
}

export async function getFriendRequests(): Promise<FriendRequestsOverview> {
  const res = await fetch(url('/api/friend-requests'), { headers: authHeaders() });
  return parse<FriendRequestsOverview>(res);
}

export async function sendFriendRequest(
  toUserId: string,
): Promise<{ requestId: string; toUser: { id: string; username: string } }> {
  return post('/api/friend-requests', { toUserId }, true);
}

export type FriendRequestAction = 'accept' | 'decline' | 'cancel';

export async function respondToFriendRequest(
  requestId: string,
  action: FriendRequestAction,
): Promise<{ success: true; friend?: { id: string; username: string } }> {
  return post(`/api/friend-requests/${encodeURIComponent(requestId)}/${action}`, undefined, true);
}

/** Expose the current user to non-auth callers (e.g. chat avatar initials). */
export type { PublicUser };
