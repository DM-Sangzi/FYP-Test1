import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  Lock,
  MessageSquare,
  MessageSquarePlus,
  Search,
  Settings,
  Users,
} from 'lucide-react';
import type {
  Conversation,
  FriendEntry,
  FriendRequestsOverview,
  PeopleResult,
} from '../../types';
import { searchPeople } from '../../api/client';
import { Avatar } from '../Avatar';
import { FriendRequests } from './FriendRequests';
import styles from './Sidebar.module.css';

type SidebarView = 'chats' | 'new-chat' | 'requests';

/** A peer the social actions can address (always a real account). */
export interface SocialPeer {
  id: string;
  username: string;
}

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  loading?: boolean;
  /** Called on mobile when a conversation is chosen (to switch panes). */
  onNavigateToChat?: () => void;
  /** Signed-in user for the bottom profile row (mock auth). */
  currentUser?: { username: string; avatarUrl?: string };
  /** Conversation id → the peer's avatar, resolved by the parent from the
   *  shared social data (stable participant user IDs only). A missing entry
   *  or value — seed conversations included — falls back to initials. */
  conversationAvatars?: Record<string, string | undefined>;
  /** Opens the read-only contact profile for a conversation. The opener
   * element is reported so focus can return to it on close. */
  onOpenProfile: (conversationId: string, opener: HTMLElement) => void;
  /* ---- social (friends & requests) ---- */
  friends: FriendEntry[];
  requests: FriendRequestsOverview;
  socialError: string | null;
  /** Bumped by the parent after a social action so the people list refetches
   *  and relationship states stay in sync everywhere. */
  socialTick: number;
  /** Key of the social action in flight (disables social buttons). */
  pendingAction: string | null;
  onSendFriendRequest: (peer: SocialPeer) => void;
  onRespondFriendRequest: (requestId: string, action: 'accept' | 'decline' | 'cancel') => void;
  /** Opens the read-only profile for a search/friends entry. */
  onOpenPersonProfile: (person: PeopleResult, opener: HTMLElement) => void;
  /** Opens (or reuses) the conversation with a friend. */
  onMessagePeer: (peer: SocialPeer) => void;
}

/**
 * Chat sidebar (PRD §5.4; usability refinement).
 *
 * Three views share one column so lists never stack:
 * - 'chats': New chat + Friend requests entry, conversation search + list.
 * - 'new-chat': Back to chats, Search people, the Friends group (empty
 *   query) and relationship-aware people rows.
 * - 'requests': Received/Sent friend requests.
 * The account footer stays outside scrolling.
 */
export function Sidebar({
  conversations,
  activeId,
  onSelect,
  loading,
  onNavigateToChat,
  currentUser,
  conversationAvatars,
  onOpenProfile,
  friends,
  requests,
  socialError,
  socialTick,
  pendingAction,
  onSendFriendRequest,
  onRespondFriendRequest,
  onOpenPersonProfile,
  onMessagePeer,
}: SidebarProps) {
  const [view, setView] = useState<SidebarView>('chats');
  const [query, setQuery] = useState('');
  const [peopleQuery, setPeopleQuery] = useState('');
  const [peopleResults, setPeopleResults] = useState<PeopleResult[] | null>(null);
  const [peopleSearching, setPeopleSearching] = useState(false);
  const [peopleError, setPeopleError] = useState(false);

  const receivedPendingCount = requests.received.filter((r) => r.status === 'pending').length;
  const busy = pendingAction !== null;

  const filtered = query.trim()
    ? conversations.filter((c) =>
        c.name.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : conversations;

  // People search runs only while the new-chat view is open. socialTick
  // refetches after social actions so relationship states stay current.
  useEffect(() => {
    if (view !== 'new-chat') return;
    let active = true;
    searchPeople(peopleQuery.trim())
      .then((r) => {
        if (!active) return;
        setPeopleResults(r);
        setPeopleError(false);
        setPeopleSearching(false);
      })
      .catch(() => {
        if (!active) return;
        setPeopleResults([]);
        setPeopleError(true);
        setPeopleSearching(false);
      });
    return () => {
      active = false;
    };
  }, [peopleQuery, view, socialTick]);

  // Escape returns to the chats view without changing the active chat.
  useEffect(() => {
    if (view === 'chats') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setView('chats');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view]);

  function openNewChatView() {
    setPeopleQuery('');
    setPeopleResults(null);
    setPeopleError(false);
    setPeopleSearching(true);
    setView('new-chat');
  }

  function openRequestsView() {
    setView('requests');
  }

  function backToChats() {
    setView('chats');
    setPeopleQuery('');
    setPeopleResults(null);
    setPeopleError(false);
    setPeopleSearching(false);
  }

  function handleSelect(id: string) {
    onSelect(id);
    onNavigateToChat?.();
  }

  return (
    <aside className={styles.sidebar} aria-label="Conversations">
      <header className={styles.header}>
        <Link to="/" className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            <Lock size={16} />
          </span>
          <span className={styles.brandName}>PQPM</span>
        </Link>
      </header>

      {view === 'chats' ? (
        <>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.newChatBtn}
              onClick={openNewChatView}
            >
              <MessageSquarePlus size={18} aria-hidden="true" />
              <span>New chat</span>
            </button>

            <button
              type="button"
              className={styles.friendRequestsBtn}
              onClick={openRequestsView}
            >
              <Users size={18} aria-hidden="true" />
              <span>Friend requests</span>
              {receivedPendingCount > 0 && (
                <span className={styles.countBadge}>
                  {receivedPendingCount}
                  <span className={styles.srOnly}>
                    {' '}
                    {receivedPendingCount === 1 ? 'request' : 'requests'} to review
                  </span>
                </span>
              )}
            </button>

            <div className={styles.search}>
              <Search size={16} className={styles.searchIcon} aria-hidden="true" />
              <label htmlFor="chat-search" className={styles.srOnly}>
                Search chats or contacts
              </label>
              <input
                id="chat-search"
                type="search"
                className={styles.searchInput}
                placeholder="Search chats or contacts"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          <nav className={styles.list} aria-label="Conversation list">
            {loading ? (
              <div className={styles.state}>Loading conversations…</div>
            ) : filtered.length === 0 ? (
              <div className={styles.state}>No conversations found.</div>
            ) : (
              <ul>
                {filtered.map((c) => (
                  <li
                    key={c.id}
                    className={`${styles.itemRow} ${c.id === activeId ? styles.activeRow : ''}`}
                  >
                    {/* Contact profile entry: the avatar only. Clicking it
                        opens the read-only profile without switching chats. */}
                    <button
                      type="button"
                      className={styles.avatarBtn}
                      onClick={(e) => onOpenProfile(c.id, e.currentTarget)}
                      aria-label={`View ${c.name}'s profile`}
                      title={`View ${c.name}'s profile`}
                    >
                      <Avatar
                        initials={c.initials}
                        color={c.color}
                        name={c.name}
                        online={c.status === 'online'}
                        src={conversationAvatars?.[c.id]}
                      />
                    </button>
                    {/* Everything else keeps the original selection behaviour. */}
                    <button
                      type="button"
                      className={styles.item}
                      onClick={() => handleSelect(c.id)}
                      aria-current={c.id === activeId ? 'true' : undefined}
                    >
                      <div className={styles.itemBody}>
                        <div className={styles.itemTop}>
                          <span className={styles.itemName} title={c.name}>
                            {c.name}
                          </span>
                          <span className={styles.itemTime}>
                            {formatListTime(c.lastMessageAt)}
                          </span>
                        </div>
                        <div className={styles.itemBottom}>
                          <span className={styles.itemPreview}>
                            {c.lastMessage || 'No messages yet'}
                          </span>
                          {c.unread > 0 && (
                            <span className={styles.badge} aria-label={`${c.unread} unread`}>
                              {c.unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </nav>
        </>
      ) : view === 'requests' ? (
        <FriendRequests
          onBack={backToChats}
          received={requests.received}
          sent={requests.sent}
          socialError={socialError}
          pendingAction={pendingAction}
          onRespond={onRespondFriendRequest}
          onOpenPersonProfile={onOpenPersonProfile}
          onMessagePeer={onMessagePeer}
        />
      ) : (
        <div className={styles.peopleView}>
          <button
            type="button"
            className={styles.backToChats}
            onClick={backToChats}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            <span>Back to chats</span>
          </button>

          <label htmlFor="people-search" className={styles.peopleLabel}>
            Search people
          </label>
          <div className={styles.search}>
            <Search size={16} className={styles.searchIcon} aria-hidden="true" />
            <input
              id="people-search"
              type="search"
              className={styles.searchInput}
              placeholder="Search people…"
              value={peopleQuery}
              onChange={(e) => {
                setPeopleQuery(e.target.value);
                setPeopleResults(null);
                setPeopleSearching(true);
                setPeopleError(false);
              }}
            />
          </div>

          <div className={styles.peopleList} aria-live="polite">
            {peopleSearching ? (
              <p className={styles.peopleState}>
                <Loader2 size={14} className={styles.spin} aria-hidden="true" />
                Searching…
              </p>
            ) : peopleError ? (
              <p className={styles.peopleState}>
                Search failed. Check the connection and try again.
              </p>
            ) : peopleResults === null ? (
              <p className={styles.peopleState}>Searching…</p>
            ) : (
              <>
                {/* Friends group: the persisted friends list, shown while the
                    search field is empty. Independent of the query results. */}
                {peopleQuery.trim() === '' && (
                  <section className={styles.group} aria-labelledby="friends-heading">
                    <h3 id="friends-heading" className={styles.groupLabel}>
                      Friends
                    </h3>
                    {socialError ? (
                      <p className={styles.socialError} role="alert">
                        {socialError}
                      </p>
                    ) : friends.length === 0 ? (
                      <p className={styles.peopleState}>
                        No friends yet. Search below and send a friend request.
                      </p>
                    ) : (
                      <ul className={styles.peopleListUl}>
                        {friends.map((f) => (
                          <PersonRow
                            key={f.userId}
                            person={{
                              id: f.userId,
                              username: f.username,
                              kind: 'account',
                              relationship: { state: 'friends' },
                              avatarUrl: f.avatarUrl,
                            }}
                            busy={busy}
                            onOpenPersonProfile={onOpenPersonProfile}
                            onSendFriendRequest={onSendFriendRequest}
                            onRespondFriendRequest={onRespondFriendRequest}
                            onMessagePeer={onMessagePeer}
                          />
                        ))}
                      </ul>
                    )}
                  </section>
                )}

                <section
                  className={styles.group}
                  aria-label={peopleQuery.trim() === '' ? 'People directory' : 'Search results'}
                >
                  {peopleResults.length === 0 && peopleQuery.trim() !== '' ? (
                    <p className={styles.peopleState}>No people found.</p>
                  ) : peopleResults.length === 0 ? (
                    <p className={styles.peopleState}>No people to show.</p>
                  ) : (
                    <ul className={styles.peopleListUl}>
                      {peopleResults.map((u) => (
                        <PersonRow
                          key={u.id}
                          person={u}
                          busy={busy}
                          onOpenPersonProfile={onOpenPersonProfile}
                          onSendFriendRequest={onSendFriendRequest}
                          onRespondFriendRequest={onRespondFriendRequest}
                          onMessagePeer={onMessagePeer}
                        />
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}
          </div>
        </div>
      )}

      {currentUser && (
        <footer className={styles.footer}>
          <Avatar
            initials={currentUser.username.slice(0, 2)}
            color="teal"
            size="md"
            name={currentUser.username}
            src={currentUser.avatarUrl}
          />
          <div className={styles.userMeta}>
            <span className={styles.userName} title={currentUser.username}>
              {currentUser.username}
            </span>
            <span className={styles.demoChip}>Demo mode</span>
          </div>
          <Link
            to="/profile"
            className={styles.iconBtn}
            aria-label="Profile and settings"
            title="Profile and settings"
          >
            <Settings size={18} />
          </Link>
        </footer>
      )}
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Relationship-aware person row                                       */
/* ------------------------------------------------------------------ */

interface PersonRowProps {
  person: PeopleResult;
  busy: boolean;
  onOpenPersonProfile: (person: PeopleResult, opener: HTMLElement) => void;
  onSendFriendRequest: (peer: SocialPeer) => void;
  onRespondFriendRequest: (requestId: string, action: 'accept' | 'decline' | 'cancel') => void;
  onMessagePeer: (peer: SocialPeer) => void;
}

/**
 * One directory/friend row: avatar opens the read-only profile; the name is
 * plain text; relationship actions sit at the end. Flat buttons only (no
 * nesting), long names ellipsize — same split-row pattern as conversations.
 */
function PersonRow({
  person,
  busy,
  onOpenPersonProfile,
  onSendFriendRequest,
  onRespondFriendRequest,
  onMessagePeer,
}: PersonRowProps) {
  const isSample = person.kind === 'sample';
  const state = person.relationship.state;

  return (
    <li className={styles.peopleRowItem}>
      <button
        type="button"
        className={styles.peopleAvatarBtn}
        onClick={(e) => onOpenPersonProfile(person, e.currentTarget)}
        aria-label={`View ${person.username}'s profile`}
        title={`View ${person.username}'s profile`}
      >
        <Avatar
          initials={person.username.slice(0, 2).toUpperCase()}
          color="slate"
          size="sm"
          name={person.username}
          src={person.avatarUrl}
        />
      </button>
      <span className={styles.peopleName} title={person.username}>
        {person.username}
      </span>
      {isSample ? (
        <span className={styles.sampleChip}>Sample contact</span>
      ) : state === 'none' ? (
        <button
          type="button"
          className={styles.actionBtn}
          disabled={busy}
          onClick={() => onSendFriendRequest({ id: person.id, username: person.username })}
        >
          Add friend
        </button>
      ) : state === 'request-sent' ? (
        <span className={styles.actionGroup}>
          <span className={styles.stateChip}>Request sent</span>
          <button
            type="button"
            className={styles.actionBtnGhost}
            disabled={busy}
            onClick={() => onRespondFriendRequest(person.relationship.requestId!, 'cancel')}
          >
            Cancel
          </button>
        </span>
      ) : state === 'request-received' ? (
        <span className={styles.actionGroup}>
          <button
            type="button"
            className={styles.actionBtn}
            disabled={busy}
            onClick={() => onRespondFriendRequest(person.relationship.requestId!, 'accept')}
          >
            Accept
          </button>
          <button
            type="button"
            className={styles.actionBtnGhost}
            disabled={busy}
            onClick={() => onRespondFriendRequest(person.relationship.requestId!, 'decline')}
          >
            Decline
          </button>
        </span>
      ) : (
        <button
          type="button"
          className={styles.actionBtn}
          disabled={busy}
          onClick={() => onMessagePeer({ id: person.id, username: person.username })}
        >
          <MessageSquare size={14} aria-hidden="true" />
          <span>Message</span>
        </button>
      )}
    </li>
  );
}

function formatListTime(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}
