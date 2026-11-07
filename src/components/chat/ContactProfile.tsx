import { useEffect, useRef } from 'react';
import { ArrowLeft, MessageSquare } from 'lucide-react';
import type { AvatarColor, RelationshipInfo } from '../../types';
import { Avatar } from '../Avatar';
import styles from './ContactProfile.module.css';

/**
 * What the profile overlay shows. Built by the parent from either a
 * conversation (seed demo chats) or a directory entry (search results /
 * friends), so the overlay never guesses identity from names itself.
 */
export interface ProfileTarget {
  /** Stable key for React and for focus management. */
  key: string;
  kind: 'conversation' | 'account' | 'sample';
  displayName: string;
  /** Only set when the username is reliably known (account ids, never
   *  name-guessed from a display name). */
  username?: string;
  about?: string;
  /** Only set when presence data actually exists (seed conversations). */
  online?: boolean;
  color: AvatarColor;
  initials: string;
  /** The other account's user id (account-kind targets only). */
  peerUserId?: string;
  /** The conversation this target was opened from (conversation-kind only). */
  conversationId?: string;
  /** Relationship to the signed-in user — same source as search results. */
  relationship?: RelationshipInfo;
}

interface ContactProfileProps {
  target: ProfileTarget;
  /** App-level demo state (designated demo account) — gates the demo note. */
  isDemoAccount: boolean;
  /** Mobile full-screen modal: cycle Tab inside and mark the dialog modal. */
  trapFocus: boolean;
  /** Key of the social action in flight (disables social buttons). */
  pendingAction: string | null;
  onClose: () => void;
  /** "Message {name}" — closes the profile and opens that conversation. */
  onMessage?: () => void;
  /** Friend actions — same handlers the search results use. */
  onSendFriendRequest?: () => void;
  onRespondFriendRequest?: (action: 'accept' | 'decline' | 'cancel') => void;
}

/**
 * Read-only Contact Profile overlay.
 *
 * Shows only data that exists on the target: display name, a username only
 * when reliably known, optional About, presence when known, and the shared
 * relationship state for real accounts. Sample contacts are directory-only
 * demonstration entries — no friend actions. There is intentionally no
 * email, no edit/settings/logout controls, and no security badges. Rendering
 * this overlay never unmounts the chat behind it, so the draft, selection
 * and scroll position are preserved.
 */
export function ContactProfile({
  target,
  isDemoAccount,
  trapFocus,
  pendingAction,
  onClose,
  onMessage,
  onSendFriendRequest,
  onRespondFriendRequest,
}: ContactProfileProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const online = target.online;
  const firstName = target.displayName.split(' ')[0];
  const busy = pendingAction !== null;
  const state = target.relationship?.state;

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
      aria-label={`Contact profile — ${target.displayName}`}
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
              initials={target.initials}
              color={target.color}
              size="xl"
              name={target.displayName}
            />
            <div className={styles.identityInfo}>
              <p className={styles.displayName}>{target.displayName}</p>
              {target.username && <p className={styles.atUsername}>{`@${target.username}`}</p>}
              {online !== undefined && (
                <p
                  className={`${styles.presence} ${online ? styles.presenceOnline : styles.presenceOffline}`}
                >
                  <span className={styles.presenceDot} aria-hidden="true" />
                  {online ? 'Online' : 'Offline'}
                </p>
              )}
            </div>
          </div>

          <h3 className={styles.detailsTitle}>Contact details</h3>
          <dl className={styles.details}>
            <div className={styles.detailRow}>
              <dt>Display name</dt>
              <dd>{target.displayName}</dd>
            </div>
            {target.kind === 'sample' && (
              <div className={styles.detailRow}>
                <dt>Type</dt>
                <dd>Sample contact</dd>
              </div>
            )}
            {target.username && (
              <div className={styles.detailRow}>
                <dt>Username</dt>
                <dd>{`@${target.username}`}</dd>
              </div>
            )}
            {target.about && (
              <div className={styles.detailRow}>
                <dt>About</dt>
                <dd>{target.about}</dd>
              </div>
            )}
          </dl>

          {target.kind === 'account' && target.relationship && (
            <div className={styles.socialBlock}>
              <h3 className={styles.detailsTitle}>Connection</h3>
              {state === 'none' && onSendFriendRequest && (
                <button
                  type="button"
                  className={styles.messageBtn}
                  disabled={busy}
                  onClick={onSendFriendRequest}
                >
                  <span>Add friend</span>
                </button>
              )}
              {state === 'request-sent' && onRespondFriendRequest && (
                <div className={styles.socialRow}>
                  <span className={styles.relLine}>Request sent</span>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    disabled={busy}
                    onClick={() => onRespondFriendRequest('cancel')}
                  >
                    Cancel request
                  </button>
                </div>
              )}
              {state === 'request-received' && onRespondFriendRequest && (
                <div className={styles.socialRow}>
                  <button
                    type="button"
                    className={styles.messageBtn}
                    disabled={busy}
                    onClick={() => onRespondFriendRequest('accept')}
                  >
                    <span>Accept</span>
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    disabled={busy}
                    onClick={() => onRespondFriendRequest('decline')}
                  >
                    Decline
                  </button>
                </div>
              )}
              {state === 'friends' && (
                <div className={styles.socialRow}>
                  <span className={styles.relLine}>You are friends</span>
                  {onMessage && (
                    <button type="button" className={styles.messageBtn} onClick={onMessage}>
                      <MessageSquare size={18} aria-hidden="true" />
                      <span>Message {firstName}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {target.kind === 'sample' && (
            <p className={styles.sampleNote}>
              Sample contact — a demonstration directory entry without an
              account. Friend requests are not available.
            </p>
          )}

          {/* Legacy demo conversations keep their Message entry (messaging is
              unchanged); friend actions above are reserved for accounts. */}
          {target.kind === 'conversation' && onMessage && (
            <button type="button" className={styles.messageBtn} onClick={onMessage}>
              <MessageSquare size={18} aria-hidden="true" />
              <span>Message {firstName}</span>
            </button>
          )}

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
