import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// Light / dark theme.
// The site opens in light mode. Dark mode is still there: the visitor can
// switch to it, and that choice is saved in the browser.
const ThemeContext = createContext(null);
export const THEME_KEY = 'masar.theme';

// Dark mode switch. When false, the theme button is hidden and every visitor
// sees light mode (the dark-mode code and colours stay in place).
// Keep it in step with DARK_MODE_ENABLED in public/theme-init.js.
export const DARK_MODE_ENABLED = true;

function readSaved() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === 'dark' || saved === 'light' ? saved : null;
  } catch {
    return null;
  }
}

export function ThemeProvider({ children, allowDark = DARK_MODE_ENABLED }) {
  const [theme, setChoice] = useState(() => (allowDark && readSaved()) || 'light');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#16130f' : '#f6f7f3');
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

  const value = useMemo(() => ({ theme, setTheme, toggleTheme, allowDark }), [theme, setTheme, toggleTheme, allowDark]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
