import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { getConversations, getMessages } from '../api/client';
import type { Conversation, Message } from '../types';
import { Sidebar } from '../components/chat/Sidebar';
import { ChatHeader } from '../components/chat/ChatHeader';
import { MessageList } from '../components/chat/MessageList';
import { MessageInput } from '../components/chat/MessageInput';
import styles from './Chat.module.css';

/**
 * Chat shell (PRD §5.1 /chat, §5.4 layout, §9 IA).
 *
 * Two-pane layout: sidebar (conversation list) + chat area (header, thread,
 * composer). Data is loaded from the API client (MSW in mock mode). Messages
 * are optimistically appended to local state on send (real-time WS is a
 * Non-Goal for this phase — PRD §2.2 — so the echo is local-only).
 */
export function Chat() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convLoading, setConvLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [draft, setDraft] = useState('');
  /** Mobile pane switch: 'list' | 'thread' (PRD §6.3 responsive). */
  const [pane, setPane] = useState<'list' | 'thread'>('list');

  // Load conversation list once.
  useEffect(() => {
    let active = true;
    setConvLoading(true);
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

  // Load messages when the active conversation changes.
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    let active = true;
    setMsgLoading(true);
    getMessages(activeId)
      .then((data) => active && setMessages(data))
      .finally(() => active && setMsgLoading(false));
    return () => {
      active = false;
    };
  }, [activeId]);

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
    // Clear unread badge on open.
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c)),
    );
  }

  return (
    <div className={styles.shell} data-pane={pane}>
      <div className={styles.sidebarPane}>
        <Sidebar
          conversations={conversations}
          activeId={activeId}
          onSelect={handleSelect}
          loading={convLoading}
          onNavigateToChat={() => setPane('thread')}
        />
      </div>

      <section className={styles.chatPane} aria-label="Conversation">
        {activeConversation ? (
          <>
            <ChatHeader
              conversation={activeConversation}
              onBack={() => setPane('list')}
            />
            <MessageList messages={messages} loading={msgLoading} />
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
