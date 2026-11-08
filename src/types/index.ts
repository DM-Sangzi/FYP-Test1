/**
 * Shared domain types for the PQPM frontend.
 * These mirror the JSON contract that the backend will eventually serve,
 * so swapping MSW for a real API requires no type changes (PRD §5.3, §13).
 */

/**
 * Per-account TOTP two-factor state, persisted on the user record.
 *
 * Mock trust boundary: this lives in localStorage and is verified in the
 * browser, so it demonstrates the flow only — it is not production MFA.
 * `secret`, the provisioning URI and recovery codes are never returned by
 * any listing/search endpoint and never logged.
 */
export interface TwoFactorEnrollment {
  /** base32 secret awaiting verification. */
  secret: string;
  /** ISO timestamp; an expired enrollment is treated as absent. */
  expiresAt: string;
  failedAttempts: number;
}

export interface TwoFactorData {
  /** True only after a verified enrollment. */
  enabled: boolean;
  secret: string;
  confirmedAt: string;
  /** Timestep counter of the last successful code; older codes are rejected. */
  lastUsedCounter: number;
  /** SHA-256 hex hashes of normalized recovery codes (never the codes). */
  recoveryHashes: string[];
  enrollment: TwoFactorEnrollment | null;
}

/** A registered user account (mock-persisted via MSW + localStorage). */
export interface User {
  id: string;
  username: string;
  email: string;
  /** Plaintext only because this is a mock auth layer (PRD §5.3). Never log this. */
  password: string;
  createdAt: string;
  /** Present once a 2FA enrollment has been started. */
  twoFactor?: TwoFactorData;
  /** Own profile photo as a 256×256 JPEG data URL. Absent on older accounts
   *  — those simply keep showing initials (no migration needed). */
  avatar?: string;
}

/** The user object returned by the API, never exposing the password, the
 *  2FA secret or recovery hashes (whitelist serialization only). */
export interface PublicUser {
  id: string;
  username: string;
  email: string;
  /** Public avatar as a JPEG data URL; absent = show initials. */
  avatarUrl?: string;
}

/** Result of a successful login: a fake JWT + the authenticated user. */
export interface AuthSession {
  token: string;
  user: PublicUser;
}

/** Second-step login challenge for accounts with 2FA enabled. Carries no
 *  token and no user — the session is only issued after verification. */
export interface LoginChallenge {
  challenge: {
    challengeId: string;
    username: string;
    expiresAt: string;
  };
}

/** POST /api/auth/login resolves to either a session or a 2FA challenge. */
export type LoginResult = AuthSession | LoginChallenge;

/** GET /api/auth/2fa/status — never contains secrets. */
export interface TwoFactorStatus {
  enabled: boolean;
  recoveryCodesRemaining: number;
}

/** POST /api/auth/2fa/enrollment/start. */
export interface TwoFactorEnrollmentStart {
  /** otpauth:// provisioning URI — rendered into a QR locally by the app. */
  otpauthUri: string;
  /** base32 secret for manual authenticator entry. */
  secret: string;
  expiresAt: string;
}

/** A chat conversation shown in the sidebar. */
export interface Conversation {
  id: string;
  /** Display name of the contact / conversation. */
  name: string;
  /** 2-letter initials used for the avatar circle. */
  initials: string;
  /** Accent colour key for the avatar. */
  color: AvatarColor;
  status: 'online' | 'offline';
  lastSeen?: string;
  lastMessage: string;
  lastMessageAt: string;
  unread: number;
  /** Optional short self-description shared with contacts (contact profile). */
  about?: string;
  /** Sorted [a, b] user ids when the conversation was created through the
   *  friend flow. Seed demo conversations predate user accounts and have no
   *  reliable participant identity, so they omit this field. */
  participantIds?: [string, string];
}

/** Tint options for avatar circles. */
export type AvatarColor = 'teal' | 'slate' | 'violet' | 'amber' | 'rose' | 'emerald';

/** Sender of a single chat message. */
export type MessageDirection = 'sent' | 'received';

/** A single message inside a conversation thread. */
export interface Message {
  id: string;
  conversationId: string;
  /** Who sent the message relative to the current user. */
  direction: MessageDirection;
  text: string;
  /** ISO timestamp string. */
  at: string;
}

/* ------------------------------------------------------------------ */
/* Friends & requests                                                  */
/* ------------------------------------------------------------------ */

/** Lifecycle of a friend request. */
export type FriendRequestStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

/** A friend request as persisted in the social store (never sent to the UI). */
export interface FriendRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: FriendRequestStatus;
  createdAt: string;
  updatedAt: string;
}

/** A persisted friendship between two accounts. */
export interface Friendship {
  id: string;
  /** Sorted pair (userAId < userBId) so lookups never depend on direction. */
  userAId: string;
  userBId: string;
  createdAt: string;
}

/** Relationship between the signed-in user and a directory entry. */
export type RelationshipState = 'none' | 'request-sent' | 'request-received' | 'friends';

export interface RelationshipInfo {
  state: RelationshipState;
  /** The pending request id, present when state is request-sent/request-received. */
  requestId?: string;
}

/** Row of `GET /api/users/search` — only the fields this feature needs. */
export interface PeopleResult {
  id: string;
  username: string;
  /** 'account' = real (login-capable) account; 'sample' = demo directory entry. */
  kind: 'account' | 'sample';
  relationship: RelationshipInfo;
  /** Public avatar of the account; absent on sample entries and accounts
   *  without a photo (initials are shown instead). */
  avatarUrl?: string;
}

/** One row of `GET /api/friend-requests` (pending and accepted requests). */
export interface FriendRequestView {
  id: string;
  status: FriendRequestStatus;
  createdAt: string;
  otherUser: { id: string; username: string; avatarUrl?: string };
}

/** Response of `GET /api/friend-requests`. */
export interface FriendRequestsOverview {
  received: FriendRequestView[];
  sent: FriendRequestView[];
}

/** One row of `GET /api/friends` — derived from persisted friendships. */
export interface FriendEntry {
  friendshipId: string;
  userId: string;
  username: string;
  friendsSince: string;
  /** Public avatar of the friend; absent = show initials. */
  avatarUrl?: string;
}
