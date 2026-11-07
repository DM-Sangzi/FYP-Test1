import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'pqpm_theme';

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    /* storage blocked — fall through to the default */
  }
  // Redesign default: dark messenger (light remains available).
  return 'dark';
}

interface ThemeContextValue {
  /** The stored preference ('light' | 'dark' | 'system'). */
  theme: Theme;
  /** The theme actually applied ('light' | 'dark'; 'system' resolves). */
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Theme provider (redesigned).
 *
 * PRD §5.5 & §2.1 require the theme preference to persist. Unlike the JWT
 * (which must stay in memory only), the visual theme preference is a benign
 * UI setting, so it is the one piece of data we intentionally persist to
 * localStorage under `pqpm_theme` ('light' | 'dark' | 'system'; legacy
 * 'light'/'dark' values are still honoured). 'system' follows the OS
 * `prefers-color-scheme` and updates live. localStorage access is guarded
 * so the app still works when storage is blocked (PRD §13).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false,
  );

  // Follow OS changes while in 'system' mode.
  useEffect(() => {
    if (theme !== 'system' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  const resolvedTheme: 'light' | 'dark' =
    theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = useCallback((next: Theme) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore — preference just won't persist this session */
    }
    setThemeState(next);
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
