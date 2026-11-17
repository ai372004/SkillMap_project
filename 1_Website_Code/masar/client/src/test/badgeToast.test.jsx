import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../i18n/LanguageContext.jsx';
import { AuthProvider } from '../auth/AuthContext.jsx';
import BadgeToast from '../components/BadgeToast.jsx';
import { pickNewBadges, refreshNotifications, resetNotifications } from '../notifications.js';

const NOW = Date.parse('2026-11-16T10:00:00Z');
const minutesAgo = (m) => new Date(NOW - m * 60000).toISOString();

describe('pickNewBadges', () => {
  it('celebrates only recent badges on a browser that has never seen any', () => {
    const earned = [
      { id: 'trackQuiz', earnedAt: minutesAgo(60 * 24) },
      { id: 'levelTest', earnedAt: minutesAgo(2) },
    ];
    expect(pickNewBadges(earned, null, NOW)).toEqual({ fresh: ['levelTest'], seen: ['trackQuiz', 'levelTest'] });
  });

  it('celebrates any badge missing from the seen list, however old', () => {
    const earned = [
      { id: 'trackQuiz', earnedAt: minutesAgo(600) },
      { id: 'firstApproval', earnedAt: minutesAgo(600) },
    ];
    expect(pickNewBadges(earned, ['trackQuiz'], NOW)).toEqual({
      fresh: ['firstApproval'],
      seen: ['trackQuiz', 'firstApproval'],
    });
  });

  it('records an empty list for a new student, so their first badge is celebrated later', () => {
    expect(pickNewBadges([], null, NOW)).toEqual({ fresh: [], seen: [] });
  });
});

describe('Badge toast', () => {
  const reply = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('masar.lang', 'en');
    localStorage.setItem('masar.badges.u1', JSON.stringify(['trackQuiz']));
    vi.spyOn(globalThis, 'fetch').mockImplementation((url) =>
      String(url).endsWith('/me/notifications')
        ? reply({
            unseenReviews: 0,
            items: [],
            badges: [
              { id: 'trackQuiz', earnedAt: minutesAgo(5) },
              { id: 'levelTest', earnedAt: minutesAgo(0) },
            ],
          })
        : reply({ tracks: [] })
    );
  });
  afterEach(() => {
    cleanup();
    resetNotifications();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  const renderToast = () =>
    render(
      <MemoryRouter initialEntries={['/level-result/frontend']}>
        <LanguageProvider>
          <AuthProvider>
            <BadgeToast />
          </AuthProvider>
        </LanguageProvider>
      </MemoryRouter>
    );

  it('announces a new badge once, with the next step, and remembers it', async () => {
    renderToast();
    await act(() => refreshNotifications('u1'));
    const region = screen.getByRole('status');
    expect(region).toHaveTextContent('New badge');
    expect(region).toHaveTextContent('Know your level');
    expect(screen.getByRole('link', { name: 'Open the plan' })).toHaveAttribute('href', '/plan');
    expect(JSON.parse(localStorage.getItem('masar.badges.u1'))).toEqual(['trackQuiz', 'levelTest']);

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(region).toBeEmptyDOMElement();

    // A later check finds nothing new to celebrate.
    await act(() => refreshNotifications('u1'));
    expect(region).toBeEmptyDOMElement();
  });

  it('closes by itself after a few seconds, but stays while hovered', async () => {
    renderToast();
    await act(() => refreshNotifications('u1'));
    vi.useFakeTimers();
    const card = screen.getByText('Know your level').closest('.toast');
    fireEvent.mouseEnter(card);
    act(() => vi.advanceTimersByTime(10000));
    expect(screen.queryByText('Know your level')).toBeInTheDocument();
    fireEvent.mouseLeave(card);
    act(() => vi.advanceTimersByTime(6000));
    expect(screen.queryByText('Know your level')).not.toBeInTheDocument();
  });
});
