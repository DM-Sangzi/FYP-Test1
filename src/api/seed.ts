/**
 * Hardcoded mock data for the demo (PRD §5.3 endpoints `/api/conversations`,
 * `/api/conversations/:id/messages`, `/api/users/search`).
 *
 * Auth users are NOT seeded here — they live in localStorage and are created
 * on demand via `/api/auth/register` (see `handlers.ts`).
 */
import type { Conversation, Message } from '../types';

export const seedConversations: Conversation[] = [
  {
    id: 'c1',
    name: 'Alice Tan',
    initials: 'AT',
    color: 'teal',
    status: 'online',
    lastMessage: 'Did the post-quantum key exchange work?',
    lastMessageAt: minutesFromNow(-2),
    unread: 2,
  },
  {
    id: 'c2',
    name: 'Backend Team',
    initials: 'BT',
    color: 'slate',
    status: 'offline',
    lastSeen: minutesFromNow(-35),
    lastMessage: 'Pushed the Dilithium signing endpoint 🎉',
    lastMessageAt: minutesFromNow(-35),
    unread: 0,
  },
  {
    id: 'c3',
    name: 'Marcus Lee',
    initials: 'ML',
    color: 'violet',
    status: 'online',
    lastMessage: 'See you at the demo on Friday',
    lastMessageAt: hoursFromNow(-3),
    unread: 0,
  },
  {
    id: 'c4',
    name: 'Priya Nair',
    initials: 'PN',
    color: 'emerald',
    status: 'offline',
    lastSeen: hoursFromNow(-8),
    lastMessage: 'Thanks, that cleared things up!',
    lastMessageAt: hoursFromNow(-8),
    unread: 0,
  },
  {
    id: 'c5',
    name: 'Crypto Study Group',
    initials: 'CS',
    color: 'amber',
    status: 'offline',
    lastSeen: daysFromNow(-1),
    lastMessage: 'Lecture slides uploaded to the repo',
    lastMessageAt: daysFromNow(-1),
    unread: 1,
  },
  {
    id: 'c6',
    name: 'Jonas Weber',
    initials: 'JW',
    color: 'rose',
    status: 'offline',
    lastSeen: daysFromNow(-2),
    lastMessage: 'Let me know when the PR is reviewed',
    lastMessageAt: daysFromNow(-2),
    unread: 0,
  },
];

export const seedMessages: Record<string, Message[]> = {
  c1: [
    msg('c1', 'received', 'Hey! Are you ready for the presentation?', -64),
    msg('c1', 'sent', 'Almost. Just finishing the slides.', -62),
    msg('c1', 'received', 'Nice. By the way, did the post-quantum key exchange work?', -2),
    msg('c1', 'received', 'Curious about the Kyber side especially 👀', -1),
  ],
  c2: [
    msg('c2', 'received', 'Morning team', -240),
    msg('c2', 'sent', 'Morning! How did the signing tests go?', -238),
    msg('c2', 'received', 'All green. Pushed the Dilithium signing endpoint 🎉', -35),
  ],
  c3: [
    msg('c3', 'received', 'See you at the demo on Friday', -180),
    msg('c3', 'sent', 'Will be there 10 mins early.', -178),
    msg('c3', 'received', 'Perfect', -3),
  ],
  c4: [
    msg('c4', 'received', 'I had a question about the mock layer', -500),
    msg('c4', 'sent', 'Sure, fire away — MSW + localStorage keeps it simple.', -498),
    msg('c4', 'received', 'Thanks, that cleared things up!', -8),
  ],
  c5: [
    msg('c5', 'received', 'Lecture slides uploaded to the repo', -1440),
    msg('c5', 'sent', 'Great, I will review them tonight.', -1438),
  ],
  c6: [
    msg('c6', 'sent', 'Opened the PR for the chat layout', -2880),
    msg('c6', 'received', 'Let me know when the PR is reviewed', -2880),
  ],
};

// --- small helpers to build ISO timestamps relative to "now" ---

function minutesFromNow(min: number): string {
  return new Date(Date.now() + min * 60_000).toISOString();
}
function hoursFromNow(h: number): string {
  return new Date(Date.now() + h * 3_600_000).toISOString();
}
function daysFromNow(d: number): string {
  return new Date(Date.now() + d * 86_400_000).toISOString();
}
function msg(
  conversationId: string,
  direction: 'sent' | 'received',
  text: string,
  minutesOffset: number,
): Message {
  return {
    id: `${conversationId}-${Math.abs(minutesOffset)}-${Math.random().toString(36).slice(2, 7)}`,
    conversationId,
    direction,
    text,
    at: minutesFromNow(minutesOffset),
  };
}

/** Mock user directory for `/api/users/search?q=`. */
export const seedSearchableUsers = [
  { id: 'u_demo1', username: 'alice' },
  { id: 'u_demo2', username: 'marcus' },
  { id: 'u_demo3', username: 'priya' },
  { id: 'u_demo4', username: 'jonas' },
  { id: 'u_demo5', username: 'crypto_team' },
];
