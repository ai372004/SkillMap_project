import { useSyncExternalStore } from 'react';
import { api } from './api.js';

// What the signed-in student hasn't seen yet: supervisor replies (the count on
// the Tasks link) and newly earned badges (celebrated once, in a toast).
// One small shared store, so the nav, the tasks page and the toast stay in step.

const SEEN_PREFIX = 'masar.badges.';
// On a browser that has never shown a badge, only celebrate ones this recent;
// older badges were earned elsewhere and are recorded silently.
const FRESH_MS = 10 * 60 * 1000;

let state = { unseen: 0, celebrate: [] };
const listeners = new Set();

function update(patch) {
  const next = { ...state, ...patch };
  if (next.unseen === state.unseen && next.celebrate === state.celebrate) return;
  state = next;
  listeners.forEach((fn) => fn());
}

function readSeen(userId) {
  try {
    const raw = localStorage.getItem(SEEN_PREFIX + userId);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSeen(userId, ids) {
  try {
    localStorage.setItem(SEEN_PREFIX + userId, JSON.stringify(ids));
  } catch {
    /* storage blocked: the badge may be celebrated again later, which is harmless */
  }
}

/**
 * Splits earned badges into the ones to celebrate now and the full seen list.
 * `seen` is null when this browser has never recorded badges for the student.
 */
export function pickNewBadges(earned, seen, now = Date.now()) {
  const known = new Set(seen || []);
  const fresh = earned.filter((b) => (seen ? !known.has(b.id) : now - new Date(b.earnedAt).getTime() <= FRESH_MS));
  return { fresh: fresh.map((b) => b.id), seen: [...new Set([...known, ...earned.map((b) => b.id)])] };
}

export async function refreshNotifications(userId) {
  let d;
  try {
    d = await api('/me/notifications');
  } catch {
    return; /* keep what we had; these are hints, not critical */
  }
  const patch = { unseen: d.unseenReviews || 0 };
  if (userId && Array.isArray(d.badges)) {
    const before = readSeen(userId);
    const { fresh, seen } = pickNewBadges(d.badges, before);
    if (!before || seen.length !== before.length) writeSeen(userId, seen);
    const queued = fresh.filter((id) => !state.celebrate.includes(id));
    if (queued.length) patch.celebrate = [...state.celebrate, ...queued];
  }
  update(patch);
}

export async function markRepliesSeen() {
  update({ unseen: 0 });
  try {
    await api('/me/notifications/seen', { method: 'POST' });
  } catch {
    /* the next refresh will show the badge again if this didn't reach the server */
  }
}

// Called when the toast for the first queued badge closes.
export function dismissCelebration() {
  update({ celebrate: state.celebrate.slice(1) });
}

export function resetNotifications() {
  update({ unseen: 0, celebrate: [] });
}

const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const useUnseenReplies = () => useSyncExternalStore(subscribe, () => state.unseen);
export const useCelebration = () => useSyncExternalStore(subscribe, () => state.celebrate[0] ?? null);
