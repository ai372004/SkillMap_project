import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../i18n/LanguageContext.jsx';
import { AuthProvider, useAuth } from '../auth/AuthContext.jsx';
import Admin from '../pages/Admin.jsx';

const DAY = 24 * 60 * 60 * 1000;
const STATS = {
  students: 10,
  newThisWeek: 2,
  trackQuizzes: 9,
  levelTests: 7,
  recommended: { uiux: 2, frontend: 4, backend: 2, data: 1 },
  chosen: { uiux: 2, frontend: 4, backend: 2, data: 1 },
  levelsByTrack: Object.fromEntries(
    ['uiux', 'frontend', 'backend', 'data'].map((t) => [t, { beginner: 1, intermediate: 1, advanced: 0 }])
  ),
  submissions: { total: 4, pending: 1, approved: 2, needs_revision: 1 },
  funnel: { registered: 10, trackQuiz: 9, levelTest: 7, submitted: 3, approved: 2 },
  quiet: 2,
};
const TRACKS = ['uiux', 'frontend', 'backend', 'data'].map((id) => ({
  id,
  color: '#392c7d',
  name: { ar: id, en: id },
  short: { ar: id, en: id },
}));
const quietStudent = {
  id: 's9',
  name: 'Omar Quiet',
  email: 'omar@example.com',
  chosenTrack: null,
  level: null,
  submissions: 0,
  approved: 0,
  createdAt: new Date(Date.now() - 20 * DAY).toISOString(),
  lastSeenAt: new Date(Date.now() - 10 * DAY).toISOString(),
};
const json = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });

function WhenSignedIn({ children }) {
  const { user } = useAuth();
  return user ? children : null;
}

describe('Admin overview', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('masar.lang', 'en');
    localStorage.setItem('masar.token', 'admin-token');
    vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      const u = String(url);
      if (u.endsWith('/auth/me')) return json({ user: { id: 'a1', name: 'Admin', role: 'admin' } });
      if (u.endsWith('/tracks')) return json({ tracks: TRACKS });
      if (u.endsWith('/admin/stats')) return json(STATS);
      if (u.includes('/admin/students?'))
        return json({ students: [quietStudent], page: 1, pages: 1, pageSize: 20, total: 1 });
      return json({});
    });
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('shows where students stop and leads to the quiet ones', async () => {
    render(
      <MemoryRouter>
        <LanguageProvider>
          <AuthProvider>
            <WhenSignedIn>
              <Admin />
            </WhenSignedIn>
          </AuthProvider>
        </LanguageProvider>
      </MemoryRouter>
    );
    const funnel = (await screen.findByRole('heading', { name: 'Where do students stop?' })).closest('section');
    expect(within(funnel).getAllByRole('listitem')).toHaveLength(5);
    expect(within(funnel).getByText('70% of sign-ups')).toBeInTheDocument();
    expect(funnel).toHaveTextContent(
      'The biggest drop is between “Finished the level test” and “Submitted a task”: 4 fewer.'
    );
    expect(funnel).toHaveTextContent('Quiet for a week: 2');

    fireEvent.click(within(funnel).getByRole('button', { name: 'Show their names' }));
    expect(screen.getByRole('tab', { name: 'Students' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('checkbox', { name: 'Quiet for a week only' })).toBeChecked();
    const row = (await screen.findByRole('button', { name: 'Omar Quiet' })).closest('tr');
    expect(row).toHaveTextContent('10 days ago');
    expect(row).toHaveTextContent('Quiet');
    expect(globalThis.fetch.mock.calls.some(([url]) => String(url).includes('quiet=1'))).toBe(true);
  });
});
