/**
 * MSW request handlers — the entire mock backend (PRD §5.3).
 *
 * These intercept fetch calls at the Service Worker level so the requests
 * appear as real network traffic in DevTools. Auth users are persisted via
 * the localStorage user store; conversations/messages are served from seed
 * data; friend requests/friendships are persisted via the social store.
 *
 * Caller identity: friend/search endpoints require `Authorization: Bearer
 * fake-jwt.<base64 payload>.mock-signature` and decode the payload's `sub`.
 * This identifies the caller for the mock demo — it is NOT signature
 * verification; a real backend must validate tokens properly.
 *
 * To swap in a real backend later: set `VITE_USE_MOCK=false` (PRD §5.3).
 */
import { http, HttpResponse, delay } from 'msw';
import type {
  AuthSession,
  Conversation,
  Message,
  PeopleResult,
  PublicUser,
  User,
} from '../types';
import { readUsers, writeUsers, generateId } from './userStore';
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

/** Maps SocialStoreError to its HTTP response; returns null for other errors. */
function socialErrorResponse(err: unknown): Response | null {
  if (err instanceof SocialStoreError) {
    return HttpResponse.json({ error: err.message }, { status: err.status });
  }
  return null;
}

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
  }),

  // POST /api/auth/login
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
    const session: AuthSession = { token: makeToken(pub), user: pub };
    return HttpResponse.json(session, { status: 200 });
  }),

  // POST /api/auth/logout
  http.post(`${BASE}/auth/logout`, async () => {
    await delay(120);
    return HttpResponse.json({ success: true }, { status: 200 });
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
  // the caller's relationship. Sample contacts are never inviteable.
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
      const res = socialErrorResponse(err);
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
      const res = socialErrorResponse(err);
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
      const res = socialErrorResponse(err);
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
      const res = socialErrorResponse(err);
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
      const res = socialErrorResponse(err);
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
      const res = socialErrorResponse(err);
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
      const res = socialErrorResponse(err);
      if (res) return res;
      throw err;
    }
  }),
];
