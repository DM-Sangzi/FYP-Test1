import { useEffect, useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import { getConversations, getMessages } from '../api/client';
import type { AvatarColor, Conversation, Message } from '../types';
import { Sidebar } from '../components/chat/Sidebar';
import { ChatHeader } from '../components/chat/ChatHeader';
import { MessageList } from '../components/chat/MessageList';
import { MessageInput } from '../components/chat/MessageInput';
import { SecurityPanel } from '../components/chat/SecurityPanel';
import { ContactProfile } from '../components/chat/ContactProfile';
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

/**
 * Chat shell (PRD §5.1 /chat, §5.4 layout, §9 IA).
 *
 * Two-pane layout: sidebar (conversation list) + chat area (header, thread,
 * composer). Data is loaded from the API client (MSW in mock mode). Messages
 * are optimistically appended to local state on send (real-time WS is a
 * Non-Goal for this phase — PRD §2.2 — so the echo is local-only).
 *
 * Redesign additions: an on-demand conversation security panel (bound to the
 * real, currently "not established" E2EE state) and a demonstration "New
 * chat" flow that starts local-only conversations from the mock user search.
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
  /** Contact profile overlay: conversation id being viewed (null = closed).
   * Opening this overlay never unmounts the chat behind it, so the draft,
   * selection and MessageList scroll position are all preserved. */
  const [profileContactId, setProfileContactId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia?.('(max-width: 767px)').matches ?? false,
  );
  const chatPaneRef = useRef<HTMLElement>(null);
  const sidebarPaneRef = useRef<HTMLDivElement>(null);
  const profileOpenerRef = useRef<HTMLElement | null>(null);

  // Real security state: no E2EE integration exists yet, so these are the
  // only honest values. Typed unions allow future states without redesign.
  const sessionState: SessionState = 'not-established';
  const identityState: IdentityState = 'not-verified';

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
      if (profileContactId) pane.setAttribute('inert', '');
      else pane.removeAttribute('inert');
    }
  }, [profileContactId]);

  useEffect(() => {
    const pane = sidebarPaneRef.current;
    if (pane) {
      if (profileContactId && isMobile) pane.setAttribute('inert', '');
      else pane.removeAttribute('inert');
    }
  }, [profileContactId, isMobile]);

  function openContactProfile(id: string, opener: HTMLElement | null) {
    setSecurityOpen(false);
    profileOpenerRef.current = opener;
    setProfileContactId(id);
  }

  function closeContactProfile() {
    setProfileContactId(null);
    // Return focus to the avatar entry that opened the profile.
    profileOpenerRef.current?.focus();
  }

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
    setProfileContactId(null);
    // Clear unread badge on open.
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c)),
    );
  }

  /**
   * Demo "New chat" flow: selecting a person opens their existing
   * conversation when one exists (no duplicates); otherwise starts a
   * local, non-persisted conversation. Clearly demo behaviour.
   */
  function handleContactSelected(username: string) {
    const existing = conversations.find(
      (c) => c.name.toLowerCase() === username.toLowerCase(),
    );
    if (existing) {
      handleSelect(existing.id);
      return;
    }
    const id = `local-${Date.now()}`;
    const conv: Conversation = {
      id,
      name: username,
      initials: username.slice(0, 2).toUpperCase(),
      color: LOCAL_COLORS[conversations.length % LOCAL_COLORS.length],
      status: 'online',
      lastMessage: '',
      lastMessageAt: new Date().toISOString(),
      unread: 0,
    };
    setConversations((prev) => [conv, ...prev]);
    setActiveId(id);
    setPane('thread');
  }

  const profileContact = profileContactId
    ? (conversations ?? []).find((c) => c.id === profileContactId) ?? null
    : null;

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
          onSelectContact={handleContactSelected}
          onOpenProfile={openContactProfile}
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
                openContactProfile(activeConversation.id, opener)
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

      {profileContact && (
        <ContactProfile
          conversation={profileContact}
          isDemoAccount={user?.username === 'demo'}
          trapFocus={isMobile}
          onClose={closeContactProfile}
          onMessage={() => {
            setProfileContactId(null);
            handleSelect(profileContact.id);
          }}
        />
      )}
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
