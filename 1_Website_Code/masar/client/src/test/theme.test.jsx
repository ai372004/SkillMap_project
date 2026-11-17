import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { ThemeProvider, useTheme, THEME_KEY } from '../theme/ThemeContext.jsx';

function Probe() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button type="button" onClick={toggleTheme}>
      {theme}
    </button>
  );
}

describe('ThemeProvider', () => {
  afterEach(cleanup);
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    // The device asks for dark mode; the site should still open in light.
    window.matchMedia = (q) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} });
  });

  it('opens in light mode when nothing is saved, whatever the device setting', () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    expect(screen.getByRole('button')).toHaveTextContent('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('saves the choice and applies it to the document', () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    act(() => screen.getByRole('button').click());
    expect(screen.getByRole('button')).toHaveTextContent('dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('uses dark mode when the visitor has chosen it', () => {
    localStorage.setItem(THEME_KEY, 'dark');
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    expect(screen.getByRole('button')).toHaveTextContent('dark');
  });
});
