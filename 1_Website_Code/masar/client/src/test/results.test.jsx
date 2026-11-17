import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LanguageProvider } from '../i18n/LanguageContext.jsx';
import { AuthProvider, useAuth } from '../auth/AuthContext.jsx';
import CountUp from '../components/CountUp.jsx';
import TrackResult from '../pages/TrackResult.jsx';

const reduceMotion = (on) =>
  vi.stubGlobal('matchMedia', (q) => ({
    matches: on && q.includes('reduce'),
    media: q,
    addEventListener() {},
    removeEventListener() {},
  }));

const TRACKS = ['uiux', 'frontend', 'backend', 'data'].map((id) => ({
  id,
  color: '#392c7d',
  name: { ar: id, en: `${id} track` },
  short: { ar: id, en: id.toUpperCase() },
  description: { ar: '', en: `About ${id}` },
}));

const RESULT = {
  recommendedTrack: 'frontend',
  scores: [
    { track: 'frontend', percent: 82 },
    { track: 'uiux', percent: 64 },
    { track: 'backend', percent: 40 },
    { track: 'data', percent: 22 },
  ],
  reasons: [
    {
      questionId: 'q3',
      question: { ar: 'س', en: 'What do you enjoy building?' },
      answer: { ar: 'ج', en: 'Pages people click' },
    },
    {
      questionId: 'q7',
      question: { ar: 'س', en: 'Pick a weekend project' },
      answer: { ar: 'ج', en: 'A small web game' },
    },
  ],
};

const reply = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });

function WhenSignedIn({ children }) {
  const { user } = useAuth();
  return user ? children : null;
}

describe('CountUp', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows the final number at once when the viewer asked for less motion', () => {
    reduceMotion(true);
    const { container } = render(<CountUp value={73} format={(n) => `${n}%`} />);
    expect(container.querySelector('[aria-hidden="true"]').textContent).toBe('73%');
  });

  it('gives screen readers the final value while the digits are still moving', async () => {
    reduceMotion(false);
    const { container } = render(<CountUp value={73} format={(n) => `${n}%`} />);
    expect(container.querySelector('.sr-only').textContent).toBe('73%');
    expect(container.querySelector('[aria-hidden="true"]').textContent).toBe('0%');
    await waitFor(() => expect(container.querySelector('[aria-hidden="true"]').textContent).toBe('73%'), {
      timeout: 2000,
    });
  });
});

describe('Track result page', () => {
  beforeEach(() => {
    reduceMotion(true);
    localStorage.clear();
    localStorage.setItem('masar.lang', 'en');
    localStorage.setItem('masar.token', 'test-token');
    vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      if (String(url).endsWith('/auth/me')) return reply({ user: { id: 'u1', role: 'student', chosenTrack: null } });
      if (String(url).endsWith('/tracks')) return reply({ tracks: TRACKS });
      return reply({});
    });
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('explains the suggestion with the student’s own answers', async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/track-result', state: { result: RESULT } }]}>
        <LanguageProvider>
          <AuthProvider>
            <WhenSignedIn>
              <Routes>
                <Route path="/track-result" element={<TrackResult />} />
              </Routes>
            </WhenSignedIn>
          </AuthProvider>
        </LanguageProvider>
      </MemoryRouter>
    );
    const why = await screen.findByRole('heading', { name: 'Why FRONTEND? From your answers:' });
    const list = why.parentElement.querySelector('ul');
    expect(list.children).toHaveLength(2);
    expect(list).toHaveTextContent('What do you enjoy building?');
    expect(list).toHaveTextContent('You answered: Pages people click');
    expect(screen.getAllByText('82% match').length).toBeGreaterThan(0);
  });
});
