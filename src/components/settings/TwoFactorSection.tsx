import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { ShieldCheck, ShieldOff } from 'lucide-react';
import {
  cancelTwoFactorEnrollment,
  disableTwoFactor,
  getTwoFactorStatus,
  regenerateRecoveryCodes,
  startTwoFactorEnrollment,
  verifyTwoFactorEnrollment,
} from '../../api/client';
import { ApiError } from '../../api/client';
import type { TwoFactorEnrollmentStart, TwoFactorStatus } from '../../types';
import { PasswordField } from '../PasswordField';
import styles from './TwoFactorSection.module.css';

type View =
  | 'summary'
  | 'enroll-password'
  | 'enroll-scan'
  | 'enroll-code'
  | 'codes'
  | 'disable'
  | 'regenerate';

function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
}

/**
 * Per-account Two-factor authentication section for Settings (TOTP).
 *
 * State machine: summary → (password) → scan QR/setup key → verify code →
 * one-time recovery codes. Disable and regenerate re-verify password plus a
 * current factor; disable also accepts an unused recovery code (lost-phone
 * path). Nothing is marked enabled until the API confirms, and persistence
 * failures surface as errors instead of fake success. Recovery codes are
 * displayed exactly once.
 */
export function TwoFactorSection() {
  const [view, setView] = useState<View>('summary');
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [enrollment, setEnrollment] = useState<TwoFactorEnrollmentStart | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [useRecoveryForDisable, setUseRecoveryForDisable] = useState(false);

  // QR is generated locally from the provisioning URI — the secret never
  // leaves the browser for any third-party service.
  useEffect(() => {
    if (!enrollment) return;
    let active = true;
    QRCode.toDataURL(enrollment.otpauthUri, { margin: 1, width: 180 })
      .then((d) => {
        if (active) setQrDataUrl(d);
      })
      .catch(() => {
        if (active) setQrDataUrl(null);
      });
    return () => {
      active = false;
    };
  }, [enrollment]);

  useEffect(() => {
    let active = true;
    getTwoFactorStatus()
      .then((s) => {
        if (!active) return;
        setStatus(s);
        setStatusError(null);
      })
      .catch((err) => {
        if (!active) return;
        setStatusError(errorMessage(err));
      });
    return () => {
      active = false;
    };
  }, [reloadTick]);

  function resetFlow() {
    setPassword('');
    setCode('');
    setEnrollment(null);
    setQrDataUrl(null);
    setRecoveryCodes(null);
    setUseRecoveryForDisable(false);
    setActionError(null);
  }

  function backToSummary() {
    resetFlow();
    setView('summary');
    setReloadTick((t) => t + 1);
  }

  async function handleStartEnrollment() {
    setBusy(true);
    setActionError(null);
    try {
      const started = await startTwoFactorEnrollment(password);
      setEnrollment(started);
      setView('enroll-scan');
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleCancelEnrollment() {
    setBusy(true);
    try {
      await cancelTwoFactorEnrollment();
    } catch {
      // Nothing is enabled by a cancelled setup; surface nothing beyond the reset.
    } finally {
      setBusy(false);
      backToSummary();
    }
  }

  async function handleVerifyEnrollment() {
    setBusy(true);
    setActionError(null);
    try {
      const res = await verifyTwoFactorEnrollment(code);
      setRecoveryCodes(res.recoveryCodes);
      setView('codes');
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    setBusy(true);
    setActionError(null);
    try {
      await disableTwoFactor(
        useRecoveryForDisable
          ? { password, recoveryCode: code }
          : { password, code },
      );
      backToSummary();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleRegenerate() {
    setBusy(true);
    setActionError(null);
    try {
      const res = await regenerateRecoveryCodes({ password, code });
      setRecoveryCodes(res.recoveryCodes);
      setView('codes');
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const enabled = status?.enabled === true;

  return (
    <div className={styles.section} aria-labelledby="twofactor-heading">
      <h3 id="twofactor-heading" className={styles.sectionTitle}>
        Two-factor authentication
      </h3>
      {statusError ? (
        <p className={styles.errorText} role="alert">
          {statusError}
        </p>
      ) : status === null ? (
        <p className={styles.mutedLine}>Loading…</p>
      ) : view === 'summary' ? (
        <>
          <p className={styles.statusLine}>
            {enabled ? (
              <>
                <ShieldCheck size={16} aria-hidden="true" className={styles.enabledIcon} />
                <span>Enabled</span>
                <span className={styles.mutedLine}>
                  {status.recoveryCodesRemaining}{' '}
                  {status.recoveryCodesRemaining === 1 ? 'recovery code' : 'recovery codes'} remaining
                </span>
              </>
            ) : (
              <>
                <ShieldOff size={16} aria-hidden="true" className={styles.mutedIcon} />
                <span>Disabled</span>
              </>
            )}
          </p>
          <p className={styles.mutedLine}>
            {enabled
              ? 'Signing in requires a code from your authenticator app.'
              : 'Add a second step at sign-in using any authenticator app (TOTP).'}
          </p>
          <div className={styles.actions}>
            {enabled ? (
              <>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => {
                    resetFlow();
                    setView('disable');
                  }}
                >
                  Disable 2FA
                </button>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => {
                    resetFlow();
                    setView('regenerate');
                  }}
                >
                  Regenerate recovery codes
                </button>
              </>
            ) : (
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => {
                  resetFlow();
                  setView('enroll-password');
                }}
              >
                Enable 2FA
              </button>
            )}
          </div>
        </>
      ) : view === 'enroll-password' ? (
        <>
          <p className={styles.stepText}>Confirm your password to start setup.</p>
          <PasswordField
            id="twofactor-enroll-password"
            label="Password"
            value={password}
            autoComplete="current-password"
            onChange={setPassword}
          />
          {actionError && (
            <p className={styles.errorText} role="alert">
              {actionError}
            </p>
          )}
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={busy || password === ''}
              onClick={handleStartEnrollment}
            >
              {busy ? 'Starting…' : 'Continue'}
            </button>
            <button type="button" className={styles.secondaryBtn} disabled={busy} onClick={handleCancelEnrollment}>
              Cancel
            </button>
          </div>
        </>
      ) : view === 'enroll-scan' && enrollment ? (
        <>
          <ol className={styles.stepList}>
            <li>Scan the QR code with your authenticator app…</li>
            <li>
              …or enter the setup key manually:
              <code className={styles.secretKey} title="Setup key">
                {enrollment.secret}
              </code>
            </li>
          </ol>
          <div className={styles.qrTile}>
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR code with the two-factor setup key" width={180} height={180} />
            ) : (
              <p className={styles.mutedLine}>Generating QR code…</p>
            )}
          </div>
          {actionError && (
            <p className={styles.errorText} role="alert">
              {actionError}
            </p>
          )}
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => {
                setCode('');
                setActionError(null);
                setView('enroll-code');
              }}
            >
              Next
            </button>
            <button type="button" className={styles.secondaryBtn} disabled={busy} onClick={handleCancelEnrollment}>
              Cancel setup
            </button>
          </div>
        </>
      ) : view === 'enroll-code' && enrollment ? (
        <>
          <label htmlFor="twofactor-code" className={styles.stepText}>
            Enter the current 6-digit code from the app to finish setup.
          </label>
          <input
            id="twofactor-code"
            type="text"
            className={styles.codeInput}
            value={code}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            onChange={(e) => {
              setCode(e.target.value);
              setActionError(null);
            }}
            placeholder="123456"
          />
          {actionError && (
            <p className={styles.errorText} role="alert">
              {actionError}
            </p>
          )}
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={busy || code.trim() === ''}
              onClick={handleVerifyEnrollment}
            >
              {busy ? 'Verifying…' : 'Verify and enable'}
            </button>
            <button type="button" className={styles.secondaryBtn} disabled={busy} onClick={handleCancelEnrollment}>
              Cancel setup
            </button>
          </div>
        </>
      ) : view === 'codes' && recoveryCodes ? (
        <>
          <p className={styles.stepText}>
            Save these recovery codes now — each works once instead of a code
            from your app, and they are shown only this once.
          </p>
          <ul className={styles.codesGrid}>
            {recoveryCodes.map((c) => (
              <li key={c}>
                <code>{c}</code>
              </li>
            ))}
          </ul>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => {
                setRecoveryCodes(null);
                backToSummary();
              }}
            >
              I&apos;ve saved them
            </button>
          </div>
        </>
      ) : view === 'disable' ? (
        <>
          <p className={styles.stepText}>
            Confirm your password and a current code to turn 2FA off.
          </p>
          <PasswordField
            id="twofactor-disable-password"
            label="Password"
            value={password}
            autoComplete="current-password"
            onChange={setPassword}
          />
          <label htmlFor="twofactor-disable-code" className={styles.stepText}>
            {useRecoveryForDisable ? 'Recovery code' : 'Current 6-digit code'}
          </label>
          <input
            id="twofactor-disable-code"
            type="text"
            className={styles.codeInput}
            value={code}
            inputMode={useRecoveryForDisable ? 'text' : 'numeric'}
            autoComplete={useRecoveryForDisable ? 'off' : 'one-time-code'}
            onChange={(e) => {
              setCode(e.target.value);
              setActionError(null);
            }}
            placeholder={useRecoveryForDisable ? 'xxxxx-xxxxx-…' : '123456'}
          />
          <button
            type="button"
            className={styles.linkBtn}
            onClick={() => {
              setUseRecoveryForDisable((v) => !v);
              setCode('');
              setActionError(null);
            }}
          >
            {useRecoveryForDisable
              ? 'Use an authenticator code instead'
              : 'Lost your phone? Use a recovery code'}
          </button>
          {actionError && (
            <p className={styles.errorText} role="alert">
              {actionError}
            </p>
          )}
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.dangerBtn}
              disabled={busy || password === '' || code.trim() === ''}
              onClick={handleDisable}
            >
              {busy ? 'Turning off…' : 'Turn off 2FA'}
            </button>
            <button
              type="button"
              className={styles.secondaryBtn}
              disabled={busy}
              onClick={backToSummary}
            >
              Cancel
            </button>
          </div>
        </>
      ) : view === 'regenerate' ? (
        <>
          <p className={styles.stepText}>
            Confirm your password and a current code. New codes replace all
            existing recovery codes.
          </p>
          <PasswordField
            id="twofactor-regen-password"
            label="Password"
            value={password}
            autoComplete="current-password"
            onChange={setPassword}
          />
          <label htmlFor="twofactor-regen-code" className={styles.stepText}>
            Current 6-digit code
          </label>
          <input
            id="twofactor-regen-code"
            type="text"
            className={styles.codeInput}
            value={code}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            onChange={(e) => {
              setCode(e.target.value);
              setActionError(null);
            }}
            placeholder="123456"
          />
          {actionError && (
            <p className={styles.errorText} role="alert">
              {actionError}
            </p>
          )}
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={busy || password === '' || code.trim() === ''}
              onClick={handleRegenerate}
            >
              {busy ? 'Regenerating…' : 'Regenerate codes'}
            </button>
            <button
              type="button"
              className={styles.secondaryBtn}
              disabled={busy}
              onClick={backToSummary}
            >
              Cancel
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
