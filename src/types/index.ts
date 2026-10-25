/**
 * Shared domain types for the PQPM frontend.
 * These mirror the JSON contract that the backend will eventually serve,
 * so swapping MSW for a real API requires no type changes (PRD §5.3, §13).
 */

/** A registered user account (mock-persisted via MSW + localStorage). */
export interface User {
  id: string;
  username: string;
  email: string;
  /** Plaintext only because this is a mock auth layer (PRD §5.3). Never log this. */
  password: string;
  createdAt: string;
}

/** The user object returned by the API, never exposing the password. */
export interface PublicUser {
  id: string;
  username: string;
  email: string;
}

/** Result of a successful login: a fake JWT + the authenticated user. */
export interface AuthSession {
  token: string;
  user: PublicUser;
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

/** Search result row for `/api/users/search`. */
export interface UserSearchResult {
  id: string;
  username: string;
}
