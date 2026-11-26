import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LanguageProvider } from '../i18n/LanguageContext.jsx';
import { AuthProvider } from '../auth/AuthContext.jsx';
import Account from '../pages/Account.jsx';

const USER = { id: 'u1', name: 'Sara', email: 'sara@example.com', role: 'student' };
const reply = (status, body) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });

function renderAccount(changeReply) {
  vi.spyOn(globalThis, 'fetch').mockImplementation((url) =>
    String(url).endsWith('/auth/me') ? reply(200, { user: USER }) : changeReply()
  );
  render(
    <MemoryRouter initialEntries={['/account']}>
      <LanguageProvider>
        <AuthProvider>
          <Routes>
            <Route path="/account" element={<Account />} />
          </Routes>
        </AuthProvider>
      </LanguageProvider>
    </MemoryRouter>
  );
}

async function changePassword(current, next) {
  fireEvent.change(await screen.findByLabelText('Current password'), { target: { value: current } });
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: next } });
  fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: next } });
  fireEvent.click(screen.getByRole('button', { name: 'Save password' }));
}

describe('Account page', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('masar.lang', 'en');
    localStorage.setItem('masar.token', 'tok');
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('says the current password is wrong, not that it is missing', async () => {
    renderAccount(() =>
      reply(400, { error: { code: 'WRONG_PASSWORD', message: 'Wrong', details: { fields: ['currentPassword'] } } })
    );
    await changePassword('notmypass', 'newpass123');
    expect(await screen.findByText('The current password is wrong.')).toBeInTheDocument();
    expect(screen.queryByText('Enter your current password.')).not.toBeInTheDocument();
  });

  it('says when the new password is the same as the current one', async () => {
    renderAccount(() =>
      reply(400, { error: { code: 'SAME_PASSWORD', message: 'Same', details: { fields: ['newPassword'] } } })
    );
    await changePassword('mypass123', 'mypass123');
    expect(await screen.findByText('Choose a password different from the current one.')).toBeInTheDocument();
  });
});
