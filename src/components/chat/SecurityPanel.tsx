import { useEffect, useRef } from 'react';
import { Fingerprint, LockOpen, ShieldQuestion, X } from 'lucide-react';
import styles from './SecurityPanel.module.css';

/** E2EE session lifecycle states (only 'not-established' can occur today). */
export type SessionState = 'not-established' | 'establishing' | 'active' | 'failed';
/** Contact identity verification states (only 'not-verified' can occur today). */
export type IdentityState = 'not-verified' | 'verified' | 'key-changed';

const SESSION_LABELS: Record<SessionState, string> = {
  'not-established': 'Not established',
  establishing: 'Establishing',
  active: 'Active',
  failed: 'Failed',
};

const IDENTITY_LABELS: Record<IdentityState, string> = {
  'not-verified': 'Not verified',
  verified: 'Verified',
  'key-changed': 'Key changed',
};

interface SecurityPanelProps {
  open: boolean;
  onClose: () => void;
  /** Real session state from the application. Not inferred from login. */
  sessionState: SessionState;
  /** Real verification state from the application. */
  identityState: IdentityState;
  contactName?: string;
}

/**
 * Conversation security panel (redesign §5).
 *
 * Every value shown is bound to real application state. Today the app has
 * no E2EE integration, so the panel honestly shows "not established" /
 * "not verified" and dashes for material that does not exist. It never
 * infers encryption or verification from login status, and never displays
 * private keys, shared secrets, or derived keys.
 */
export function SecurityPanel({
  open,
  onClose,
  sessionState,
  identityState,
  contactName,
}: SecurityPanelProps) {
  const panelRef = useRef<HTMLElement>(null);

  // Focus the panel on open; restore focus to the opener on close.
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => previous?.focus?.();
  }, [open]);

  // Close on Escape while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <aside
      ref={panelRef}
      className={styles.panel}
      aria-label="Conversation security"
      tabIndex={-1}
    >
      <header className={styles.header}>
        <h2 className={styles.title}>Conversation security</h2>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Close conversation security panel"
        >
          <X size={18} />
        </button>
      </header>

      {contactName && <p className={styles.context}>With {contactName}</p>}

      {/* Session status */}
      <section className={styles.section} aria-labelledby="sec-session">
        <h3 id="sec-session" className={styles.sectionTitle}>
          Session
        </h3>
        <p className={styles.statusRow}>
          <span className={`${styles.statusChip} ${styles.statusIdle}`}>
            <LockOpen size={14} aria-hidden="true" />
            {SESSION_LABELS[sessionState]}
          </span>
        </p>
        <p className={styles.note}>
          End-to-end encryption is not implemented yet. Messages in this demo
          are stored in this browser only and are not encrypted.
        </p>
      </section>

      {/* Identity verification */}
      <section className={styles.section} aria-labelledby="sec-identity">
        <h3 id="sec-identity" className={styles.sectionTitle}>
          Contact verification
        </h3>
        <p className={styles.statusRow}>
          <span className={`${styles.statusChip} ${styles.statusIdle}`}>
            <ShieldQuestion size={14} aria-hidden="true" />
            {IDENTITY_LABELS[identityState]}
          </span>
        </p>
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>Public-key fingerprint</span>
          <span className={styles.fieldValue}>
            — (available once encrypted sessions are implemented)
          </span>
        </div>
        <button type="button" className={styles.verifyBtn} disabled>
          Verify contact
        </button>
        <p className={styles.note}>
          Verification becomes available after encrypted sessions are
          implemented. Until then, identity cannot be confirmed here.
        </p>
      </section>

      {/* Negotiated algorithms */}
      <section className={styles.section} aria-labelledby="sec-algos">
        <h3 id="sec-algos" className={styles.sectionTitle}>
          Negotiated algorithms
        </h3>
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>
            <Fingerprint size={14} aria-hidden="true" /> Key exchange
          </span>
          <span className={styles.fieldValue}>— (not negotiated)</span>
        </div>
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>Signature</span>
          <span className={styles.fieldValue}>— (not negotiated)</span>
        </div>
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>Message cipher</span>
          <span className={styles.fieldValue}>— (not negotiated)</span>
        </div>
      </section>
    </aside>
  );
}
