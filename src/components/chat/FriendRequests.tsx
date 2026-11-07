import { ArrowLeft, Users } from 'lucide-react';
import type { FriendRequestView, PeopleResult } from '../../types';
import { Avatar } from '../Avatar';
import styles from './FriendRequests.module.css';

interface FriendRequestsProps {
  /** Returns to the chats view (owned by the Sidebar). */
  onBack: () => void;
  received: FriendRequestView[];
  sent: FriendRequestView[];
  /** Store-level failure (e.g. corrupted localStorage) — shown, never crashes. */
  socialError: string | null;
  /** Key of the social action currently in flight; disables buttons. */
  pendingAction: string | null;
  onRespond: (requestId: string, action: 'accept' | 'decline' | 'cancel') => void;
  onOpenPersonProfile: (person: PeopleResult, opener: HTMLElement) => void;
  onMessagePeer: (peer: { id: string; username: string }) => void;
}

/**
 * "Friend requests" sidebar view: Received (Accept/Decline) and Sent
 * (Cancel). Accepted rows turn into a Friends + Message row where the
 * request used to be — accepting never switches the active conversation.
 */
export function FriendRequests({
  onBack,
  received,
  sent,
  socialError,
  pendingAction,
  onRespond,
  onOpenPersonProfile,
  onMessagePeer,
}: FriendRequestsProps) {
  const busy = pendingAction !== null;

  function personOf(row: FriendRequestView, direction: 'received' | 'sent'): PeopleResult {
    return {
      id: row.otherUser.id,
      username: row.otherUser.username,
      kind: 'account',
      relationship:
        row.status === 'accepted'
          ? { state: 'friends' }
          : {
              state: direction === 'received' ? 'request-received' : 'request-sent',
              requestId: row.id,
            },
    };
  }

  return (
    <div className={styles.requestsView}>
      <button type="button" className={styles.backToChats} onClick={onBack}>
        <ArrowLeft size={16} aria-hidden="true" />
        <span>Back to chats</span>
      </button>

      <h2 className={styles.viewTitle}>
        <Users size={18} aria-hidden="true" />
        <span>Friend requests</span>
      </h2>

      {socialError && (
        <p className={styles.errorLine} role="alert">
          {socialError}
        </p>
      )}

      <section className={styles.group} aria-labelledby="fr-received">
        <h3 id="fr-received" className={styles.groupLabel}>
          Received
        </h3>
        {received.length === 0 ? (
          <p className={styles.emptyLine}>No received requests.</p>
        ) : (
          <ul className={styles.rows}>
            {received.map((r) => (
              <li key={r.id} className={styles.row}>
                <button
                  type="button"
                  className={styles.avatarBtn}
                  onClick={(e) => onOpenPersonProfile(personOf(r, 'received'), e.currentTarget)}
                  aria-label={`View ${r.otherUser.username}'s profile`}
                  title={`View ${r.otherUser.username}'s profile`}
                >
                  <Avatar
                    initials={r.otherUser.username.slice(0, 2).toUpperCase()}
                    color="slate"
                    size="sm"
                    name={r.otherUser.username}
                  />
                </button>
                <span className={styles.rowName} title={r.otherUser.username}>
                  {r.otherUser.username}
                </span>
                {r.status === 'pending' ? (
                  <span className={styles.rowActions}>
                    <button
                      type="button"
                      className={styles.primaryBtn}
                      disabled={busy}
                      onClick={() => onRespond(r.id, 'accept')}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      disabled={busy}
                      onClick={() => onRespond(r.id, 'decline')}
                    >
                      Decline
                    </button>
                  </span>
                ) : (
                  <span className={styles.rowActions}>
                    <span className={styles.friendsChip}>Friends</span>
                    <button
                      type="button"
                      className={styles.primaryBtn}
                      disabled={busy}
                      onClick={() => onMessagePeer(r.otherUser)}
                    >
                      Message
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.group} aria-labelledby="fr-sent">
        <h3 id="fr-sent" className={styles.groupLabel}>
          Sent
        </h3>
        {sent.length === 0 ? (
          <p className={styles.emptyLine}>No sent requests.</p>
        ) : (
          <ul className={styles.rows}>
            {sent.map((r) => (
              <li key={r.id} className={styles.row}>
                <button
                  type="button"
                  className={styles.avatarBtn}
                  onClick={(e) => onOpenPersonProfile(personOf(r, 'sent'), e.currentTarget)}
                  aria-label={`View ${r.otherUser.username}'s profile`}
                  title={`View ${r.otherUser.username}'s profile`}
                >
                  <Avatar
                    initials={r.otherUser.username.slice(0, 2).toUpperCase()}
                    color="slate"
                    size="sm"
                    name={r.otherUser.username}
                  />
                </button>
                <span className={styles.rowName} title={r.otherUser.username}>
                  {r.otherUser.username}
                </span>
                {r.status === 'pending' ? (
                  <span className={styles.rowActions}>
                    <span className={styles.sentChip}>Request sent</span>
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      disabled={busy}
                      onClick={() => onRespond(r.id, 'cancel')}
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <span className={styles.rowActions}>
                    <span className={styles.friendsChip}>Friends</span>
                    <button
                      type="button"
                      className={styles.primaryBtn}
                      disabled={busy}
                      onClick={() => onMessagePeer(r.otherUser)}
                    >
                      Message
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
