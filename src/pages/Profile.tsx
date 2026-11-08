import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  LogOut,
  Mail,
  Monitor,
  Moon,
  Sun,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import type { Theme } from '../context/ThemeContext';
import { AvatarEditor } from '../components/settings/AvatarEditor';
import { TwoFactorSection } from '../components/settings/TwoFactorSection';
import styles from './Profile.module.css';

const THEME_OPTIONS: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

/**
 * Profile / Settings page (PRD §5.5, US-17/18/19; redesigned).
 *
 * Sections: Profile, Appearance, Privacy & security. Security text is
 * factual — it states what the app actually does today (no E2EE session,
 * demo messages stay in this browser) instead of broad assurances.
 */
export function Profile() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  if (!user) return null;

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <button
          type="button"
          className={styles.backBtn}
          onClick={() => navigate('/chat')}
          aria-label="Back to chats"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className={styles.pageTitle}>Profile &amp; Settings</h1>
      </header>

      <main className={styles.main}>
        {/* Single settings card: Profile, Appearance, Privacy & security */}
        <section className={styles.card} aria-label="Settings">
          {/* Profile */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Profile</h2>
            <AvatarEditor />
            <dl className={styles.details}>
              <div className={styles.detailRow}>
                <dt>
                  <Mail size={16} aria-hidden="true" /> Email
                </dt>
                <dd>{user.email}</dd>
              </div>
            </dl>
          </div>

          {/* Appearance */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Appearance</h2>
            <p className={styles.cardLead}>
              Choose how PQPM looks. Your preference is remembered on this device.
            </p>
            <div className={styles.themeRow} role="group" aria-label="Theme">
              {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  className={`${styles.themeBtn} ${theme === value ? styles.themeBtnActive : ''}`}
                  onClick={() => setTheme(value)}
                  aria-pressed={theme === value}
                >
                  <Icon size={16} aria-hidden="true" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
            {theme === 'system' && (
              <p className={styles.themeNote}>
                System follows your operating system's light or dark preference.
              </p>
            )}
          </div>

          {/* Two-factor authentication (per-account, TOTP) */}
          <TwoFactorSection />

          {/* Privacy & security — factual status only */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Privacy &amp; security</h2>
            <dl className={styles.securityList}>
              <div className={styles.securityRow}>
                <dt>E2EE session</dt>
                <dd>Not established</dd>
              </div>
              <div className={styles.securityRow}>
                <dt>Message encryption</dt>
                <dd>
                  Not encrypted — demo messages are kept in this browser only
                </dd>
              </div>
              <div className={styles.securityRow}>
                <dt>Identity key</dt>
                <dd>No identity key on this device</dd>
              </div>
              <div className={styles.securityRow}>
                <dt>Session token</dt>
                <dd>Held in memory only; cleared when you log out</dd>
              </div>
            </dl>
          </div>
        </section>

        {/* Session — kept visually separate from ordinary settings */}
        <section className={styles.card} aria-labelledby="session-heading">
          <h2 id="session-heading" className={styles.sectionTitle}>
            Session
          </h2>
          <button
            type="button"
            className={styles.logoutBtn}
            onClick={handleLogout}
          >
            <LogOut size={18} aria-hidden="true" />
            <span>Log out</span>
          </button>
        </section>
      </main>
    </div>
  );
}
