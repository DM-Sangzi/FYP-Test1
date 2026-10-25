import { useId, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Lock, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PasswordField } from '../components/PasswordField';
import styles from './Auth.module.css';

interface LocationState {
  from?: string;
  registered?: boolean;
}

/**
 * Login page (PRD §5.1, US-06/07/08/10).
 *
 * Submits credentials via AuthContext.login, which routes through MSW in mock
 * mode. On success the user is sent to their intended destination (or /chat).
 */
export function Login() {
  const { login, loading, error, clearError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const id = useId();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showFormError, setShowFormError] = useState(false);

  const redirectTo = (location.state as LocationState | null)?.from ?? '/chat';
  const justRegistered = (location.state as LocationState | null)?.registered === true;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier || !password) {
      setShowFormError(true);
      return;
    }
    const ok = await login(identifier, password);
    if (ok) navigate(redirectTo, { replace: true });
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

        <h1 className={styles.title}>Welcome back</h1>
        <p className={styles.subtitle}>Log in to continue to your chats.</p>

        {justRegistered && (
          <div className={styles.successBanner} role="status">
            <CheckCircle2 size={18} />
            <span>Account created. You can now log in.</span>
          </div>
        )}

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label htmlFor={`${id}-id`} className={styles.label}>
              Username or email
            </label>
            <input
              id={`${id}-id`}
              type="text"
              className={styles.input}
              value={identifier}
              autoComplete="username"
              onChange={(e) => {
                setIdentifier(e.target.value);
                setShowFormError(false);
                clearError();
              }}
              placeholder="e.g. demo"
            />
          </div>

          <PasswordField
            id={`${id}-pw`}
            label="Password"
            value={password}
            autoComplete="current-password"
            onChange={(v) => {
              setPassword(v);
              setShowFormError(false);
              clearError();
            }}
          />

          {showFormError && !identifier && !password && (
            <p className={styles.errorText} role="alert">
              Please enter your username and password.
            </p>
          )}
          {/* PRD US-07: clear error for wrong credentials */}
          {error && (
            <p className={styles.errorText} role="alert">
              {error}
            </p>
          )}

          <button type="submit" className={styles.submit} disabled={loading}>
            {loading ? 'Logging in…' : 'Log in'}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        <p className={styles.switch}>
          Don&apos;t have an account?{' '}
          <Link to="/register" className={styles.switchLink}>
            Register
          </Link>
        </p>

        <div className={styles.demoHint} aria-label="Demo credentials">
          <strong>Demo account:</strong> username <code>demo</code> · password{' '}
          <code>password123</code>
        </div>
      </div>
    </div>
  );
}
