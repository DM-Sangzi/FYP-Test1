import { useEffect, useRef } from 'react';
import type { Message } from '../../types';
import { MessageBubble } from './MessageBubble';
import styles from './MessageList.module.css';

interface MessageListProps {
  messages: Message[];
  loading?: boolean;
}

/**
 * Scrollable message thread (PRD §5.4).
 * Inserts "Today" / "Yesterday" date dividers between groups and auto-scrolls
 * to the bottom on new messages.
 */
export function MessageList({ messages, loading }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  return (
    <div className={styles.scroll} role="log" aria-live="polite" aria-label="Message thread">
      {loading ? (
        <div className={styles.state}>Loading messages…</div>
      ) : messages.length === 0 ? (
        <div className={styles.state}>No messages yet. Say hello!</div>
      ) : (
        <ul className={styles.list}>
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const divider = dateDividerLabel(prev?.at, m.at);
            return (
              <MessageBubble key={m.id} message={m} showDateDivider={divider ?? undefined} />
            );
          })}
        </ul>
      )}
      <div ref={endRef} />
    </div>
  );
}

/**
 * Returns a label if `current` begins a new day-group relative to `previous`,
 * otherwise null. Labels: "Today" / "Yesterday" / weekday name.
 */
function dateDividerLabel(previousIso: string | undefined, currentIso: string): string | null {
  const current = new Date(currentIso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const curDay = new Date(current.getFullYear(), current.getMonth(), current.getDate()).getTime();

  const todayLabel = curDay === startOfToday ? 'Today' : null;
  const yesterdayLabel =
    curDay === startOfToday - 86_400_000 ? 'Yesterday' : null;
  const fallback = current.toLocaleDateString([], {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
  const currentLabel = todayLabel ?? yesterdayLabel ?? fallback;

  if (!previousIso) return currentLabel;
  const prev = new Date(previousIso);
  const prevDay = new Date(prev.getFullYear(), prev.getMonth(), prev.getDate()).getTime();
  return curDay === prevDay ? null : currentLabel;
}
