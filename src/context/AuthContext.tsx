import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  login as apiLogin,
  register as apiRegister,
  logout as apiLogout,
  cancelLoginChallenge,
  setAuthToken,
  verifyTwoFactorLogin,
} from '../api/client';
import type { PublicUser } from '../types';

// ApiError now lives in the API client (where it is thrown); re-exported
// here so existing imports keep working.
import { ApiError } from '../api/client';
export { ApiError };

/** The account between password and second factor. Not authenticated —
 *  `isAuthenticated` stays false until verification succeeds. */
interface PendingChallenge {
  challengeId: string;
  username: string;
}

interface AuthContextValue {
  /** Current authenticated user, or null when logged out / awaiting 2FA. */
  user: PublicUser | null;
  /** In-memory JWT. Never persisted to localStorage (PRD §5.3, §14). */
  token: string | null;
  isAuthenticated: boolean;
  /** Second login step in progress (2FA enabled on the account). */
  pendingChallenge: PendingChallenge | null;
  /** True while an auth request is in flight. */
  loading: boolean;
  /** Error message from the most recent auth action, if any. */
  error: string | null;
  /** Resolves to 'authenticated', 'challenge' (2FA step required) or 'failed'. */
  login: (identifier: string, password: string) => Promise<'authenticated' | 'challenge' | 'failed'>;
  /** Completes the second factor (TOTP or recovery code). */
  verifyTwoFactor: (payload: { code?: string; recoveryCode?: string }) => Promise<boolean>;
  /** Revokes the challenge (server-side) and returns to the password step. */
  cancelChallenge: () => Promise<void>;
  register: (
    username: string,
    email: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Authentication state.
 *
 * Per PRD §5.3 the session token lives only in memory here and is cleared on
 * logout or page refresh. All credentials are delegated to the API client
 * (which routes through MSW when `VITE_USE_MOCK=true`). A 2FA challenge is
 * held only in memory: a page refresh drops it and login starts over, so
 * the second factor can never be bypassed by reloading.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [pendingChallenge, setPendingChallenge] = useState<PendingChallenge | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(
    async (identifier: string, password: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await apiLogin(identifier, password);
        if ('challenge' in result) {
          setPendingChallenge({
            challengeId: result.challenge.challengeId,
            username: result.challenge.username,
          });
          return 'challenge';
        }
        setToken(result.token);
        setUser(result.user);
        // Share the in-memory token with the API client so friend/search
        // endpoints can identify the caller (mock identity marking).
        setAuthToken(result.token);
        return 'authenticated';
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
        setError(message);
        return 'failed';
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const verifyTwoFactor = useCallback(async (payload: { code?: string; recoveryCode?: string }) => {
    const challenge = pendingChallenge;
    if (!challenge) return false;
    setLoading(true);
    setError(null);
    try {
      const session = await verifyTwoFactorLogin(challenge.challengeId, payload);
      setPendingChallenge(null);
      setToken(session.token);
      setUser(session.user);
      setAuthToken(session.token);
      return true;
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [pendingChallenge]);

  const cancelChallenge = useCallback(async () => {
    const challenge = pendingChallenge;
    setPendingChallenge(null);
    setError(null);
    if (challenge) {
      try {
        await cancelLoginChallenge(challenge.challengeId);
      } catch {
        // The challenge also expires server-side; losing this revoke call
        // (e.g. offline) does not grant a session.
      }
    }
  }, [pendingChallenge]);

  const register = useCallback(
    async (username: string, email: string, password: string) => {
      setLoading(true);
      setError(null);
      try {
        await apiRegister(username, email, password);
        return { success: true };
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : 'Something went wrong. Please try again.';
        setError(message);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    await apiLogout();
    setAuthToken(null);
    setToken(null);
    setUser(null);
    setPendingChallenge(null);
    setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: token !== null && user !== null,
      pendingChallenge,
      loading,
      error,
      login,
      verifyTwoFactor,
      cancelChallenge,
      register,
      logout,
      clearError,
    }),
    [
      user,
      token,
      pendingChallenge,
      loading,
      error,
      login,
      verifyTwoFactor,
      cancelChallenge,
      register,
      logout,
      clearError,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
