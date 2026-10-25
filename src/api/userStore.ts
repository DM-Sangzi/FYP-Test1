/**
 * localStorage-backed user store.
 *
 * Per PRD §5.3 this is the ONLY place user accounts live, and it is accessed
 * ONLY inside the MSW handlers (never from React components). All access is
 * wrapped in try/catch so the demo still runs when storage is blocked (PRD §13).
 */
import type { User } from '../types';

const USERS_KEY = 'pqpm_users';
const SEED_FLAG_KEY = 'pqpm_users_seeded';

/** A demo account is pre-seeded so evaluators can log in immediately. */
const DEMO_USER: User = {
  id: 'u_demo',
  username: 'demo',
  email: 'demo@pqpm.local',
  password: 'password123',
  createdAt: new Date('2026-05-01T00:00:00Z').toISOString(),
};

/** Reads all stored users, seeding the demo account on first run. */
export function readUsers(): User[] {
  try {
    const seeded = window.localStorage.getItem(SEED_FLAG_KEY);
    if (!seeded) {
      window.localStorage.setItem(USERS_KEY, JSON.stringify([DEMO_USER]));
      window.localStorage.setItem(SEED_FLAG_KEY, '1');
      return [DEMO_USER];
    }
    const raw = window.localStorage.getItem(USERS_KEY);
    return raw ? (JSON.parse(raw) as User[]) : [];
  } catch {
    // storage blocked — keep an in-memory fallback for this session
    return memoryFallback;
  }
}

/** Writes the full user list back to localStorage. */
export function writeUsers(users: User[]): void {
  try {
    window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch {
    memoryFallback = users;
  }
}

export function generateId(prefix = 'u'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

let memoryFallback: User[] = [DEMO_USER];
