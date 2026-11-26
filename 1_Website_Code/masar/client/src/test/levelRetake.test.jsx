import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LanguageProvider } from '../i18n/LanguageContext.jsx';
import { AuthProvider } from '../auth/AuthContext.jsx';
import LevelTest from '../pages/LevelTest.jsx';
import LevelResult from '../pages/LevelResult.jsx';

const USER = { id: 'u1', name: 'Sara', email: 'sara@example.com', role: 'student', chosenTrack: 'data' };
const TRACKS = [{ id: 'data', color: '#392c7d', name: { ar: 'data', en: 'Data' }, short: { ar: 'data', en: 'Data' } }];
const reply = (status, body) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
const inDays = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();

function renderAt(path, routes) {
  vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
    const u = String(url);
    if (u.endsWith('/auth/me')) return reply(200, { user: USER });
    if (u.endsWith('/tracks')) return reply(200, { tracks: TRACKS });
    for (const [end, res] of Object.entries(routes)) if (u.endsWith(end)) return res();
    return reply(404, {});
  });
  render(
    <MemoryRouter initialEntries={[path]}>
      <LanguageProvider>
        <AuthProvider>
          <Routes>
            <Route path="/level-test/:track" element={<LevelTest />} />
            <Route path="/level-result/:track" element={<LevelResult />} />
          </Routes>
        </AuthProvider>
      </LanguageProvider>
    </MemoryRouter>
  );
}

const RESULT = {
  track: 'data',
  level: 'intermediate',
  percent: 60,
  correctCount: 9,
  total: 15,
  weightedScore: 18,
  maxScore: 30,
  byDifficulty: {},
};

describe('Level test retakes', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('masar.lang', 'en');
    localStorage.setItem('masar.token', 'tok');
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('explains when a recently taken test opens again instead of showing the questions', async () => {
    renderAt('/level-test/data', {
      '/tracks/data/level-test': () =>
        reply(429, { error: { code: 'RETAKE_TOO_SOON', message: 'Later', details: { retakeAt: inDays(5) } } }),
    });
    expect(await screen.findByText('The level test is locked for now')).toBeInTheDocument();
    expect(screen.getByText(/You can retake it from/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open your plan' })).toHaveAttribute('href', '/plan');
  });

  it('hides the retake button on the result until the test reopens', async () => {
    renderAt('/level-result/data', {
      '/me/progress': () => reply(200, { levelResults: { data: { ...RESULT, retakeAt: inDays(6) } } }),
    });
    expect(await screen.findByText(/You can retake the test from/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Retake the test' })).not.toBeInTheDocument();
  });

  it('offers the retake once the waiting time has passed', async () => {
    renderAt('/level-result/data', {
      '/me/progress': () => reply(200, { levelResults: { data: { ...RESULT, retakeAt: inDays(-1) } } }),
    });
    expect(await screen.findByRole('link', { name: 'Retake the test' })).toHaveAttribute('href', '/level-test/data');
  });
});
