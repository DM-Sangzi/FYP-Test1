import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Search, Settings, User as UserIcon } from 'lucide-react';
import type { Conversation } from '../../types';
import { Avatar } from '../Avatar';
import styles from './Sidebar.module.css';

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  loading?: boolean;
  /** Called on mobile when a conversation is chosen (to switch panes). */
  onNavigateToChat?: () => void;
}

/**
 * Chat sidebar (PRD §5.4 Sidebar).
 * App header, search input, and the conversation list.
 */
export function Sidebar({
  conversations,
  activeId,
  onSelect,
  loading,
  onNavigateToChat,
}: SidebarProps) {
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? conversations.filter((c) =>
        c.name.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : conversations;

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
        <div className={styles.headerActions}>
          <Link
            to="/profile"
            className={styles.iconBtn}
            aria-label="Profile"
            title="Profile"
          >
            <UserIcon size={18} />
          </Link>
          <Link
            to="/profile"
            className={styles.iconBtn}
            aria-label="Settings"
            title="Settings"
          >
            <Settings size={18} />
          </Link>
        </div>
      </header>

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

      <nav className={styles.list} aria-label="Conversation list">
        {loading ? (
          <div className={styles.state}>Loading conversations…</div>
        ) : filtered.length === 0 ? (
          <div className={styles.state}>No conversations found.</div>
        ) : (
          <ul>
            {filtered.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={`${styles.item} ${c.id === activeId ? styles.active : ''}`}
                  onClick={() => handleSelect(c.id)}
                  aria-current={c.id === activeId ? 'true' : undefined}
                >
                  <Avatar
                    initials={c.initials}
                    color={c.color}
                    name={c.name}
                    online={c.status === 'online'}
                  />
                  <div className={styles.itemBody}>
                    <div className={styles.itemTop}>
                      <span className={styles.itemName}>{c.name}</span>
                      <span className={styles.itemTime}>{formatListTime(c.lastMessageAt)}</span>
                    </div>
                    <div className={styles.itemBottom}>
                      <span className={styles.itemPreview}>{c.lastMessage}</span>
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
