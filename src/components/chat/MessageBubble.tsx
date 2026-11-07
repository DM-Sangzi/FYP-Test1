import type { Message } from '../../types';
import styles from './MessageBubble.module.css';

interface MessageBubbleProps {
  message: Message;
  /** Whether this is the first message of a new date group (shows divider). */
  showDateDivider?: string;
  /** Whether this starts a run from the same sender (controls spacing). */
  firstInGroup?: boolean;
}

/**
 * A single chat bubble (PRD §5.4 Message list; redesigned).
 * Sent messages align right with a tinted bubble; received align left.
 * Consecutive messages from the same sender sit close together.
 */
export function MessageBubble({
  message,
  showDateDivider,
  firstInGroup = true,
}: MessageBubbleProps) {
  const sent = message.direction === 'sent';
  return (
    <li
      className={styles.row}
      data-sent={sent ? 'true' : 'false'}
      data-first={firstInGroup ? 'true' : 'false'}
    >
      {showDateDivider && (
        <div className={styles.divider} role="separator" aria-label={showDateDivider}>
          <span>{showDateDivider}</span>
        </div>
      )}
      <div className={`${styles.bubble} ${sent ? styles.sent : styles.received}`}>
        <p className={styles.text}>{message.text}</p>
        <time className={styles.time} dateTime={message.at}>
          {formatTime(message.at)}
        </time>
      </div>
    </li>
  );
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}
