import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// Light / dark theme.
// The user's choice is saved in the browser. Until they choose, the site
// follows the device setting (and keeps following it if that changes).
const ThemeContext = createContext(null);
export const THEME_KEY = 'masar.theme';

const media = () =>
  typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
const systemTheme = () => (media()?.matches ? 'dark' : 'light');

function readSaved() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === 'dark' || saved === 'light' ? saved : null;
  } catch {
    return null;
  }
}

export function ThemeProvider({ children }) {
  const [choice, setChoice] = useState(readSaved); // 'light' | 'dark' | null (follow device)
  const [system, setSystem] = useState(systemTheme);
  const theme = choice || system;

  // Follow device changes while the user hasn't picked a theme.
  useEffect(() => {
    const mq = media();
    if (!mq) return undefined;
    const onChange = (e) => setSystem(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#15132a' : '#f8f8f8');
  }, [theme]);

  const setTheme = useCallback((next) => {
    setChoice(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* storage may be blocked; the choice still works for this visit */
    }
  }, []);

  const toggleTheme = useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [theme, setTheme]);

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
