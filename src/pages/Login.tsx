import { useId, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Lock, ArrowLeft, ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';
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
 * Two steps: credentials, then — only for accounts with 2FA enabled — a
 * second factor (TOTP or a recovery code). The second step is driven by the
 * in-memory challenge in AuthContext: refreshing the page drops it and login
 * restarts, so the second factor cannot be bypassed. "Back" revokes the
 * challenge on the mock backend, not just in React state.
 */
export function Login() {
  const {
    login,
    verifyTwoFactor,
    cancelChallenge,
    pendingChallenge,
    loading,
    error,
    clearError,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const id = useId();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showFormError, setShowFormError] = useState(false);

  // Second-step local state: TOTP code (or recovery code) entry.
  const [code, setCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);

  const redirectTo = (location.state as LocationState | null)?.from ?? '/chat';
  const justRegistered = (location.state as LocationState | null)?.registered === true;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier || !password) {
      setShowFormError(true);
      return;
    }
    const outcome = await login(identifier, password);
    if (outcome === 'authenticated') navigate(redirectTo, { replace: true });
    // 'challenge' renders the second step below; 'failed' shows error.
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    const ok = await verifyTwoFactor(useRecovery ? { recoveryCode: code } : { code });
    if (ok) navigate(redirectTo, { replace: true });
  }

  async function handleBackToCredentials() {
    setCode('');
    setUseRecovery(false);
    await cancelChallenge();
  }

  /** Demo convenience: fills the public demo credentials only — the user
   * still submits the form themselves. Not an authentication bypass. */
  function useDemoAccount() {
    setIdentifier('demo');
    setPassword('password123');
    setShowFormError(false);
    clearError();
  }

  if (pendingChallenge) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <Link to="/" className={styles.backLink}>
            <ArrowLeft size={16} aria-hidden="true" />
            <span>Back to home</span>
          </Link>
          <Link to="/" className={styles.brand}>
            <span className={styles.brandMark} aria-hidden="true">
              <Lock size={18} />
            </span>
            <span className={styles.brandName}>PQPM</span>
          </Link>

          <h1 className={styles.title}>Two-factor authentication</h1>
          <p className={styles.subtitle}>
            Enter the 6-digit code from your authenticator app for{' '}
            <strong>{pendingChallenge.username}</strong>.
          </p>

          <form className={styles.form} onSubmit={handleVerify} noValidate>
            <div className={styles.field}>
              <label htmlFor={`${id}-code`} className={styles.label}>
                {useRecovery ? 'Recovery code' : 'Authentication code'}
              </label>
              <input
                id={`${id}-code`}
                type="text"
                className={`${styles.input} ${styles.codeInput}`}
                value={code}
                inputMode={useRecovery ? 'text' : 'numeric'}
                autoComplete={useRecovery ? 'off' : 'one-time-code'}
                autoCapitalize={useRecovery ? 'characters' : 'off'}
                onChange={(e) => {
                  setCode(e.target.value);
                  clearError();
                }}
                placeholder={useRecovery ? 'xxxxx-xxxxx-xxxxx-xxxxx-xxxxx' : '123456'}
                // Text field with string state — leading zeros are preserved.
                autoFocus
              />
            </div>

            {error && (
              <p className={styles.errorText} role="alert">
                {error}
              </p>
            )}

            <button type="submit" className={styles.submit} disabled={loading || code.trim() === ''}>
              {loading ? 'Verifying…' : 'Verify'}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          <div className={styles.twoFactorActions}>
            <button
              type="button"
              className={styles.linkBtn}
              onClick={() => {
                setUseRecovery((v) => !v);
                setCode('');
                clearError();
              }}
            >
              {useRecovery ? 'Use an authenticator code instead' : 'Use a recovery code instead'}
            </button>
            <button
              type="button"
              className={styles.linkBtn}
              onClick={handleBackToCredentials}
              disabled={loading}
            >
              <ArrowLeft size={14} aria-hidden="true" />
              <span>Back to login</span>
            </button>
          </div>

          <p className={styles.challengeNote}>
            The challenge expires after a few minutes; refreshing this page
            restarts the login.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <Link to="/" className={styles.backLink}>
          <ArrowLeft size={16} aria-hidden="true" />
          <span>Back to home</span>
        </Link>
        <Link to="/" className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            <Lock size={18} />
          </span>
          <span className={styles.brandName}>PQPM</span>
        </Link>

        <h1 className={styles.title}>Welcome back</h1>
        <p className={styles.subtitle}>Log in to continue to your chats.</p>
        <p className={styles.prototypeNote}>
          Prototype — demo messages stay in this browser; end-to-end
          encryption is not active.
        </p>

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
          <button type="button" className={styles.demoFillBtn} onClick={useDemoAccount}>
            Use demo account
          </button>
          {identifier === 'demo' && (
            <p className={styles.demoHintNote}>
              <ShieldCheck size={12} aria-hidden="true" /> If 2FA is enabled for
              demo, a second step asks for your authenticator code.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
