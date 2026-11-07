/**
 * MSW request handlers — the entire mock backend (PRD §5.3).
 *
 * These intercept fetch calls at the Service Worker level so the requests
 * appear as real network traffic in DevTools. Auth users are persisted via
 * the localStorage user store; conversations/messages are served from seed
 * data; friend requests/friendships live in the social store.
 *
 * Caller identity: friend/search/settings endpoints require
 * `Authorization: Bearer fake-jwt.<base64 payload>.mock-signature` and
 * decode the payload's `sub`. This identifies the caller for the mock demo —
 * it is NOT signature verification; a real backend must validate tokens.
 *
 * Two-factor authentication (RFC 6238 TOTP via otpauth):
 *  - accounts with `twoFactor.enabled` only receive a short-lived challenge
 *    from /api/auth/login — never a session — until the second factor (TOTP
 *    or a single-use recovery code) verifies;
 *  - challenge ids are unpredictable, bound to one account, expire, count
 *    failed attempts and are revoked on success/cancel/expiry;
 *  - sensitive operations (enrollment, disable, regenerate) require the
 *    password again plus a current second factor, and are subject to an
 *    account-level failure window;
 *  - secrets, provisioning URIs and recovery codes never appear in any
 *    listing/search response and are never logged.
 *
 * Mock limitations (declared, not hidden): challenge and lockout state live
 * in this module's memory (per tab, reset by refresh); localStorage is the
 * trust anchor; a real backend must do signed tokens, server-side secrets
 * and server-side rate limiting — VITE_USE_MOCK=false alone provides none
 * of that.
 *
 * To swap in a real backend later: set `VITE_USE_MOCK=false` (PRD §5.3).
 */
import { http, HttpResponse, delay } from 'msw';
import { HOTP, Secret } from 'otpauth';
import type {
  AuthSession,
  Conversation,
  Message,
  PeopleResult,
  PublicUser,
  User,
} from '../types';
import { readUsers, writeUsers, generateId, UserStoreError } from './userStore';
import { seedConversations, seedMessages, seedSearchableUsers } from './seed';
import {
  SocialStoreError,
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  listFriendRequests,
  listFriends,
  relationshipBetween,
  sendFriendRequest,
} from './socialStore';
import {
  generateTotpSecret,
  generateRecoveryCodes,
  generateUnpredictableId,
  normalizeRecoveryCode,
  normalizeTotpCode,
  sha256Hex,
} from './twoFactor';

const BASE = '/api';

function stripPrivate(u: User): PublicUser {
  return { id: u.id, username: u.username, email: u.email };
}

function makeToken(user: PublicUser): string {
  // A fake, opaque JWT-shaped token. Real signing happens on the backend.
  const payload = btoa(JSON.stringify({ sub: user.id, name: user.username, iat: Date.now() }));
  return `fake-jwt.${payload}.mock-signature`;
}

/* ------------------------------------------------------------------ */
/* Caller identity                                                     */
/* ------------------------------------------------------------------ */

/** Extracts the account behind the request's Authorization header, or null
 *  when the header is missing, malformed, undecodable, or the `sub` does not
 *  match any account. */
function getCaller(request: Request): User | null {
  const header = request.headers.get('authorization') ?? '';
  const match = /^Bearer fake-jwt\.([A-Za-z0-9+/=]+)\.mock-signature$/.exec(header);
  if (!match) return null;
  let sub: unknown;
  try {
    const payload = JSON.parse(atob(match[1])) as { sub?: unknown };
    sub = payload.sub;
  } catch {
    return null;
  }
  if (typeof sub !== 'string' || sub.length === 0) return null;
  return readUsers().find((u) => u.id === sub) ?? null;
}

const unauthorized = () => HttpResponse.json({ error: 'Not signed in.' }, { status: 401 });

/** Maps store errors to HTTP responses; returns null for other errors. */
function storeErrorResponse(err: unknown): Response | null {
  if (err instanceof SocialStoreError || err instanceof UserStoreError) {
    return HttpResponse.json({ error: err.message }, { status: err.status });
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* TOTP verification (RFC 6238 = HOTP with the time counter)           */
/* ------------------------------------------------------------------ */

const TOTP_PERIOD_SECONDS = 30;

function currentCounter(): number {
  return Math.floor(Date.now() / 1000 / TOTP_PERIOD_SECONDS);
}

/** Verifies a 6-digit TOTP with a ±1 step clock-drift window. Returns the
 *  matched counter (for replay checks) or null. Built on otpauth's RFC 4226
 *  HOTP so the matched timestep is explicit and testable. */
function verifyTotp(secret: string, code: string): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const hotp = new HOTP({ secret: Secret.fromBase32(secret), algorithm: 'SHA1', digits: 6 });
  const now = currentCounter();
  for (const counter of [now - 1, now, now + 1]) {
    if (hotp.generate({ counter }) === code) return counter;
  }
  return null;
}

function provisioningUri(username: string, secret: string): string {
  return `otpauth://totp/${encodeURIComponent(`PQPM:${username}`)}?secret=${secret}&issuer=PQPM&algorithm=SHA1&digits=6&period=${TOTP_PERIOD_SECONDS}`;
}

/* ------------------------------------------------------------------ */
/* Login challenges + sensitive-operation failure windows (in memory)  */
/* ------------------------------------------------------------------ */

interface LoginChallengeEntry {
  accountId: string;
  expiresAt: number;
  attempts: number;
}

const loginChallenges = new Map<string, LoginChallengeEntry>();
const CHALLENGE_TTL_MS = 5 * 60_000;
const MAX_CHALLENGE_ATTEMPTS = 5;

const ENROLLMENT_TTL_MS = 10 * 60_000;
const MAX_ENROLLMENT_ATTEMPTS = 5;
const RECOVERY_CODE_COUNT = 10;

const sensitiveFailures = new Map<string, { count: number; windowStart: number }>();
const SENSITIVE_WINDOW_MS = 10 * 60_000;
const MAX_SENSITIVE_FAILURES = 5;

function sensitiveLocked(accountId: string): boolean {
  const f = sensitiveFailures.get(accountId);
  if (!f) return false;
  if (Date.now() - f.windowStart > SENSITIVE_WINDOW_MS) {
    sensitiveFailures.delete(accountId);
    return false;
  }
  return f.count >= MAX_SENSITIVE_FAILURES;
}

function recordSensitiveFailure(accountId: string): void {
  const f = sensitiveFailures.get(accountId);
  if (!f || Date.now() - f.windowStart > SENSITIVE_WINDOW_MS) {
    sensitiveFailures.set(accountId, { count: 1, windowStart: Date.now() });
    return;
  }
  f.count += 1;
}

function clearSensitiveFailures(accountId: string): void {
  sensitiveFailures.delete(accountId);
}

/** Live-challenge lookup; expired challenges are revoked on sight. */
function getLiveChallenge(challengeId: string): LoginChallengeEntry | null {
  const entry = loginChallenges.get(challengeId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    loginChallenges.delete(challengeId);
    return null;
  }
  return entry;
}

const challengeInvalid = () =>
  HttpResponse.json(
    { error: 'This sign-in attempt expired or is no longer valid. Please log in again.' },
    { status: 400 },
  );

const locked = () =>
  HttpResponse.json(
    { error: 'Too many attempts. Please wait a few minutes and try again.' },
    { status: 403 },
  );

export const handlers = [
  /* ------------------------------------------------------------------ */
  /* Auth                                                                */
  /* ------------------------------------------------------------------ */

  // POST /api/auth/register
  http.post(`${BASE}/auth/register`, async ({ request }) => {
    await delay(250);
    const body = (await request.json()) as {
      username?: string;
      email?: string;
      password?: string;
    };

    const username = (body.username ?? '').trim();
    const email = (body.email ?? '').trim();
    const password = body.password ?? '';

    if (!username || !email || !password) {
      return HttpResponse.json(
        { error: 'All fields are required.' },
        { status: 400 },
      );
    }
    if (username.length < 3) {
      return HttpResponse.json(
        { error: 'Username must be at least 3 characters.' },
        { status: 400 },
      );
    }
    if (password.length < 8) {
      return HttpResponse.json(
        { error: 'Password must be at least 8 characters.' },
        { status: 400 },
      );
    }

    try {
      const users = readUsers();
      const usernameTaken = users.some(
        (u) => u.username.toLowerCase() === username.toLowerCase(),
      );
      if (usernameTaken) {
        // PRD US-09: clear error when username already taken.
        return HttpResponse.json(
          { error: 'That username is already taken.' },
          { status: 409 },
        );
      }

      const newUser: User = {
        id: generateId(),
        username,
        email,
        password,
        createdAt: new Date().toISOString(),
      };
      writeUsers([...users, newUser]);

      return HttpResponse.json({ success: true }, { status: 201 });
    } catch (err) {
      const res = storeErrorResponse(err);
      if (res) return res;
      throw err;
    }
  }),

  // POST /api/auth/login — password step. Accounts with 2FA enabled get a
  // short-lived challenge instead of a session; there is deliberately no
  // token or user in that response.
  http.post(`${BASE}/auth/login`, async ({ request }) => {
    await delay(250);
    const body = (await request.json()) as {
      identifier?: string;
      username?: string;
      email?: string;
      password?: string;
    };

    // The login form posts either `identifier` (username OR email) or a
    // dedicated username/email field — accept all shapes for flexibility.
    const identifier =
      (body.identifier ?? body.username ?? body.email ?? '').trim().toLowerCase();
    const password = body.password ?? '';

    if (!identifier || !password) {
      return HttpResponse.json(
        { error: 'Please enter your credentials.' },
        { status: 400 },
      );
    }

    try {
      const users = readUsers();
      const match = users.find(
        (u) =>
          u.username.toLowerCase() === identifier ||
          u.email.toLowerCase() === identifier,
      );

      // PRD US-07: clear, non-revealing error for wrong credentials.
      if (!match || match.password !== password) {
        return HttpResponse.json(
          { error: 'Wrong username or password' },
          { status: 401 },
        );
      }

      const pub = stripPrivate(match);
      if (match.twoFactor?.enabled) {
        const challengeId = generateUnpredictableId();
        const expiresAt = Date.now() + CHALLENGE_TTL_MS;
        loginChallenges.set(challengeId, {
          accountId: match.id,
          expiresAt,
          attempts: 0,
        });
        return HttpResponse.json(
          {
            challenge: {
              challengeId,
              username: pub.username,
              expiresAt: new Date(expiresAt).toISOString(),
            },
          },
          { status: 200 },
        );
      }

      const session: AuthSession = { token: makeToken(pub), user: pub };
      return HttpResponse.json(session, { status: 200 });
    } catch (err) {
      const res = storeErrorResponse(err);
      if (res) return res;
      throw err;
    }
  }),

  // POST /api/auth/logout
  http.post(`${BASE}/auth/logout`, async () => {
    await delay(120);
    return HttpResponse.json({ success: true }, { status: 200 });
  }),

  /* ------------------------------------------------------------------ */
  /* Two-factor authentication                                           */
  /* ------------------------------------------------------------------ */

  // GET /api/auth/2fa/status — never contains secrets.
  http.get(`${BASE}/auth/2fa/status`, async ({ request }) => {
    await delay(100);
    const caller = getCaller(request);
    if (!caller) return unauthorized();
    try {
      const enabled = caller.twoFactor?.enabled === true;
      return HttpResponse.json(
        {
          enabled,
          recoveryCodesRemaining: enabled ? (caller.twoFactor?.recoveryHashes.length ?? 0) : 0,
        },
        { status: 200 },
      );
    } catch (err) {
      const res = storeErrorResponse(err);
      if (res) return res;
      throw err;
    }
  }),

  // POST /api/auth/2fa/enrollment/start — password re-check; refused when
  // 2FA is already enabled (changing authenticator = disable first).
  http.post(`${BASE}/auth/2fa/enrollment/start`, async ({ request }) => {
    await delay(200);
    const caller = getCaller(request);
    if (!caller) return unauthorized();
    const body = (await request.json().catch(() => ({}))) as { password?: string };

    try {
      if (sensitiveLocked(caller.id)) return locked();
      const users = readUsers();
      const user = users.find((u) => u.id === caller.id);
      if (!user) return unauthorized();
      if (body.password !== user.password) {
        recordSensitiveFailure(caller.id);
        return HttpResponse.json({ error: 'Wrong password.' }, { status: 401 });
      }
      if (user.twoFactor?.enabled) {
        return HttpResponse.json(
          {
            error:
              'Two-factor authentication is already enabled. Disable it first to set up a new authenticator.',
          },
          { status: 409 },
        );
      }

      const secret = generateTotpSecret();
      const expiresAt = new Date(Date.now() + ENROLLMENT_TTL_MS).toISOString();
      user.twoFactor = {
        enabled: false,
        secret: '',
        confirmedAt: '',
        lastUsedCounter: -1,
        recoveryHashes: [],
        enrollment: { secret, expiresAt, failedAttempts: 0 },
      };
      writeUsers(users);
      clearSensitiveFailures(caller.id);

      return HttpResponse.json(
        {
          otpauthUri: provisioningUri(user.username, secret),
          secret,
          expiresAt,
        },
        { status: 200 },
      );
    } catch (err) {
      const res = storeErrorResponse(err);
      if (res) return res;
      throw err;
    }
  }),

  // POST /api/auth/2fa/enrollment/verify — only this promotes to enabled and
  // issues the one-time recovery codes.
  http.post(`${BASE}/auth/2fa/enrollment/verify`, async ({ request }) => {
    await delay(200);
    const caller = getCaller(request);
    if (!caller) return unauthorized();
    const body = (await request.json().catch(() => ({}))) as { code?: string };

    try {
      if (sensitiveLocked(caller.id)) return locked();
      const users = readUsers();
      const user = users.find((u) => u.id === caller.id);
      const tf = user?.twoFactor;
      if (!user || !tf?.enrollment) {
        return HttpResponse.json(
          { error: 'No two-factor setup is in progress.' },
          { status: 400 },
        );
      }
      if (new Date(tf.enrollment.expiresAt).getTime() < Date.now()) {
        tf.enrollment = null;
        if (!tf.enabled) delete (user as { twoFactor?: unknown }).twoFactor;
        writeUsers(users);
        return HttpResponse.json(
          { error: 'This setup expired. Start again.' },
          { status: 400 },
        );
      }
      if (tf.enrollment.failedAttempts >= MAX_ENROLLMENT_ATTEMPTS) {
        tf.enrollment = null;
        if (!tf.enabled) delete (user as { twoFactor?: unknown }).twoFactor;
        writeUsers(users);
        return HttpResponse.json(
          { error: 'Too many incorrect codes. Start the setup again.' },
          { status: 403 },
        );
      }

      const counter = verifyTotp(tf.enrollment.secret, normalizeTotpCode(body.code ?? ''));
      if (counter === null) {
        tf.enrollment.failedAttempts += 1;
        recordSensitiveFailure(caller.id);
        writeUsers(users);
        return HttpResponse.json(
          { error: "That code didn't match. Try the next one." },
          { status: 401 },
        );
      }

      const recoveryCodes = generateRecoveryCodes(RECOVERY_CODE_COUNT);
      const recoveryHashes = await Promise.all(
        recoveryCodes.map((c) => sha256Hex(normalizeRecoveryCode(c))),
      );
      user.twoFactor = {
        enabled: true,
        secret: tf.enrollment.secret,
        confirmedAt: new Date().toISOString(),
        lastUsedCounter: counter,
        recoveryHashes,
        enrollment: null,
      };
      writeUsers(users);
      clearSensitiveFailures(caller.id);

      // Plaintext codes are returned exactly once and never stored.
      return HttpResponse.json({ recoveryCodes }, { status: 200 });
    } catch (err) {
      const res = storeErrorResponse(err);
      if (res) return res;
      throw err;
    }
  }),

  // POST /api/auth/2fa/enrollment/cancel — clears pending setup; an enabled
  // 2FA is never touched here.
  http.post(`${BASE}/auth/2fa/enrollment/cancel`, async ({ request }) => {
    await delay(120);
    const caller = getCaller(request);
    if (!caller) return unauthorized();
    try {
      const users = readUsers();
      const user = users.find((u) => u.id === caller.id);
      if (user?.twoFactor?.enrollment) {
        if (user.twoFactor.enabled) user.twoFactor.enrollment = null;
        else delete (user as { twoFactor?: unknown }).twoFactor;
        writeUsers(users);
      }
      return HttpResponse.json({ success: true }, { status: 200 });
    } catch (err) {
      const res = storeErrorResponse(err);
      if (res) return res;
      throw err;
    }
  }),

  // POST /api/auth/2fa/verify — second login step. Consumes the challenge on
  // success; enforces attempt limits and replay protection.
  http.post(`${BASE}/auth/2fa/verify`, async ({ request }) => {
    await delay(200);
    const body = (await request.json().catch(() => ({}))) as {
      challengeId?: string;
      code?: string;
      recoveryCode?: string;
    };
    const challengeId = body.challengeId ?? '';
    const entry = getLiveChallenge(challengeId);
    if (!entry) return challengeInvalid();

    try {
      const users = readUsers();
      const user = users.find((u) => u.id === entry.accountId);
      if (!user?.twoFactor?.enabled) return challengeInvalid();
      const tf = user.twoFactor;

      if (body.recoveryCode !== undefined && body.recoveryCode !== '') {
        // Recovery path: single use — the matching hash is removed.
        const hash = await sha256Hex(normalizeRecoveryCode(body.recoveryCode));
        const idx = tf.recoveryHashes.indexOf(hash);
        if (idx === -1) {
          entry.attempts += 1;
          if (entry.attempts >= MAX_CHALLENGE_ATTEMPTS) {
            loginChallenges.delete(challengeId);
            return HttpResponse.json(
              { error: 'Too many attempts. Please log in again.' },
              { status: 403 },
            );
          }
          return HttpResponse.json(
            { error: "That recovery code didn't match." },
            { status: 401 },
          );
        }
        tf.recoveryHashes.splice(idx, 1);
        writeUsers(users);
        loginChallenges.delete(challengeId);
        const session: AuthSession = { token: makeToken(stripPrivate(user)), user: stripPrivate(user) };
        return HttpResponse.json(session, { status: 200 });
      }

      const counter = verifyTotp(tf.secret, normalizeTotpCode(body.code ?? ''));
      if (counter === null) {
        entry.attempts += 1;
        if (entry.attempts >= MAX_CHALLENGE_ATTEMPTS) {
          loginChallenges.delete(challengeId);
          return HttpResponse.json(
            { error: 'Too many attempts. Please log in again.' },
            { status: 403 },
          );
        }
        return HttpResponse.json(
          { error: "That code didn't match. Try the next one." },
          { status: 401 },
        );
      }
      if (counter <= tf.lastUsedCounter) {
        return HttpResponse.json(
          { error: 'That code was already used. Wait for the next one and try again.' },
          { status: 401 },
        );
      }
      tf.lastUsedCounter = counter;
      writeUsers(users);
      loginChallenges.delete(challengeId);
      const session: AuthSession = { token: makeToken(stripPrivate(user)), user: stripPrivate(user) };
      return HttpResponse.json(session, { status: 200 });
    } catch (err) {
      const res = storeErrorResponse(err);
      if (res) return res;
      throw err;
    }
  }),

  // POST /api/auth/2fa/challenge/cancel — revokes the challenge server-side
  // (Login "Back"/"Cancel" calls this; idempotent).
  http.post(`${BASE}/auth/2fa/challenge/cancel`, async ({ request }) => {
    await delay(80);
    const body = (await request.json().catch(() => ({}))) as { challengeId?: string };
    if (body.challengeId) loginChallenges.delete(body.challengeId);
    return HttpResponse.json({ success: true }, { status: 200 });
  }),

  // POST /api/auth/2fa/disable — password + current TOTP, or password +
  // an unused recovery code (phone-lost path). The recovery code is consumed.
  http.post(`${BASE}/auth/2fa/disable`, async ({ request }) => {
    await delay(200);
    const caller = getCaller(request);
    if (!caller) return unauthorized();
    const body = (await request.json().catch(() => ({}))) as {
      password?: string;
      code?: string;
      recoveryCode?: string;
    };

    try {
      if (sensitiveLocked(caller.id)) return locked();
      const users = readUsers();
      const user = users.find((u) => u.id === caller.id);
      const tf = user?.twoFactor;
      if (!user || !tf?.enabled) {
        return HttpResponse.json(
          { error: 'Two-factor authentication is not enabled.' },
          { status: 400 },
        );
      }
      if (body.password !== user.password) {
        recordSensitiveFailure(caller.id);
        return HttpResponse.json({ error: 'Wrong password.' }, { status: 401 });
      }

      let consumedRecovery = false;
      if (body.code !== undefined && body.code !== '') {
        const counter = verifyTotp(tf.secret, normalizeTotpCode(body.code));
        if (counter === null) {
          recordSensitiveFailure(caller.id);
          return HttpResponse.json(
            { error: "That code didn't match. Try the next one." },
            { status: 401 },
          );
        }
        if (counter <= tf.lastUsedCounter) {
          return HttpResponse.json(
            { error: 'That code was already used. Wait for the next one and try again.' },
            { status: 401 },
          );
        }
        tf.lastUsedCounter = counter;
      } else if (body.recoveryCode !== undefined && body.recoveryCode !== '') {
        const hash = await sha256Hex(normalizeRecoveryCode(body.recoveryCode));
        const idx = tf.recoveryHashes.indexOf(hash);
        if (idx === -1) {
          recordSensitiveFailure(caller.id);
          return HttpResponse.json(
            { error: "That recovery code didn't match." },
            { status: 401 },
          );
        }
        tf.recoveryHashes.splice(idx, 1);
        consumedRecovery = true;
      } else {
        return HttpResponse.json(
          { error: 'Enter your current 6-digit code or a recovery code.' },
          { status: 400 },
        );
      }

      // Two-factor fully removed; an in-progress enrollment cannot exist
      // while enabled (start refuses), so nothing else survives.
      const kept = { id: user.id, username: user.username, email: user.email, password: user.password, createdAt: user.createdAt };
      const nextUsers = users.map((u) => (u.id === user.id ? kept : u));
      writeUsers(nextUsers);
      clearSensitiveFailures(caller.id);
      return HttpResponse.json(
        { success: true, usedRecoveryCode: consumedRecovery },
        { status: 200 },
      );
    } catch (err) {
      const res = storeErrorResponse(err);
      if (res) return res;
      throw err;
    }
  }),

  // POST /api/auth/2fa/recovery-codes/regenerate — password + current TOTP;
  // old codes are revoked by replacement. Recovery path for a lost phone is
  // disable → enable again.
  http.post(`${BASE}/auth/2fa/recovery-codes/regenerate`, async ({ request }) => {
    await delay(200);
    const caller = getCaller(request);
    if (!caller) return unauthorized();
    const body = (await request.json().catch(() => ({}))) as {
      password?: string;
      code?: string;
    };

    try {
      if (sensitiveLocked(caller.id)) return locked();
      const users = readUsers();
      const user = users.find((u) => u.id === caller.id);
      const tf = user?.twoFactor;
      if (!user || !tf?.enabled) {
        return HttpResponse.json(
          { error: 'Two-factor authentication is not enabled.' },
          { status: 400 },
        );
      }
      if (body.password !== user.password) {
        recordSensitiveFailure(caller.id);
        return HttpResponse.json({ error: 'Wrong password.' }, { status: 401 });
      }
      const counter = verifyTotp(tf.secret, normalizeTotpCode(body.code ?? ''));
      if (counter === null) {
        recordSensitiveFailure(caller.id);
        return HttpResponse.json(
          { error: "That code didn't match. Try the next one." },
          { status: 401 },
        );
      }
      if (counter <= tf.lastUsedCounter) {
        return HttpResponse.json(
          { error: 'That code was already used. Wait for the next one and try again.' },
          { status: 401 },
        );
      }
      tf.lastUsedCounter = counter;

      const recoveryCodes = generateRecoveryCodes(RECOVERY_CODE_COUNT);
      tf.recoveryHashes = await Promise.all(
        recoveryCodes.map((c) => sha256Hex(normalizeRecoveryCode(c))),
      );
      writeUsers(users);
      clearSensitiveFailures(caller.id);
      return HttpResponse.json({ recoveryCodes }, { status: 200 });
    } catch (err) {
      const res = storeErrorResponse(err);
      if (res) return res;
      throw err;
    }
  }),

  /* ------------------------------------------------------------------ */
  /* Conversations & messages (unchanged demo behaviour)                 */
  /* ------------------------------------------------------------------ */

  // GET /api/conversations
  http.get(`${BASE}/conversations`, async () => {
    await delay(180);
    return HttpResponse.json<Conversation[]>(seedConversations, { status: 200 });
  }),

  // GET /api/conversations/:id/messages
  http.get(`${BASE}/conversations/:id/messages`, async ({ params }) => {
    await delay(160);
    const id = String(params.id);
    const messages = seedMessages[id];
    if (!messages) {
      return HttpResponse.json(
        { error: 'Conversation not found.' },
        { status: 404 },
      );
    }
    return HttpResponse.json<Message[]>(messages, { status: 200 });
  }),

  /* ------------------------------------------------------------------ */
  /* People search                                                       */
  /* ------------------------------------------------------------------ */

  // GET /api/users/search?q= — real accounts + sample contacts, each with
  // the caller's relationship. Sample contacts are never inviteable. Only
  // id/username/kind/relationship fields are returned.
  http.get(`${BASE}/users/search`, async ({ request }) => {
    await delay(120);
    const caller = getCaller(request);
    if (!caller) return unauthorized();

    try {
      const url = new URL(request.url);
      const q = url.searchParams.get('q')?.toLowerCase().trim() ?? '';
      const matches = (username: string) => username.toLowerCase().includes(q);

      const users = readUsers();
      const accounts: PeopleResult[] = users
        .filter((u) => u.id !== caller.id) // the caller is never listed
        .filter((u) => matches(u.username))
        .map((u) => ({
          id: u.id,
          username: u.username,
          kind: 'account' as const,
          relationship: relationshipBetween(caller.id, u.id),
        }));

      // Display-level dedupe: skip a sample entry whose username collides
      // with a real account's. Not identity matching — ids stay separate.
      const accountNames = new Set(users.map((u) => u.username.toLowerCase()));
      const samples: PeopleResult[] = seedSearchableUsers
        .filter((s) => !accountNames.has(s.username.toLowerCase()))
        .filter((s) => matches(s.username))
        .map((s) => ({
          id: s.id,
          username: s.username,
          kind: 'sample' as const,
          relationship: { state: 'none' as const },
        }));

      const results = [...accounts, ...samples].sort((a, b) =>
        a.username.localeCompare(b.username),
      );
      return HttpResponse.json(results, { status: 200 });
    } catch (err) {
      const res = storeErrorResponse(err);
      if (res) return res;
      throw err;
    }
  }),

  /* ------------------------------------------------------------------ */
  /* Friends & friend requests                                           */
  /* ------------------------------------------------------------------ */

  // GET /api/friends — derived from persisted friendships (survives re-login).
  http.get(`${BASE}/friends`, async ({ request }) => {
    await delay(100);
    const caller = getCaller(request);
    if (!caller) return unauthorized();
    try {
      return HttpResponse.json(listFriends(caller.id), { status: 200 });
    } catch (err) {
      const res = storeErrorResponse(err);
      if (res) return res;
      throw err;
    }
  }),

  // GET /api/friend-requests — received + sent (pending and accepted rows).
  http.get(`${BASE}/friend-requests`, async ({ request }) => {
    await delay(120);
    const caller = getCaller(request);
    if (!caller) return unauthorized();
    try {
      return HttpResponse.json(listFriendRequests(caller.id), { status: 200 });
    } catch (err) {
      const res = storeErrorResponse(err);
      if (res) return res;
      throw err;
    }
  }),

  // POST /api/friend-requests { toUserId }
  http.post(`${BASE}/friend-requests`, async ({ request }) => {
    await delay(150);
    const caller = getCaller(request);
    if (!caller) return unauthorized();

    const body = (await request.json().catch(() => ({}))) as { toUserId?: unknown };
    if (typeof body.toUserId !== 'string' || body.toUserId.length === 0) {
      return HttpResponse.json({ error: 'Missing recipient.' }, { status: 400 });
    }

    try {
      const { requestId, toUsername } = sendFriendRequest(caller.id, body.toUserId);
      return HttpResponse.json(
        { requestId, toUser: { id: body.toUserId, username: toUsername } },
        { status: 201 },
      );
    } catch (err) {
      const res = storeErrorResponse(err);
      if (res) return res;
      throw err;
    }
  }),

  // POST /api/friend-requests/:id/accept — recipient only, pending only.
  http.post(`${BASE}/friend-requests/:id/accept`, async ({ request, params }) => {
    await delay(150);
    const caller = getCaller(request);
    if (!caller) return unauthorized();
    try {
      const { friendshipId, friendUsername } = acceptFriendRequest(caller.id, String(params.id));
      return HttpResponse.json(
        { success: true, friendshipId, friend: { username: friendUsername } },
        { status: 200 },
      );
    } catch (err) {
      const res = storeErrorResponse(err);
      if (res) return res;
      throw err;
    }
  }),

  // POST /api/friend-requests/:id/decline — recipient only, pending only.
  http.post(`${BASE}/friend-requests/:id/decline`, async ({ request, params }) => {
    await delay(150);
    const caller = getCaller(request);
    if (!caller) return unauthorized();
    try {
      declineFriendRequest(caller.id, String(params.id));
      return HttpResponse.json({ success: true }, { status: 200 });
    } catch (err) {
      const res = storeErrorResponse(err);
      if (res) return res;
      throw err;
    }
  }),

  // POST /api/friend-requests/:id/cancel — sender only, pending only.
  http.post(`${BASE}/friend-requests/:id/cancel`, async ({ request, params }) => {
    await delay(150);
    const caller = getCaller(request);
    if (!caller) return unauthorized();
    try {
      cancelFriendRequest(caller.id, String(params.id));
      return HttpResponse.json({ success: true }, { status: 200 });
    } catch (err) {
      const res = storeErrorResponse(err);
      if (res) return res;
      throw err;
    }
  }),
];
