import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../i18n/LanguageContext.jsx';
import { AuthProvider, useAuth } from '../auth/AuthContext.jsx';
import Plan from '../pages/Plan.jsx';

const step = (id, en) => ({ id, title: { ar: en, en }, details: { ar: '', en: `About ${en}` } });
const PLAN = {
  track: { id: 'frontend', color: '#1d5fd6', short: { ar: 'Front-end', en: 'Front-end' } },
  level: 'beginner',
  plan: {
    title: { ar: 'خطة', en: 'Starter plan' },
    summary: { ar: '', en: 'Basics first' },
    steps: [step('s1', 'Semantic HTML'), step('s2', 'CSS and layout')],
  },
  done: ['s1'],
  tasks: [],
  resources: [],
};

const json = (status, body) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });

function WhenSignedIn({ children }) {
  const { user } = useAuth();
  return user ? children : null;
}

function renderPlan() {
  render(
    <MemoryRouter initialEntries={['/plan']}>
      <LanguageProvider>
        <AuthProvider>
          <WhenSignedIn>
            <Plan />
          </WhenSignedIn>
        </AuthProvider>
      </LanguageProvider>
    </MemoryRouter>
  );
}

describe('Plan checklist', () => {
  let saveStatus;
  let planReply;
  beforeEach(() => {
    saveStatus = 200;
    planReply = PLAN;
    localStorage.clear();
    localStorage.setItem('masar.lang', 'en');
    localStorage.setItem('masar.token', 'test-token');
    vi.spyOn(globalThis, 'fetch').mockImplementation((url, init) => {
      const u = String(url);
      if (u.endsWith('/auth/me')) return json(200, { user: { id: 'u1', role: 'student', chosenTrack: 'frontend' } });
      if (u.endsWith('/me/plan')) return json(200, structuredClone(planReply));
      if (u.includes('/me/plan/steps/') && init?.method === 'PUT')
        return saveStatus === 200 ? json(200, { done: [] }) : json(500, { error: { code: 'SERVER_ERROR' } });
      return json(200, {});
    });
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('shows saved progress and ticks a step straight away', async () => {
    renderPlan();
    expect(await screen.findByText('1 of 2 steps done')).toBeInTheDocument();
    const second = screen.getByRole('checkbox', { name: 'I finished this step: CSS and layout' });
    expect(second).not.toBeChecked();

    fireEvent.click(second);
    expect(second).toBeChecked();
    expect(screen.getByText('2 of 2 steps done')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'You finished every step of the plan' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Retake the level test' })).toHaveAttribute('href', '/level-test/frontend');

    const put = globalThis.fetch.mock.calls.find(([, init]) => init?.method === 'PUT');
    expect(String(put[0])).toMatch(/\/me\/plan\/steps\/s2$/);
    expect(JSON.parse(put[1].body)).toEqual({ done: true });
  });

  it('points to the level test when the student has not taken it yet', async () => {
    planReply = { needs: 'level', track: { id: 'frontend' } };
    renderPlan();
    expect(await screen.findByText('Test your level first so we can prepare your plan.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start the level test' })).toHaveAttribute('href', '/level-test/frontend');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('undoes the tick and explains when saving fails', async () => {
    saveStatus = 500;
    renderPlan();
    const first = await screen.findByRole('checkbox', { name: 'I finished this step: Semantic HTML' });
    fireEvent.click(first);
    expect(first).not.toBeChecked();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await waitFor(() => expect(first).toBeChecked());
    expect(screen.getByText('1 of 2 steps done')).toBeInTheDocument();
  });
});
