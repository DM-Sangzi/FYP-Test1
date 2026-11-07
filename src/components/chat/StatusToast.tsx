import { useEffect } from 'react';
import { X } from 'lucide-react';
import styles from './StatusToast.module.css';

export interface ToastModel {
  kind: 'success' | 'error';
  text: string;
}

interface StatusToastProps {
  toast: ToastModel | null;
  onDismiss: () => void;
}

/**
 * Non-blocking operation status, announced to assistive technology:
 * success uses role="status" (polite), errors use role="alert" (assertive).
 * Colour is never the only signal — the text carries the meaning and a
 * dismiss button is provided. Auto-dismisses after 5 seconds.
 */
export function StatusToast({ toast, onDismiss }: StatusToastProps) {
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(onDismiss, 5000);
    return () => window.clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <div className={styles.toast} data-kind={toast.kind} role={toast.kind === 'error' ? 'alert' : 'status'}>
      <p className={styles.text}>{toast.text}</p>
      <button
        type="button"
        className={styles.close}
        onClick={onDismiss}
        aria-label="Dismiss notification"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
