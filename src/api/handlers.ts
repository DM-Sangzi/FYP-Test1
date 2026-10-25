/**
 * MSW request handlers — the entire mock backend (PRD §5.3).
 *
 * These intercept fetch calls at the Service Worker level so the requests
 * appear as real network traffic in DevTools. Auth users are persisted via
 * the localStorage user store; conversations/messages are served from seed data.
 *
 * To swap in a real backend later: set `VITE_USE_MOCK=false` (PRD §5.3).
 */
import { http, HttpResponse, delay } from 'msw';
import type {
  AuthSession,
  Conversation,
  Message,
  PublicUser,
  User,
} from '../types';
import { readUsers, writeUsers, generateId } from './userStore';
import { seedConversations, seedMessages, seedSearchableUsers } from './seed';

const BASE = '/api';

function stripPrivate(u: User): PublicUser {
  return { id: u.id, username: u.username, email: u.email };
}

function makeToken(user: PublicUser): string {
  // A fake, opaque JWT-shaped token. Real signing happens on the backend.
  const payload = btoa(JSON.stringify({ sub: user.id, name: user.username, iat: Date.now() }));
  return `fake-jwt.${payload}.mock-signature`;
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
  /* Conversations & messages                                            */
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

  // GET /api/users/search?q=
  http.get(`${BASE}/users/search`, async ({ request }) => {
    await delay(120);
    const url = new URL(request.url);
    const q = url.searchParams.get('q')?.toLowerCase().trim() ?? '';
    const results = q
      ? seedSearchableUsers.filter((u) => u.username.toLowerCase().includes(q))
      : seedSearchableUsers;
    return HttpResponse.json(results, { status: 200 });
  }),
];
