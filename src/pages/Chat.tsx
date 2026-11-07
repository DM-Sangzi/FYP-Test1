import { useCallback, useEffect, useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import {
  getConversations,
  getFriends,
  getFriendRequests,
  getMessages,
  respondToFriendRequest,
  sendFriendRequest,
} from '../api/client';
import { SOCIAL_STORAGE_KEY } from '../api/socialStore';
import type {
  AvatarColor,
  Conversation,
  FriendEntry,
  FriendRequestsOverview,
  Message,
  PeopleResult,
  RelationshipInfo,
} from '../types';
import { Sidebar } from '../components/chat/Sidebar';
import type { SocialPeer } from '../components/chat/Sidebar';
import { ChatHeader } from '../components/chat/ChatHeader';
import { MessageList } from '../components/chat/MessageList';
import { MessageInput } from '../components/chat/MessageInput';
import { SecurityPanel } from '../components/chat/SecurityPanel';
import { ContactProfile } from '../components/chat/ContactProfile';
import type { ProfileTarget } from '../components/chat/ContactProfile';
import { StatusToast } from '../components/chat/StatusToast';
import type { ToastModel } from '../components/chat/StatusToast';
import type { IdentityState, SessionState } from '../components/chat/SecurityPanel';
import { useAuth } from '../context/AuthContext';
import styles from './Chat.module.css';

const LOCAL_COLORS: AvatarColor[] = [
  'violet',
  'rose',
  'emerald',
  'amber',
  'slate',
  'teal',
];

const EMPTY_REQUESTS: FriendRequestsOverview = { received: [], sent: [] };

/** Social data tagged with the account that loaded it, so switching accounts
 *  (or a late response from a previous account) never shows stale rows. */
interface SocialState {
  owner: string | null;
  friends: FriendEntry[];
  requests: FriendRequestsOverview;
  error: string | null;
}

const INITIAL_SOCIAL: SocialState = {
  owner: null,
  friends: [],
  requests: EMPTY_REQUESTS,
  error: null,
};

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong. Please try again.';
}

/** Fetches both social views in one go (no state access — UI agnostic). */
async function fetchSocialState(): Promise<{
  friends: FriendEntry[];
  requests: FriendRequestsOverview;
}> {
  const [friends, requests] = await Promise.all([getFriends(), getFriendRequests()]);
  return { friends, requests };
}

/**
 * Chat shell (PRD §5.1 /chat, §5.4 layout, §9 IA).
 *
 * Two-pane layout: sidebar (conversation list) + chat area (header, thread,
 * composer). Conversations/messages behave as before (seed data + local
 * demo threads). The friend flow adds: a persisted social graph (requests +
 * friendships via the mock API), a Friend requests view, relationship-aware
 * people search, and Message entry only for actual friends.
 *
 * Persistence boundary (方案甲): friend requests/friendships persist in
 * localStorage through the mock API; conversations created via Message and
 * their messages stay session-only, exactly like the pre-existing local
 * demo threads. After a refresh the session is gone (token is in-memory by
 * design), so the user logs in again — relationships then reload from the
 * social store while conversation threads start empty.
 */
export function Chat() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convLoading, setConvLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [draft, setDraft] = useState('');
  /** Mobile pane switch: 'list' | 'thread' (PRD §6.3 responsive). */
  const [pane, setPane] = useState<'list' | 'thread'>('list');
  /** Messages for locally created conversations (never sent to the mock API). */
  const [localThreads, setLocalThreads] = useState<Record<string, Message[]>>({});
  /** Conversation security panel visibility. */
  const [securityOpen, setSecurityOpen] = useState(false);
  /** Profile overlay target (conversation or directory entry); null = closed.
   * Opening this overlay never unmounts the chat behind it, so the draft,
   * selection and MessageList scroll position are all preserved. */
  const [profileTarget, setProfileTarget] = useState<ProfileTarget | null>(null);
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia?.('(max-width: 767px)').matches ?? false,
  );

  /* ---- social state (friends & requests) ---- */
  const [social, setSocial] = useState<SocialState>(INITIAL_SOCIAL);
  /** Bumped after successful social actions so the people list refetches. */
  const [socialTick, setSocialTick] = useState(0);
  /** Owner-tagged in-flight social action (disables social buttons). */
  const [pendingAction, setPendingAction] = useState<{ owner: string; key: string } | null>(null);
  /** Owner-tagged status toast. */
  const [toast, setToast] = useState<{ owner: string; model: ToastModel } | null>(null);

  const chatPaneRef = useRef<HTMLElement>(null);
  const sidebarPaneRef = useRef<HTMLDivElement>(null);
  const profileOpenerRef = useRef<HTMLElement | null>(null);
  const userIdRef = useRef<string | null>(null);
  const socialSeqRef = useRef(0);
  const actionInFlightRef = useRef(false);

  // Real security state: no E2EE integration exists yet, so these are the
  // only honest values. Typed unions allow future states without redesign.
  const sessionState: SessionState = 'not-established';
  const identityState: IdentityState = 'not-verified';

  // Social data is only shown while it belongs to the signed-in account —
  // switching accounts clears the old account's rows from the screen.
  const socialReady = social.owner !== null && social.owner === (user?.id ?? null);
  const visibleFriends = socialReady ? social.friends : [];
  const visibleRequests = socialReady ? social.requests : EMPTY_REQUESTS;
  const visibleSocialError = socialReady ? social.error : null;
  const activePendingKey =
    pendingAction && pendingAction.owner === (user?.id ?? null) ? pendingAction.key : null;
  const visibleToast = toast && toast.owner === (user?.id ?? null) ? toast.model : null;

  // Latest user id for stale-response guards (kept in an effect, not render).
  useEffect(() => {
    userIdRef.current = user?.id ?? null;
  }, [user?.id]);

  // Follow viewport changes for the mobile full-screen contact profile.
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 767px)');
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Background interaction guard: while the contact profile is open, the
  // chat pane (header, messages, composer) is inert on all viewports, and
  // the sidebar joins it on mobile where the profile is a full-screen modal.
  // The desktop sidebar stays operable so another avatar can be clicked to
  // switch profiles, and a conversation row closes the profile and selects.
  useEffect(() => {
    const pane = chatPaneRef.current;
    if (pane) {
      if (profileTarget) pane.setAttribute('inert', '');
      else pane.removeAttribute('inert');
    }
  }, [profileTarget]);

  useEffect(() => {
    const pane = sidebarPaneRef.current;
    if (pane) {
      if (profileTarget && isMobile) pane.setAttribute('inert', '');
      else pane.removeAttribute('inert');
    }
  }, [profileTarget, isMobile]);

  /* ------------------------------------------------------------------ */
  /* Social data loading                                                 */
  /* ------------------------------------------------------------------ */

  // Load social data when the signed-in account changes. Same guarded-fetch
  // pattern as the conversation list: `active` stops unmounted updates, the
  // sequence number discards out-of-order responses, and the user-id check
  // blocks a previous account's late response from painting the screen.
  useEffect(() => {
    const uid = user?.id;
    if (!uid) return;
    let active = true;
    const seq = ++socialSeqRef.current;
    fetchSocialState()
      .then((state) => {
        if (!active || seq !== socialSeqRef.current || userIdRef.current !== uid) return;
        setSocial({ owner: uid, ...state, error: null });
      })
      .catch((err) => {
        if (!active || seq !== socialSeqRef.current || userIdRef.current !== uid) return;
        setSocial({
          owner: uid,
          friends: [],
          requests: EMPTY_REQUESTS,
          error: errorMessage(err),
        });
      });
    return () => {
      active = false;
    };
  }, [user?.id]);

  // Event-driven refresh only (storage events, post-action): never called
  // from an effect body.
  const refreshSocial = useCallback(async () => {
    const uid = user?.id;
    if (!uid) return;
    const seq = ++socialSeqRef.current;
    try {
      const state = await fetchSocialState();
      if (seq !== socialSeqRef.current || userIdRef.current !== uid) return;
      setSocial({ owner: uid, ...state, error: null });
    } catch (err) {
      if (seq !== socialSeqRef.current || userIdRef.current !== uid) return;
      setSocial({ owner: uid, friends: [], requests: EMPTY_REQUESTS, error: errorMessage(err) });
    }
  }, [user?.id]);

  // Other tabs editing the same social store (same browser, same origin)
  // notify via the storage event; re-read to stay in sync. The tab that
  // made the change updates from its own API responses instead.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === SOCIAL_STORAGE_KEY) void refreshSocial();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [refreshSocial]);

  function showToast(kind: ToastModel['kind'], text: string) {
    const uid = userIdRef.current;
    if (!uid) return;
    setToast({ owner: uid, model: { kind, text } });
  }

  const dismissToast = useCallback(() => setToast(null), []);

  /* ------------------------------------------------------------------ */
  /* Social actions                                                      */
  /* ------------------------------------------------------------------ */

  async function handleSendFriendRequest(peer: SocialPeer) {
    const uid = user?.id;
    if (actionInFlightRef.current || !uid) return;
    actionInFlightRef.current = true;
    setPendingAction({ owner: uid, key: `send:${peer.id}` });
    try {
      const res = await sendFriendRequest(peer.id);
      showToast('success', `Friend request sent to ${res.toUser.username}.`);
      await refreshSocial();
      setSocialTick((t) => t + 1);
    } catch (err) {
      showToast('error', errorMessage(err));
    } finally {
      actionInFlightRef.current = false;
      setPendingAction(null);
    }
  }

  async function handleRespondFriendRequest(
    requestId: string,
    action: 'accept' | 'decline' | 'cancel',
  ) {
    const uid = user?.id;
    if (actionInFlightRef.current || !uid) return;
    actionInFlightRef.current = true;
    setPendingAction({ owner: uid, key: `${action}:${requestId}` });
    try {
      const res = await respondToFriendRequest(requestId, action);
      if (action === 'accept') {
        const name = res.friend?.username;
        showToast(
          'success',
          name ? `You and ${name} are now friends.` : 'You are now friends.',
        );
      } else if (action === 'decline') {
        showToast('success', 'Friend request declined.');
      } else {
        showToast('success', 'Friend request cancelled.');
      }
      await refreshSocial();
      setSocialTick((t) => t + 1);
    } catch (err) {
      showToast('error', errorMessage(err));
    } finally {
      actionInFlightRef.current = false;
      setPendingAction(null);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Conversations & messages (existing behaviour)                       */
  /* ------------------------------------------------------------------ */

  // Load conversation list once.
  useEffect(() => {
    let active = true;
    getConversations()
      .then((data) => {
        if (!active) return;
        setConversations(data);
        const first = data[0];
        if (first) setActiveId(first.id);
      })
      .finally(() => active && setConvLoading(false));
    return () => {
      active = false;
    };
  }, []);

  // Load messages when the active conversation changes. Locally created
  // conversations (id `local-*`) never hit the mock API — their messages are
  // derived from localThreads at render time.
  useEffect(() => {
    if (!activeId || activeId.startsWith('local-')) return;
    let active = true;
    // The loading flag must flip back to true before the fetch resolves; it
    // settles asynchronously in finally() below. Intentional loading-flag
    // pattern:
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMsgLoading(true);
    getMessages(activeId)
      .then((data) => active && setMessages(data))
      .finally(() => active && setMsgLoading(false));
    return () => {
      active = false;
    };
  }, [activeId]);

  // Messages shown for the active conversation: seed threads come from state
  // (fetched above); local demo threads derive straight from localThreads.
  const activeMessages =
    activeId == null
      ? []
      : activeId.startsWith('local-')
        ? (localThreads[activeId] ?? [])
        : messages;
  const msgLoadingEffective = activeId?.startsWith('local-') ? false : msgLoading;

  const activeConversation =
    conversations.find((c) => c.id === activeId) ?? null;

  function handleSend() {
    const text = draft.trim();
    if (!text || !activeId) return;

    // Local-only optimistic echo (PRD §2.2: real-time WS deferred).
    const newMsg: Message = {
      id: `local-${Date.now()}`,
      conversationId: activeId,
      direction: 'sent',
      text,
      at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, newMsg]);
    if (activeId.startsWith('local-')) {
      setLocalThreads((prev) => ({
        ...prev,
        [activeId]: [...(prev[activeId] ?? []), newMsg],
      }));
    }
    setDraft('');

    // Update sidebar preview + timestamp for the active conversation.
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeId
          ? { ...c, lastMessage: text, lastMessageAt: newMsg.at, unread: 0 }
          : c,
      ),
    );
  }

  function handleSelect(id: string) {
    setActiveId(id);
    setPane('thread');
    // Selecting a conversation closes the contact profile overlay.
    setProfileTarget(null);
    // Clear unread badge on open.
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c)),
    );
  }

  /**
   * Friend flow: open (or reuse) the conversation with a friend, matched by
   * the sorted pair of stable user ids — never by display name. Created
   * threads are session-only demo threads (方案甲), like the seed-adjacent
   * local threads. Not called automatically by accepting a request.
   */
  function openMessageWith(peer: SocialPeer) {
    const myId = user?.id;
    if (!myId) return;
    const pair: [string, string] = myId < peer.id ? [myId, peer.id] : [peer.id, myId];
    const existing = conversations.find(
      (c) => !!c.participantIds && c.participantIds[0] === pair[0] && c.participantIds[1] === pair[1],
    );
    if (existing) {
      handleSelect(existing.id);
      return;
    }
    const id = `local-${Date.now()}`;
    const conv: Conversation = {
      id,
      name: peer.username,
      initials: peer.username.slice(0, 2).toUpperCase(),
      color: LOCAL_COLORS[conversations.length % LOCAL_COLORS.length],
      status: 'offline', // no presence data for accounts — no fake "online"
      lastMessage: '',
      lastMessageAt: new Date().toISOString(),
      unread: 0,
      participantIds: pair,
    };
    setConversations((prev) => [conv, ...prev]);
    handleSelect(id);
  }

  /* ------------------------------------------------------------------ */
  /* Contact profile                                                     */
  /* ------------------------------------------------------------------ */

  /** Relationship to a real account, derived from the loaded social state —
   *  the same data the search results render from. */
  function relationshipForPeer(peerId: string): RelationshipInfo {
    if (visibleFriends.some((f) => f.userId === peerId)) return { state: 'friends' };
    const inSent = visibleRequests.sent.find(
      (r) => r.otherUser.id === peerId && r.status === 'pending',
    );
    if (inSent) return { state: 'request-sent', requestId: inSent.id };
    const inReceived = visibleRequests.received.find(
      (r) => r.otherUser.id === peerId && r.status === 'pending',
    );
    if (inReceived) return { state: 'request-received', requestId: inReceived.id };
    return { state: 'none' };
  }

  /** Username only when reliably known through the social data — no name
   *  guessing from display names. */
  function usernameForPeer(peerId: string): string | undefined {
    return (
      visibleFriends.find((f) => f.userId === peerId)?.username ??
      visibleRequests.sent.find((r) => r.otherUser.id === peerId)?.otherUser.username ??
      visibleRequests.received.find((r) => r.otherUser.id === peerId)?.otherUser.username
    );
  }

  function profileTargetFromConversation(c: Conversation): ProfileTarget {
    const myId = user?.id;
    const peerId =
      c.participantIds && myId
        ? c.participantIds[0] === myId
          ? c.participantIds[1]
          : c.participantIds[0]
        : undefined;
    return {
      key: `conv:${c.id}`,
      kind: peerId ? 'account' : 'conversation',
      displayName: c.name,
      username: peerId ? usernameForPeer(peerId) : undefined,
      about: c.about,
      online: c.status === 'online',
      color: c.color,
      initials: c.initials,
      peerUserId: peerId,
      conversationId: c.id,
      relationship: peerId ? relationshipForPeer(peerId) : undefined,
    };
  }

  function profileTargetFromPerson(p: PeopleResult): ProfileTarget {
    return {
      key: `person:${p.id}`,
      kind: p.kind,
      displayName: p.username,
      username: p.username,
      color: 'slate',
      initials: p.username.slice(0, 2).toUpperCase(),
      peerUserId: p.kind === 'account' ? p.id : undefined,
      relationship: p.kind === 'account' ? p.relationship : undefined,
    };
  }

  function openConversationProfile(id: string, opener: HTMLElement | null) {
    const conversation = conversations.find((c) => c.id === id);
    if (!conversation) return;
    setSecurityOpen(false);
    profileOpenerRef.current = opener;
    setProfileTarget(profileTargetFromConversation(conversation));
  }

  function openPersonProfile(person: PeopleResult, opener: HTMLElement) {
    setSecurityOpen(false);
    profileOpenerRef.current = opener;
    setProfileTarget(profileTargetFromPerson(person));
  }

  function closeContactProfile() {
    setProfileTarget(null);
    // Return focus to the avatar entry that opened the profile.
    profileOpenerRef.current?.focus();
  }

  // Profile actions route through the same handlers as the search rows, so
  // the profile can never drift out of sync with the shared relationship.
  function handleProfileMessage() {
    const target = profileTarget;
    if (!target) return;
    closeContactProfile();
    if (target.kind === 'conversation' && target.conversationId) {
      handleSelect(target.conversationId);
    } else if (target.kind === 'account' && target.peerUserId) {
      openMessageWith({ id: target.peerUserId, username: target.displayName });
    }
  }

  function handleProfileSendRequest() {
    const target = profileTarget;
    if (target?.peerUserId) {
      void handleSendFriendRequest({ id: target.peerUserId, username: target.displayName });
    }
  }

  function handleProfileRespond(action: 'accept' | 'decline' | 'cancel') {
    const requestId = profileTarget?.relationship?.requestId;
    if (requestId) void handleRespondFriendRequest(requestId, action);
  }

  return (
    <div className={styles.shell} data-pane={pane}>
      <div className={styles.sidebarPane} ref={sidebarPaneRef}>
        <Sidebar
          conversations={conversations}
          activeId={activeId}
          onSelect={handleSelect}
          loading={convLoading}
          onNavigateToChat={() => setPane('thread')}
          currentUser={user ? { username: user.username } : undefined}
          onOpenProfile={openConversationProfile}
          friends={visibleFriends}
          requests={visibleRequests}
          socialError={visibleSocialError}
          socialTick={socialTick}
          pendingAction={activePendingKey}
          onSendFriendRequest={(peer) => void handleSendFriendRequest(peer)}
          onRespondFriendRequest={(requestId, action) =>
            void handleRespondFriendRequest(requestId, action)
          }
          onOpenPersonProfile={openPersonProfile}
          onMessagePeer={openMessageWith}
        />
      </div>

      <section
        className={styles.chatPane}
        aria-label="Conversation"
        ref={chatPaneRef}
      >
        {activeConversation ? (
          <>
            <ChatHeader
              conversation={activeConversation}
              onBack={() => setPane('list')}
              securityOpen={securityOpen}
              onToggleSecurity={() => setSecurityOpen((v) => !v)}
              sessionState={sessionState}
              onOpenProfile={(opener) =>
                openConversationProfile(activeConversation.id, opener)
              }
            />
            <MessageList messages={activeMessages} loading={msgLoadingEffective} />
            <MessageInput
              value={draft}
              onChange={setDraft}
              onSend={handleSend}
            />
          </>
        ) : (
          <EmptyState />
        )}
      </section>

      <SecurityPanel
        open={securityOpen}
        onClose={() => setSecurityOpen(false)}
        sessionState={sessionState}
        identityState={identityState}
        contactName={activeConversation?.name}
      />

      {profileTarget && (
        <ContactProfile
          target={profileTarget}
          isDemoAccount={user?.username === 'demo'}
          trapFocus={isMobile}
          pendingAction={activePendingKey}
          onClose={closeContactProfile}
          onMessage={handleProfileMessage}
          onSendFriendRequest={handleProfileSendRequest}
          onRespondFriendRequest={handleProfileRespond}
        />
      )}

      <StatusToast toast={visibleToast} onDismiss={dismissToast} />
    </div>
  );
}

function EmptyState() {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon} aria-hidden="true">
        <Lock size={28} />
      </span>
      <h2 className={styles.emptyTitle}>Select a conversation</h2>
      <p className={styles.emptyText}>
        Choose a chat from the sidebar to start messaging.
      </p>
    </div>
  );
}
