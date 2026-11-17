import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LanguageProvider } from '../i18n/LanguageContext.jsx';
import { AuthProvider } from '../auth/AuthContext.jsx';
import { ThemeProvider } from '../theme/ThemeContext.jsx';
import Layout from '../components/Layout.jsx';

describe('Top bar while a saved session is checked', () => {
  let resolveMe;
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('masar.lang', 'en');
    localStorage.setItem('masar.token', 'saved-token');
    vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      if (String(url).endsWith('/auth/me'))
        return new Promise((resolve) => {
          resolveMe = () =>
            resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve({ user: { id: 'u1', name: 'Sara', role: 'student' } }),
            });
        });
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ unseenReviews: 0, badges: [] }) });
    });
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('never shows "Log in" to a student who is already signed in', async () => {
    render(
      <MemoryRouter>
        <LanguageProvider>
          <ThemeProvider>
            <AuthProvider>
              <Routes>
                <Route element={<Layout />}>
                  <Route index element={<p>Home</p>} />
                </Route>
              </Routes>
            </AuthProvider>
          </ThemeProvider>
        </LanguageProvider>
      </MemoryRouter>
    );
    expect(screen.queryByRole('link', { name: 'Log in' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'My journey' })).not.toBeInTheDocument();
    resolveMe();
    expect(await screen.findByRole('link', { name: 'My journey' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Log in' })).not.toBeInTheDocument();
  });
});
