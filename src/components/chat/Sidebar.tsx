import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  Lock,
  MessageSquarePlus,
  Search,
  Settings,
} from 'lucide-react';
import type { Conversation } from '../../types';
import { searchUsers } from '../../api/client';
import type { UserSearchResult } from '../../types';
import { Avatar } from '../Avatar';
import styles from './Sidebar.module.css';

type SidebarView = 'chats' | 'new-chat';

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  loading?: boolean;
  /** Called on mobile when a conversation is chosen (to switch panes). */
  onNavigateToChat?: () => void;
  /** Signed-in user for the bottom profile row (mock auth). */
  currentUser?: { username: string };
  /** Demo flow: select an existing conversation with this person, or start
   * a new local one. The parent decides — the sidebar never duplicates. */
  onSelectContact: (username: string) => void;
  /** Opens the read-only contact profile for a conversation. The opener
   * element is reported so focus can return to it on close. */
  onOpenProfile: (conversationId: string, opener: HTMLElement) => void;
}

/**
 * Chat sidebar (PRD §5.4; usability refinement).
 *
 * Two views share one column so lists never stack:
 * - 'chats': conversation search + conversation list (one scroll region).
 * - 'new-chat': Back to chats, a single Search people field, and one
 *   scrollable contact list. The account footer stays outside scrolling.
 */
export function Sidebar({
  conversations,
  activeId,
  onSelect,
  loading,
  onNavigateToChat,
  currentUser,
  onSelectContact,
  onOpenProfile,
}: SidebarProps) {
  const [view, setView] = useState<SidebarView>('chats');
  const [query, setQuery] = useState('');
  const [peopleQuery, setPeopleQuery] = useState('');
  const [peopleResults, setPeopleResults] = useState<UserSearchResult[] | null>(null);
  const [peopleSearching, setPeopleSearching] = useState(false);
  const [peopleError, setPeopleError] = useState(false);

  const filtered = query.trim()
    ? conversations.filter((c) =>
        c.name.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : conversations;

  // Contact search runs only while the new-chat view is open. State resets
  // happen in event handlers (open/back/typing); this effect only fetches.
  useEffect(() => {
    if (view !== 'new-chat') return;
    let active = true;
    searchUsers(peopleQuery.trim())
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
  }, [peopleQuery, view]);

  // Escape returns to the chats view without changing the active chat.
  useEffect(() => {
    if (view !== 'new-chat') return;
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

  function handlePick(username: string) {
    onSelectContact(username);
    backToChats();
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
            ) : peopleResults && peopleResults.length === 0 ? (
              <p className={styles.peopleState}>No people found.</p>
            ) : (
              <ul className={styles.peopleListUl}>
                {(peopleResults ?? []).map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      className={styles.peopleRow}
                      onClick={() => handlePick(u.username)}
                    >
                      <Avatar
                        initials={u.username.slice(0, 2)}
                        color="slate"
                        size="sm"
                        name={u.username}
                      />
                      <span className={styles.peopleName}>{u.username}</span>
                    </button>
                  </li>
                ))}
              </ul>
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
