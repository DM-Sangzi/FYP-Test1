import { useRef } from 'react';
import { ArrowLeft, LockOpen, Search as SearchIcon } from 'lucide-react';
import type { Conversation } from '../../types';
import type { SessionState } from './SecurityPanel';
import { Avatar } from '../Avatar';
import styles from './ChatHeader.module.css';

const SESSION_LABEL: Record<SessionState, string> = {
  'not-established': 'E2EE not established',
  establishing: 'E2EE establishing',
  active: 'E2EE active',
  failed: 'E2EE failed',
};

interface ChatHeaderProps {
  conversation: Conversation | null;
  /** The peer's avatar from the shared social data (same source as the
   *  Contact Profile); absent or failed load = initials fallback. */
  avatarUrl?: string;
  /** Real session state — shown as text, never inferred from login. */
  sessionState?: SessionState;
  /** Reflects whether the security panel is open (for aria-expanded). */
  securityOpen?: boolean;
  onToggleSecurity?: () => void;
  /** Opens the read-only contact profile for this conversation. */
  onOpenProfile?: (opener: HTMLElement | null) => void;
  onSearch?: () => void;
  onBack?: () => void;
}

/**
 * Chat header (PRD §5.4; redesigned).
 * Contact identity + presence on the left; a factual security-state chip
 * (opens the conversation security panel) on the right. The chip reports
 * the real session state — it never implies encryption that does not exist.
 */
export function ChatHeader({
  conversation,
  avatarUrl,
  sessionState = 'not-established',
  securityOpen,
  onToggleSecurity,
  onOpenProfile,
  onSearch,
  onBack,
}: ChatHeaderProps) {
  const avatarBtnRef = useRef<HTMLButtonElement>(null);
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
      {onOpenProfile ? (
        <button
          type="button"
          ref={avatarBtnRef}
          className={styles.avatarBtn}
          onClick={() => onOpenProfile(avatarBtnRef.current)}
          aria-label={`View ${conversation.name}'s profile`}
          title={`View ${conversation.name}'s profile`}
        >
          <Avatar
            initials={conversation.initials}
            color={conversation.color}
            name={conversation.name}
            online={conversation.status === 'online'}
            src={avatarUrl}
          />
        </button>
      ) : (
        <Avatar
          initials={conversation.initials}
          color={conversation.color}
          name={conversation.name}
          online={conversation.status === 'online'}
          src={avatarUrl}
        />
      )}
      <div className={styles.titles}>
        <h2 className={styles.name}>{conversation.name}</h2>
        <span className={`${styles.status} ${conversation.status === 'online' ? styles.online : ''}`}>
          <span className={styles.statusDot} aria-hidden="true" />
          {statusLabel}
        </span>
      </div>

      <div className={styles.actions}>
        {onToggleSecurity && (
          <button
            type="button"
            className={styles.securityChip}
            onClick={onToggleSecurity}
            aria-expanded={securityOpen}
            aria-label={`Conversation security: ${SESSION_LABEL[sessionState]}. Open details`}
            title={SESSION_LABEL[sessionState]}
          >
            <LockOpen size={14} aria-hidden="true" />
            <span>{SESSION_LABEL[sessionState]}</span>
          </button>
        )}
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
