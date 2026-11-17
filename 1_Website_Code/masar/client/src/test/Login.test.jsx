import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LanguageProvider } from '../i18n/LanguageContext.jsx';
import { AuthProvider } from '../auth/AuthContext.jsx';
import { Login } from '../pages/Auth.jsx';

function renderLogin() {
  render(
    <MemoryRouter initialEntries={['/login']}>
      <LanguageProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<p>Dashboard page</p>} />
            <Route path="/admin" element={<p>Admin page</p>} />
          </Routes>
        </AuthProvider>
      </LanguageProvider>
    </MemoryRouter>
  );
}
const reply = (status, body) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
const fill = (email, password) => {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
};

describe('Login page', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('masar.lang', 'en');
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('shows the server message for wrong credentials', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      reply(401, { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid' } })
    );
    renderLogin();
    fill('sara@example.com', 'wrongpass');
    expect(await screen.findByText('Wrong email or password.')).toBeInTheDocument();
  });

  it('explains a network failure in plain words', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.reject(new TypeError('Failed to fetch')));
    renderLogin();
    fill('sara@example.com', 'secret123');
    expect(await screen.findByText(/Can’t reach the server/)).toBeInTheDocument();
  });

  it('signs a student in, stores the session and opens the dashboard', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      reply(200, { token: 'tok', user: { id: 'u1', name: 'Sara', role: 'student' } })
    );
    renderLogin();
    fill('sara@example.com', 'secret123');
    expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
    await waitFor(() => expect(localStorage.getItem('masar.token')).toBe('tok'));
  });

  it('sends a supervisor to the admin panel', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      reply(200, { token: 'tok', user: { id: 'a1', name: 'Admin', role: 'admin' } })
    );
    renderLogin();
    fill('admin@example.com', 'secret123');
    expect(await screen.findByText('Admin page')).toBeInTheDocument();
  });
});
