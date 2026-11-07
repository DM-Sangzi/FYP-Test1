/**
 * localStorage-backed user store.
 *
 * Per PRD §5.3 this is the ONLY place user accounts live, and it is accessed
 * ONLY inside the MSW handlers (never from React components).
 *
 * Corruption policy (matches socialStore): a value that fails JSON parsing
 * or shape validation is NEVER overwritten — reads and writes fail loudly
 * until the entry is repaired manually. Only genuinely blocked storage (read
 * side) falls back to an in-memory session copy, and a write that cannot
 * reach storage throws instead of reporting success.
 */
import type { User } from '../types';

const USERS_KEY = 'pqpm_users';
const SEED_FLAG_KEY = 'pqpm_users_seeded';

/** Thrown on corrupt persisted data or failed persistence; handlers map it
 *  to an HTTP 500 so the UI never claims success. */
export class UserStoreError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = 'UserStoreError';
    this.status = status;
  }
}

/** A demo account is pre-seeded so evaluators can log in immediately. */
const DEMO_USER: User = {
  id: 'u_demo',
  username: 'demo',
  email: 'demo@pqpm.local',
  password: 'password123',
  createdAt: new Date('2026-05-01T00:00:00Z').toISOString(),
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

function isValidUser(v: unknown): v is User {
  return (
    isRecord(v) &&
    isNonEmptyString(v.id) &&
    isNonEmptyString(v.username) &&
    isNonEmptyString(v.email) &&
    isNonEmptyString(v.password) &&
    isNonEmptyString(v.createdAt)
  );
}

function corrupted(): UserStoreError {
  return new UserStoreError(
    'Account data is corrupted. Nothing will be changed — repair or remove the pqpm_users entry in localStorage to continue.',
    500,
  );
}

/**
 * Reads all stored users, seeding the demo account on first run. Throws
 * UserStoreError when the stored value is corrupt (never overwrites it);
 * falls back to the in-memory copy only when storage itself is blocked.
 */
export function readUsers(): User[] {
  let seeded: string | null;
  let raw: string | null;
  try {
    seeded = window.localStorage.getItem(SEED_FLAG_KEY);
    if (!seeded) {
      // First run: an empty (not corrupt) store is initialised with the demo account.
      const initial: User[] = [DEMO_USER];
      window.localStorage.setItem(USERS_KEY, JSON.stringify(initial));
      window.localStorage.setItem(SEED_FLAG_KEY, '1');
      memoryFallback = initial;
      return initial;
    }
    raw = window.localStorage.getItem(USERS_KEY);
  } catch {
    // Storage blocked — serve the session copy; writeUsers below still tries
    // and fails loudly rather than reporting fake persistence.
    return memoryFallback;
  }
  if (raw === null) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw corrupted();
  }
  if (!Array.isArray(parsed) || !parsed.every(isValidUser)) throw corrupted();
  return parsed as User[];
}

/** Writes the full user list back to localStorage. A failed save throws —
 *  callers must surface the failure instead of reporting success. */
export function writeUsers(users: User[]): void {
  try {
    window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
    memoryFallback = users;
  } catch {
    throw new UserStoreError(
      'Could not save account data in this browser. Nothing was changed — please try again.',
      500,
    );
  }
}

export function generateId(prefix = 'u'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

let memoryFallback: User[] = [DEMO_USER];
