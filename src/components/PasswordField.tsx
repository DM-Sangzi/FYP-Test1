import { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import styles from './PasswordField.module.css';

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  /** Show a hint below the input, e.g. "At least 8 characters". */
  hint?: string;
  /** Render as an error (red border + hint colour). */
  error?: boolean;
  id?: string;
  disabled?: boolean;
}

/**
 * Password input with an accessible show/hide toggle (PRD US-08).
 *
 * The toggle is a labelled `<button type="button">` that flips the input
 * type between `password` and `text`, with a matching `aria-label` and
 * `aria-pressed` state for screen readers.
 */
export function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  hint,
  error,
  id,
  disabled,
}: PasswordFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);

  return (
    <div className={styles.field}>
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      <div className={`${styles.wrapper} ${error ? styles.error : ''}`}>
        <input
          id={inputId}
          type={visible ? 'text' : 'password'}
          className={styles.input}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          disabled={disabled}
          aria-invalid={error || undefined}
          aria-describedby={hint ? `${inputId}-hint` : undefined}
        />
        <button
          type="button"
          className={styles.toggle}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          tabIndex={0}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {hint && (
        <p
          id={`${inputId}-hint`}
          className={`${styles.hint} ${error ? styles.hintError : ''}`}
        >
          {hint}
        </p>
      )}
    </div>
  );
}
