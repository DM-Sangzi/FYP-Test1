import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  MessageSquare,
  GraduationCap,
  UserPlus,
  Users,
  Send,
  Lock,
} from 'lucide-react';
import styles from './Home.module.css';

/**
 * Landing page (PRD §5.2).
 *
 * Three sections: Hero (name + tagline + CTAs + static chat mockup),
 * "Why use our platform" (3 feature cards), and "How it works" (3 steps).
 */
export function Home() {
  return (
    <div className={styles.page}>
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            <Lock size={18} />
          </span>
          <span className={styles.brandName}>PQPM</span>
        </div>
        <nav className={styles.topActions} aria-label="Primary">
          <Link to="/login" className={styles.ghostBtn}>
            Log in
          </Link>
          <Link to="/register" className={styles.primaryBtn}>
            Get Started
          </Link>
        </nav>
      </header>

      <main id="main" className={styles.main}>
        {/* ---------------- Hero ---------------- */}
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Post-Quantum Privacy Messenger</p>
            <h1 className={styles.title}>
              Private conversations,
              <br />
              built for the <span className={styles.accent}>post-quantum</span> era.
            </h1>
            <p className={styles.subtitle}>
              A familiar, modern chat experience inspired by Telegram and WhatsApp
              Web — designed so your conversations stay private by default, without
              the clutter.
            </p>
            <div className={styles.heroActions}>
              <Link to="/register" className={styles.primaryBtnLg}>
                Get Started
              </Link>
              <Link to="/login" className={styles.ghostBtnLg}>
                I already have an account
              </Link>
            </div>
          </div>

          {/* Static mockup of the chat UI (PRD §5.2 Hero) */}
          <div className={styles.mockup} aria-hidden="true">
            <div className={styles.mockHeader}>
              <span className={styles.mockAvatar} />
              <div className={styles.mockHeaderTxt}>
                <div className={styles.mockName}>Alice Tan</div>
                <div className={styles.mockStatus}>Online</div>
              </div>
            </div>
            <div className={styles.mockThread}>
              <div className={`${styles.mockBubble} ${styles.mockLeft}`}>
                Hey! Are you ready for the presentation?
              </div>
              <div className={`${styles.mockBubble} ${styles.mockRight}`}>
                Almost. Just finishing the slides.
              </div>
              <div className={`${styles.mockBubble} ${styles.mockLeft}`}>
                Did the key exchange work?
              </div>
            </div>
            <div className={styles.mockInput}>
              <span className={styles.mockPlaceholder}>Type a message</span>
              <span className={styles.mockSend}>
                <Send size={16} />
              </span>
            </div>
          </div>
        </section>

        {/* ---------------- Why use our platform ---------------- */}
        <section className={styles.section} aria-labelledby="why-heading">
          <h2 id="why-heading" className={styles.sectionTitle}>
            Why use our platform?
          </h2>
          <p className={styles.sectionLead}>
            The key benefits, at a glance.
          </p>
          <ul className={styles.cards}>
            <li className={styles.card}>
              <span className={styles.cardIcon}>
                <ShieldCheck size={24} />
              </span>
              <h3 className={styles.cardTitle}>Private by default</h3>
              <p className={styles.cardText}>
                Built around post-quantum cryptography on the backend, so your
                messages are protected without you needing to think about it.
              </p>
            </li>
            <li className={styles.card}>
              <span className={styles.cardIcon}>
                <MessageSquare size={24} />
              </span>
              <h3 className={styles.cardTitle}>Modern and familiar</h3>
              <p className={styles.cardText}>
                A clean, neutral interface modelled on the messengers you already
                use. If you know Telegram or WhatsApp, you know PQPM.
              </p>
            </li>
            <li className={styles.card}>
              <span className={styles.cardIcon}>
                <GraduationCap size={24} />
              </span>
              <h3 className={styles.cardTitle}>Academic-grade project</h3>
              <p className={styles.cardText}>
                A final-year engineering effort with a clear architecture, real
                crypto underneath, and clean code ready for the team to extend.
              </p>
            </li>
          </ul>
        </section>

        {/* ---------------- How it works ---------------- */}
        <section className={styles.section} aria-labelledby="how-heading">
          <h2 id="how-heading" className={styles.sectionTitle}>
            How it works
          </h2>
          <p className={styles.sectionLead}>Three steps to your first private chat.</p>
          <ol className={styles.steps}>
            <li className={styles.step}>
              <span className={styles.stepNum}>1</span>
              <span className={styles.stepIcon}>
                <UserPlus size={22} />
              </span>
              <h3 className={styles.stepTitle}>Create your account</h3>
              <p className={styles.stepText}>
                Register in seconds with a username and password. Your account
                stays available across refreshes.
              </p>
            </li>
            <li className={styles.step}>
              <span className={styles.stepNum}>2</span>
              <span className={styles.stepIcon}>
                <Users size={22} />
              </span>
              <h3 className={styles.stepTitle}>Add your contacts</h3>
              <p className={styles.stepText}>
                Browse conversations and search your contacts from the sidebar.
              </p>
            </li>
            <li className={styles.step}>
              <span className={styles.stepNum}>3</span>
              <span className={styles.stepIcon}>
                <Send size={22} />
              </span>
              <h3 className={styles.stepTitle}>Start a private chat</h3>
              <p className={styles.stepText}>
                Pick a conversation and send a message. Your bubbles appear on the
                right, just like the apps you know.
              </p>
            </li>
          </ol>
        </section>
      </main>

      <footer className={styles.footer}>
        <p>
          PQPM · Final Year Project{' '}
          <Link to="/register" className={styles.footerLink}>
            Get Started
          </Link>
        </p>
      </footer>
    </div>
  );
}
