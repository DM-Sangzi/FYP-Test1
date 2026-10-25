import { useNavigate } from 'react-router-dom';
import { LogOut, Moon, Sun, Mail, AtSign, ShieldCheck, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Avatar } from '../components/Avatar';
import styles from './Profile.module.css';

/**
 * Profile / Settings page (PRD §5.5, US-17/18/19).
 *
 * Shows user info from AuthContext, a persisted theme toggle, and a logout
 * button that clears the in-memory session and returns to /login.
 */
export function Profile() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  if (!user) return null;
  const initials = user.username.slice(0, 2);

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <button
          type="button"
          className={styles.backBtn}
          onClick={() => navigate('/chat')}
          aria-label="Back to chat"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className={styles.pageTitle}>Profile &amp; Settings</h1>
      </header>

      <main className={styles.main}>
        {/* Identity card */}
        <section className={styles.card} aria-labelledby="identity-heading">
          <h2 id="identity-heading" className={styles.srOnly}>
            Your profile
          </h2>
          <div className={styles.identity}>
            <Avatar initials={initials} color="teal" size="xl" name={user.username} />
            <div className={styles.identityInfo}>
              <p className={styles.displayName}>{user.username}</p>
              <p className={styles.memberSince}>PQPM member</p>
            </div>
          </div>

          <dl className={styles.details}>
            <div className={styles.detailRow}>
              <dt>
                <AtSign size={16} aria-hidden="true" /> Username
              </dt>
              <dd>{user.username}</dd>
            </div>
            <div className={styles.detailRow}>
              <dt>
                <Mail size={16} aria-hidden="true" /> Email
              </dt>
              <dd>{user.email}</dd>
            </div>
          </dl>
        </section>

        {/* Appearance / theme */}
        <section className={styles.card} aria-labelledby="appearance-heading">
          <h2 id="appearance-heading" className={styles.cardTitle}>
            Appearance
          </h2>
          <p className={styles.cardLead}>
            Choose how PQPM looks. Your preference is remembered on this device.
          </p>
          <div className={styles.themeRow} role="group" aria-label="Theme">
            <button
              type="button"
              className={`${styles.themeBtn} ${theme === 'light' ? styles.themeBtnActive : ''}`}
              onClick={() => theme !== 'light' && toggleTheme()}
              aria-pressed={theme === 'light'}
            >
              <Sun size={18} />
              <span>Light</span>
            </button>
            <button
              type="button"
              className={`${styles.themeBtn} ${theme === 'dark' ? styles.themeBtnActive : ''}`}
              onClick={() => theme !== 'dark' && toggleTheme()}
              aria-pressed={theme === 'dark'}
            >
              <Moon size={18} />
              <span>Dark</span>
            </button>
          </div>
        </section>

        {/* Security note */}
        <section className={styles.card} aria-labelledby="security-heading">
          <h2 id="security-heading" className={styles.cardTitle}>
            Security
          </h2>
          <div className={styles.securityNote}>
            <span className={styles.securityIcon} aria-hidden="true">
              <ShieldCheck size={20} />
            </span>
            <div>
              <p className={styles.securityTitle}>Your session is secured</p>
              <p className={styles.securityText}>
                PQPM uses post-quantum cryptography on the backend. Your session
                token is held in memory only and is cleared when you log out.
              </p>
            </div>
          </div>
        </section>

        {/* Logout */}
        <section className={styles.card} aria-labelledby="session-heading">
          <h2 id="session-heading" className={styles.cardTitle}>
            Session
          </h2>
          <button
            type="button"
            className={styles.logoutBtn}
            onClick={handleLogout}
          >
            <LogOut size={18} />
            <span>Log out</span>
          </button>
        </section>
      </main>
    </div>
  );
}
