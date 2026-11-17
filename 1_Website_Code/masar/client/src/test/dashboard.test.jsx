import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../i18n/LanguageContext.jsx';
import { AuthProvider, useAuth } from '../auth/AuthContext.jsx';
import Dashboard from '../pages/Dashboard.jsx';
import { Loading } from '../components/States.jsx';
import { saveProgress, progressKey } from '../quizProgress.js';

const TRACKS = [
  { id: 'frontend', color: '#1d5fd6', name: { ar: 'Front-end', en: 'Front-end' }, short: { ar: 'FE', en: 'FE' } },
  { id: 'data', color: '#b4560a', name: { ar: 'Data', en: 'Data' }, short: { ar: 'Data', en: 'Data' } },
];
const USER = { id: 'u1', name: 'Sara Ali', role: 'student', chosenTrack: 'frontend' };
const base = {
  user: USER,
  trackResult: { recommendedTrack: 'frontend', scores: [] },
  levelResults: {},
  submissions: [],
  summary: { submitted: 0, approved: 0, pending: 0, needsRevision: 0 },
  badges: [],
  plan: null,
};
const json = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });

function WhenSignedIn({ children }) {
  const { user } = useAuth();
  return user ? children : null;
}

function renderDashboard(progress) {
  vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
    const u = String(url);
    if (u.endsWith('/auth/me')) return json({ user: USER });
    if (u.endsWith('/tracks')) return json({ tracks: TRACKS });
    if (u.endsWith('/me/progress')) return json(progress);
    return json({});
  });
  render(
    <MemoryRouter>
      <LanguageProvider>
        <AuthProvider>
          <WhenSignedIn>
            <Dashboard />
          </WhenSignedIn>
        </AuthProvider>
      </LanguageProvider>
    </MemoryRouter>
  );
}

const nextCard = async () => (await screen.findByRole('heading', { name: 'Next step' })).closest('section');

describe('Dashboard next step', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('masar.lang', 'en');
    localStorage.setItem('masar.token', 'test-token');
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('says how long the level test takes', async () => {
    renderDashboard(base);
    const card = await nextCard();
    expect(within(card).getByText('About 10 minutes')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'Start the level test' })).toHaveAttribute(
      'href',
      '/level-test/frontend'
    );
  });

  it('offers to resume a half-finished test with the time left', async () => {
    const questions = Array.from({ length: 9 }, (_, i) => `q${i}`);
    saveProgress(progressKey('u1', 'level-frontend'), Object.fromEntries(questions.map((q) => [q, 'a'])), 'q9');
    renderDashboard(base);
    const card = await nextCard();
    expect(within(card).getByText(/You answered 9 of 15/)).toBeInTheDocument();
    expect(within(card).getByText('About 4 minutes')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'Continue the level test' })).toBeInTheDocument();
  });

  it('puts a task sent back for changes first', async () => {
    renderDashboard({
      ...base,
      levelResults: { frontend: { level: 'beginner' } },
      submissions: [{ track: 'frontend', taskId: 'fe-t1', status: 'needs_revision' }],
      summary: { submitted: 1, approved: 0, pending: 0, needsRevision: 1 },
      plan: {
        stepsDone: 1,
        stepsTotal: 4,
        tasksTotal: 2,
        tasksApproved: 0,
        nextTask: { id: 'fe-t1', title: { ar: 'صفحة', en: 'Profile page' }, status: 'needs_revision' },
      },
    });
    const card = await nextCard();
    expect(within(card).getByText(/asked for changes to “Profile page”/)).toBeInTheDocument();
    expect(within(card).getByText('0 of 2 tasks approved')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'Open the task' })).toHaveAttribute('href', '/tasks#fe-t1');
  });
});

describe('Loading skeleton', () => {
  afterEach(cleanup);

  it('is announced once and hides the placeholder shapes from screen readers', () => {
    localStorage.setItem('masar.lang', 'en');
    render(
      <LanguageProvider>
        <Loading shape="quiz" />
      </LanguageProvider>
    );
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveTextContent(/^Loading/);
    expect(status.querySelector('.skeleton__shape')).toHaveAttribute('aria-hidden', 'true');
  });
});
