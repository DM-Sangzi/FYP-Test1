/**
 * localStorage-backed social store: friend requests + friendships.
 *
 * Layering rule: ONLY MSW handlers touch this module — React components go
 * through the API client (PRD §5.3 pattern, same as userStore).
 *
 * Persistence: one key, `pqpm_social_v1`. Every operation does a validated
 * read-modify-write ending in a single setItem, so "accept" updates the
 * request AND creates the friendship in one write — no partial success.
 *
 * Corruption policy: a missing key is initialised empty; a value that fails
 * JSON parsing or schema validation is NEVER overwritten. Every operation
 * re-reads first, so corrupt data blocks all reads and writes (HTTP 500)
 * until the entry is repaired manually in DevTools.
 *
 * Concurrency limitation (declared, not hidden): there is no cross-tab lock.
 * Two tabs writing at the same instant can lose one update (last write wins).
 * Other tabs are notified via the `storage` event and re-read.
 */
import type { FriendRequest, FriendRequestStatus, Friendship, RelationshipInfo } from '../types';
import { generateId, readUsers } from './userStore';

export const SOCIAL_STORAGE_KEY = 'pqpm_social_v1';

interface SocialData {
  version: 1;
  requests: FriendRequest[];
  friendships: Friendship[];
}

const VALID_STATUSES: readonly FriendRequestStatus[] = [
  'pending',
  'accepted',
  'declined',
  'cancelled',
];

/** Error carrying the HTTP status the handler should respond with. */
export class SocialStoreError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = 'SocialStoreError';
    this.status = status;
  }
}

/** In-memory copy used only when localStorage itself is blocked (read side);
 *  writes still try localStorage and fail loudly when blocked. */
let memorySocial: SocialData = { version: 1, requests: [], friendships: [] };

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

function isValidRequest(v: unknown): v is FriendRequest {
  return (
    isRecord(v) &&
    isNonEmptyString(v.id) &&
    isNonEmptyString(v.fromUserId) &&
    isNonEmptyString(v.toUserId) &&
    VALID_STATUSES.includes(v.status as FriendRequestStatus) &&
    isNonEmptyString(v.createdAt) &&
    isNonEmptyString(v.updatedAt)
  );
}

function isValidFriendship(v: unknown): v is Friendship {
  return (
    isRecord(v) &&
    isNonEmptyString(v.id) &&
    isNonEmptyString(v.userAId) &&
    isNonEmptyString(v.userBId) &&
    // Invariant: the pair is stored sorted so lookups are direction-independent.
    typeof v.userAId === 'string' &&
    typeof v.userBId === 'string' &&
    v.userAId < v.userBId &&
    isNonEmptyString(v.createdAt)
  );
}

function validate(raw: unknown): SocialData | null {
  if (!isRecord(raw) || raw.version !== 1) return null;
  if (!Array.isArray(raw.requests) || !raw.requests.every(isValidRequest)) return null;
  if (!Array.isArray(raw.friendships) || !raw.friendships.every(isValidFriendship)) return null;
  return { version: 1, requests: raw.requests, friendships: raw.friendships };
}

function corruptError(): SocialStoreError {
  return new SocialStoreError(
    'Social data is corrupted. Nothing was changed — repair or remove the pqpm_social_v1 entry in localStorage to continue.',
    500,
  );
}

/* ------------------------------------------------------------------ */
/* Read / write                                                        */
/* ------------------------------------------------------------------ */

/** Reads and validates the store. Throws SocialStoreError when corrupt;
 *  falls back to the in-memory copy only when storage access is blocked. */
function readSocial(): SocialData {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(SOCIAL_STORAGE_KEY);
  } catch {
    // Storage blocked — serve the session copy; writes below still try and fail.
    return memorySocial;
  }
  if (raw === null) return { version: 1, requests: [], friendships: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw corruptError();
  }
  const data = validate(parsed);
  if (!data) throw corruptError();
  return data;
}

/** Single setItem per mutation. A failed save throws — callers must surface
 *  the failure instead of reporting success (no fake persistence). */
function writeSocial(next: SocialData): void {
  try {
    window.localStorage.setItem(SOCIAL_STORAGE_KEY, JSON.stringify(next));
    memorySocial = next;
  } catch {
    throw new SocialStoreError(
      'Could not save social data in this browser. Nothing was changed — please try again.',
      500,
    );
  }
}

/** Validated read-modify-write for one operation. */
function mutateSocial<T>(mutate: (data: SocialData) => { data: SocialData; result: T }): T {
  const current = readSocial();
  const { data: next, result } = mutate(current);
  writeSocial(next);
  return result;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function sortedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

function areFriends(data: SocialData, a: string, b: string): boolean {
  const [x, y] = sortedPair(a, b);
  return data.friendships.some((f) => f.userAId === x && f.userBId === y);
}

/** Resolves an account id to its username via the user store. */
function usernameOf(userId: string): string | null {
  return readUsers().find((u) => u.id === userId)?.username ?? null;
}

function nowIso(): string {
  return new Date().toISOString();
}

/* ------------------------------------------------------------------ */
/* Operations (all throw SocialStoreError on failure)                  */
/* ------------------------------------------------------------------ */

/** Creates a pending request. Enforces: not self, target is a real account,
 *  not already friends, no duplicate or reverse pending request. */
export function sendFriendRequest(
  fromUserId: string,
  toUserId: string,
): { requestId: string; toUsername: string } {
  if (toUserId === fromUserId) {
    throw new SocialStoreError("You can't send a friend request to yourself.", 400);
  }
  const target = readUsers().find((u) => u.id === toUserId);
  if (!target) {
    // Sample contacts are directory-only entries, not accounts, so they land here.
    throw new SocialStoreError(
      "That account doesn't exist or can't receive friend requests.",
      404,
    );
  }

  return mutateSocial((data) => {
    if (areFriends(data, fromUserId, toUserId)) {
      throw new SocialStoreError(`You're already friends with ${target.username}.`, 409);
    }
    const pending = data.requests.find(
      (r) =>
        r.status === 'pending' &&
        ((r.fromUserId === fromUserId && r.toUserId === toUserId) ||
          (r.fromUserId === toUserId && r.toUserId === fromUserId)),
    );
    if (pending) {
      throw new SocialStoreError(
        pending.fromUserId === fromUserId
          ? `You already have a pending friend request to ${target.username}.`
          : `${target.username} has already sent you a friend request. Accept it instead.`,
        409,
      );
    }

    const ts = nowIso();
    const request: FriendRequest = {
      id: generateId('fr'),
      fromUserId,
      toUserId,
      status: 'pending',
      createdAt: ts,
      updatedAt: ts,
    };
    return { data: { ...data, requests: [...data.requests, request] }, result: { requestId: request.id, toUsername: target.username } };
  });
}

/** Recipient accepts a pending request. One write updates the request and
 *  creates the friendship together; a duplicate accept never duplicates the
 *  friendship. */
export function acceptFriendRequest(
  userId: string,
  requestId: string,
): { friendshipId: string; friendUsername: string } {
  return mutateSocial((data) => {
    const request = data.requests.find((r) => r.id === requestId);
    if (!request) throw new SocialStoreError('Friend request not found.', 404);
    if (request.toUserId !== userId) {
      throw new SocialStoreError('Only the recipient can accept this request.', 403);
    }
    if (request.status !== 'pending') {
      throw new SocialStoreError('This request is no longer pending.', 409);
    }
    const friendUsername = usernameOf(request.fromUserId);
    if (!friendUsername) {
      throw new SocialStoreError("The sender's account no longer exists.", 404);
    }

    const [userAId, userBId] = sortedPair(request.fromUserId, request.toUserId);
    let friendships = data.friendships;
    let friendshipId = friendships.find((f) => f.userAId === userAId && f.userBId === userBId)?.id;
    if (!friendshipId) {
      const friendship: Friendship = {
        id: generateId('fs'),
        userAId,
        userBId,
        createdAt: nowIso(),
      };
      friendships = [...friendships, friendship];
      friendshipId = friendship.id;
    }

    const requests = data.requests.map((r) =>
      r.id === requestId ? { ...r, status: 'accepted' as const, updatedAt: nowIso() } : r,
    );
    return {
      data: { ...data, requests, friendships },
      result: { friendshipId, friendUsername },
    };
  });
}

/** Recipient declines a pending request. */
export function declineFriendRequest(userId: string, requestId: string): void {
  mutateSocial((data) => {
    const request = data.requests.find((r) => r.id === requestId);
    if (!request) throw new SocialStoreError('Friend request not found.', 404);
    if (request.toUserId !== userId) {
      throw new SocialStoreError('Only the recipient can decline this request.', 403);
    }
    if (request.status !== 'pending') {
      throw new SocialStoreError('This request is no longer pending.', 409);
    }
    const requests = data.requests.map((r) =>
      r.id === requestId ? { ...r, status: 'declined' as const, updatedAt: nowIso() } : r,
    );
    return { data: { ...data, requests }, result: undefined };
  });
}

/** Sender cancels their own pending request. */
export function cancelFriendRequest(userId: string, requestId: string): void {
  mutateSocial((data) => {
    const request = data.requests.find((r) => r.id === requestId);
    if (!request) throw new SocialStoreError('Friend request not found.', 404);
    if (request.fromUserId !== userId) {
      throw new SocialStoreError('Only the sender can cancel this request.', 403);
    }
    if (request.status !== 'pending') {
      throw new SocialStoreError('This request is no longer pending.', 409);
    }
    const requests = data.requests.map((r) =>
      r.id === requestId ? { ...r, status: 'cancelled' as const, updatedAt: nowIso() } : r,
    );
    return { data: { ...data, requests }, result: undefined };
  });
}

/** Received and sent requests (pending first-class, accepted kept so the UI
 *  can show the resulting Friends + Message state where the row was). */
export function listFriendRequests(userId: string): {
  received: { id: string; status: FriendRequestStatus; createdAt: string; otherUser: { id: string; username: string } }[];
  sent: { id: string; status: FriendRequestStatus; createdAt: string; otherUser: { id: string; username: string } }[];
} {
  const data = readSocial();
  const users = readUsers();
  const toView = (r: FriendRequest, otherId: string) => {
    const other = users.find((u) => u.id === otherId);
    if (!other) return null; // defensive: skip rows whose account vanished
    return {
      id: r.id,
      status: r.status,
      createdAt: r.createdAt,
      otherUser: { id: other.id, username: other.username },
    };
  };
  const received = data.requests
    .filter((r) => r.toUserId === userId && (r.status === 'pending' || r.status === 'accepted'))
    .map((r) => toView(r, r.fromUserId))
    .filter((v): v is NonNullable<typeof v> => v !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const sent = data.requests
    .filter((r) => r.fromUserId === userId && (r.status === 'pending' || r.status === 'accepted'))
    .map((r) => toView(r, r.toUserId))
    .filter((v): v is NonNullable<typeof v> => v !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { received, sent };
}

/** The caller's friends, resolved from persisted friendships against the
 *  user store. This — not the request history — is the friends-list source. */
export function listFriends(userId: string): {
  friendshipId: string;
  userId: string;
  username: string;
  friendsSince: string;
}[] {
  const data = readSocial();
  const users = readUsers();
  return data.friendships
    .filter((f) => f.userAId === userId || f.userBId === userId)
    .map((f) => {
      const otherId = f.userAId === userId ? f.userBId : f.userAId;
      const other = users.find((u) => u.id === otherId);
      if (!other) return null; // defensive: skip orphans (account removed manually)
      return { friendshipId: f.id, userId: other.id, username: other.username, friendsSince: f.createdAt };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null)
    .sort((a, b) => a.username.localeCompare(b.username));
}

/** Relationship between two accounts, used by search. */
export function relationshipBetween(aUserId: string, bUserId: string): RelationshipInfo {
  const data = readSocial();
  if (areFriends(data, aUserId, bUserId)) return { state: 'friends' };
  const pending = data.requests.find(
    (r) =>
      r.status === 'pending' &&
      ((r.fromUserId === aUserId && r.toUserId === bUserId) ||
        (r.fromUserId === bUserId && r.toUserId === aUserId)),
  );
  if (!pending) return { state: 'none' };
  return {
    state: pending.fromUserId === aUserId ? 'request-sent' : 'request-received',
    requestId: pending.id,
  };
}
