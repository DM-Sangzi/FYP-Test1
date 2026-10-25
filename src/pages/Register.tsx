import { useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PasswordField } from '../components/PasswordField';
import styles from './Auth.module.css';

/**
 * Register page (PRD §5.1, US-05/08/09).
 *
 * Client-side validation mirrors the MSW handler rules. On success the new
 * account is persisted via the mock layer and the user is sent to /login.
 */
export function Register() {
  const { register, loading } = useAuth();
  const navigate = useNavigate();
  const id = useId();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (username.trim().length < 3)
      next.username = 'Username must be at least 3 characters.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      next.email = 'Enter a valid email address.';
    if (password.length < 8) next.password = 'Password must be at least 8 characters.';
    if (confirm !== password) next.confirm = 'Passwords do not match.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setApiError(null);
    if (!validate()) return;

    const result = await register(username.trim(), email.trim(), password);
    if (result.success) {
      navigate('/login', { state: { registered: true } });
    } else {
      // PRD US-09: username-taken etc. surfaced as a clear error.
      setApiError(result.error ?? 'Registration failed.');
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <Link to="/" className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            <Lock size={18} />
          </span>
          <span className={styles.brandName}>PQPM</span>
        </Link>

        <h1 className={styles.title}>Create your account</h1>
        <p className={styles.subtitle}>Join PQPM to start private conversations.</p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label htmlFor={`${id}-username`} className={styles.label}>
              Username
            </label>
            <input
              id={`${id}-username`}
              type="text"
              className={styles.input}
              value={username}
              autoComplete="username"
              onChange={(e) => {
                setUsername(e.target.value);
                setErrors((p) => ({ ...p, username: '' }));
              }}
              placeholder="Choose a username"
              aria-invalid={!!errors.username || undefined}
            />
            {errors.username && (
              <p className={styles.errorText} role="alert">
                {errors.username}
              </p>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor={`${id}-email`} className={styles.label}>
              Email
            </label>
            <input
              id={`${id}-email`}
              type="email"
              className={styles.input}
              value={email}
              autoComplete="email"
              onChange={(e) => {
                setEmail(e.target.value);
                setErrors((p) => ({ ...p, email: '' }));
              }}
              placeholder="you@example.com"
              aria-invalid={!!errors.email || undefined}
            />
            {errors.email && (
              <p className={styles.errorText} role="alert">
                {errors.email}
              </p>
            )}
          </div>

          <PasswordField
            id={`${id}-password`}
            label="Password"
            value={password}
            autoComplete="new-password"
            hint="At least 8 characters."
            error={!!errors.password}
            onChange={(v) => {
              setPassword(v);
              setErrors((p) => ({ ...p, password: '' }));
            }}
          />
          {errors.password && (
            <p className={styles.errorText} role="alert">
              {errors.password}
            </p>
          )}

          <PasswordField
            id={`${id}-confirm`}
            label="Confirm password"
            value={confirm}
            autoComplete="new-password"
            error={!!errors.confirm}
            onChange={(v) => {
              setConfirm(v);
              setErrors((p) => ({ ...p, confirm: '' }));
            }}
          />
          {errors.confirm && (
            <p className={styles.errorText} role="alert">
              {errors.confirm}
            </p>
          )}

          {apiError && (
            <p className={styles.errorText} role="alert">
              {apiError}
            </p>
          )}

          <button type="submit" className={styles.submit} disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        <p className={styles.switch}>
          Already have an account?{' '}
          <Link to="/login" className={styles.switchLink}>
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
