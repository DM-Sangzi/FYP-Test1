import { ArrowLeft, Info, Search as SearchIcon, ShieldCheck } from 'lucide-react';
import type { Conversation } from '../../types';
import { Avatar } from '../Avatar';
import styles from './ChatHeader.module.css';

interface ChatHeaderProps {
  conversation: Conversation | null;
  /** Shows the privacy/security indicator (PRD §1.2: communicate security). */
  onInfo?: () => void;
  onSearch?: () => void;
  onBack?: () => void;
}

/**
 * Chat header (PRD §5.4): avatar + name + status, plus search/info actions.
 * Includes a discreet "secured" indicator so the UI communicates privacy
 * without exposing crypto details (PRD §1.2, US-15).
 */
export function ChatHeader({ conversation, onInfo, onSearch, onBack }: ChatHeaderProps) {
  if (!conversation) return null;
  const statusLabel =
    conversation.status === 'online'
      ? 'Online'
      : conversation.lastSeen
        ? `Last seen ${formatLastSeen(conversation.lastSeen)}`
        : 'Offline';

  return (
    <header className={styles.header}>
      {onBack && (
        <button
          type="button"
          className={styles.backBtn}
          onClick={onBack}
          aria-label="Back to conversations"
        >
          <ArrowLeft size={20} />
        </button>
      )}
      <Avatar
        initials={conversation.initials}
        color={conversation.color}
        name={conversation.name}
        online={conversation.status === 'online'}
      />
      <div className={styles.titles}>
        <h2 className={styles.name}>{conversation.name}</h2>
        <span className={`${styles.status} ${conversation.status === 'online' ? styles.online : ''}`}>
          <span className={styles.statusDot} aria-hidden="true" />
          {statusLabel}
        </span>
      </div>

      <div className={styles.actions}>
        <span className={styles.secured} title="This chat is secured" aria-label="Secured chat">
          <ShieldCheck size={16} />
        </span>
        {onSearch && (
          <button
            type="button"
            className={styles.iconBtn}
            onClick={onSearch}
            aria-label="Search in conversation"
          >
            <SearchIcon size={18} />
          </button>
        )}
        {onInfo && (
          <button
            type="button"
            className={styles.iconBtn}
            onClick={onInfo}
            aria-label="Conversation info"
          >
            <Info size={18} />
          </button>
        )}
      </div>
    </header>
  );
}

function formatLastSeen(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString())
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}
