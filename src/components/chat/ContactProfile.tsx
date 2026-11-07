import { useEffect, useRef } from 'react';
import { ArrowLeft, MessageSquare } from 'lucide-react';
import type { Conversation } from '../../types';
import { seedSearchableUsers } from '../../api/seed';
import { Avatar } from '../Avatar';
import styles from './ContactProfile.module.css';

interface ContactProfileProps {
  conversation: Conversation;
  /** App-level demo state (designated demo account) — gates the demo note. */
  isDemoAccount: boolean;
  /** Mobile full-screen modal: cycle Tab inside and mark the dialog modal. */
  trapFocus: boolean;
  onClose: () => void;
  /** "Message {name}" — closes the profile and opens that conversation. */
  onMessage: () => void;
}

/**
 * Heuristic join against the existing public user directory (the same seed
 * data behind /api/users/search): a conversation's first name matches a
 * username. Deterministic for the current seed; when no match exists (e.g.
 * Ben Tsang, Chloe Wong) the Username row is omitted entirely. Not a
 * reliable identity link — do not extend it to security decisions.
 */
function contactUsername(name: string): string | null {
  const first = name.split(' ')[0].toLowerCase();
  const match = seedSearchableUsers.find(
    (u) => u.username.toLowerCase() === first,
  );
  return match ? `@${match.username}` : null;
}

/**
 * Read-only Contact Profile overlay (usability task 3, reference layout).
 *
 * Shows only data that exists on the conversation record: display name,
 * a joined public username (when one matches), optional About, and presence.
 * There is intentionally no email, no edit/settings/logout controls, no
 * security badges, and no username fabrication. Rendering this overlay never
 * unmounts the chat behind it, so the draft, selection and scroll position
 * are preserved.
 */
export function ContactProfile({
  conversation,
  isDemoAccount,
  trapFocus,
  onClose,
  onMessage,
}: ContactProfileProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const username = contactUsername(conversation.name);
  const online = conversation.status === 'online';
  const firstName = conversation.name.split(' ')[0];

  // Focus the panel on mount.
  useEffect(() => {
    rootRef.current?.focus();
  }, []);

  // Escape closes; on mobile (full-screen modal) Tab is cycled inside.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (!trapFocus || e.key !== 'Tab') return;
      const root = rootRef.current;
      if (!root) return;
      const focusables = root.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [trapFocus, onClose]);

  return (
    <div
      ref={rootRef}
      className={styles.overlay}
      role="dialog"
      aria-modal={trapFocus || undefined}
      aria-label={`Contact profile — ${conversation.name}`}
      tabIndex={-1}
    >
      <div className={styles.backRow}>
        <button type="button" className={styles.backBtn} onClick={onClose}>
          <ArrowLeft size={18} aria-hidden="true" />
          <span>Back to chats</span>
        </button>
      </div>

      <div className={styles.panel}>
        <div className={styles.panelBody}>
          <h2 className={styles.title}>Profile</h2>
          <p className={styles.subtitle}>Contact information</p>

          <div className={styles.identity}>
            <Avatar
              initials={conversation.initials}
              color={conversation.color}
              size="xl"
              name={conversation.name}
            />
            <div className={styles.identityInfo}>
              <p className={styles.displayName}>{conversation.name}</p>
              {username && <p className={styles.atUsername}>{username}</p>}
              <p
                className={`${styles.presence} ${online ? styles.presenceOnline : styles.presenceOffline}`}
              >
                <span className={styles.presenceDot} aria-hidden="true" />
                {online ? 'Online' : 'Offline'}
              </p>
            </div>
          </div>

          <h3 className={styles.detailsTitle}>Contact details</h3>
          <dl className={styles.details}>
            <div className={styles.detailRow}>
              <dt>Display name</dt>
              <dd>{conversation.name}</dd>
            </div>
            {username && (
              <div className={styles.detailRow}>
                <dt>Username</dt>
                <dd>{username}</dd>
              </div>
            )}
            {conversation.about && (
              <div className={styles.detailRow}>
                <dt>About</dt>
                <dd>{conversation.about}</dd>
              </div>
            )}
          </dl>

          <button type="button" className={styles.messageBtn} onClick={onMessage}>
            <MessageSquare size={18} aria-hidden="true" />
            <span>Message {firstName}</span>
          </button>

          <p className={styles.footnote}>
            Only shared profile information is shown.
          </p>
        </div>
      </div>

      {isDemoAccount && (
        <p className={styles.demoNote}>
          Demo mode — messages stay in this browser; E2EE is not active.
        </p>
      )}
    </div>
  );
}
