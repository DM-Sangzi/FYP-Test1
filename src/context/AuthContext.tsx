import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  login as apiLogin,
  register as apiRegister,
  logout as apiLogout,
} from '../api/client';
import type { PublicUser } from '../types';

// ApiError now lives in the API client (where it is thrown); re-exported
// here so existing imports keep working.
import { ApiError } from '../api/client';
export { ApiError };

interface AuthContextValue {
  /** Current authenticated user, or null when logged out. */
  user: PublicUser | null;
  /** In-memory JWT. Never persisted to localStorage (PRD §5.3, §14). */
  token: string | null;
  isAuthenticated: boolean;
  /** True while an auth request is in flight. */
  loading: boolean;
  /** Error message from the most recent auth action, if any. */
  error: string | null;
  login: (identifier: string, password: string) => Promise<boolean>;
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
 * (which routes through MSW when `VITE_USE_MOCK=true`).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (identifier: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const session = await apiLogin(identifier, password);
      setToken(session.token);
      setUser(session.user);
      return true;
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

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
    setToken(null);
    setUser(null);
    setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: token !== null && user !== null,
      loading,
      error,
      login,
      register,
      logout,
      clearError,
    }),
    [user, token, loading, error, login, register, logout, clearError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
