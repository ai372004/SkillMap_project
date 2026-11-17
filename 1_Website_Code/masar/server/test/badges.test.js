// Unit tests for the badges. No database needed: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BADGE_IDS, computeBadges } from '../src/services/badges.js';

const byId = (list) => Object.fromEntries(list.map((b) => [b.id, b]));

test('a new student has all four badges, none earned', () => {
  const badges = computeBadges({});
  assert.deepEqual(badges.map((b) => b.id), BADGE_IDS);
  assert.ok(badges.every((b) => !b.earned && b.earnedAt === null));
});

test('each badge follows its own step', () => {
  const b = byId(computeBadges({
    trackResults: [{ createdAt: '2026-11-01T10:00:00Z' }],
    levelResults: [{ createdAt: '2026-11-02T10:00:00Z' }],
    submissions: [{ createdAt: '2026-11-03T10:00:00Z', status: 'pending' }],
  }));
  assert.equal(b.trackQuiz.earned, true);
  assert.equal(b.levelTest.earned, true);
  assert.equal(b.firstSubmission.earned, true);
  assert.equal(b.firstApproval.earned, false, 'a pending task is not an approval');
});

test('earned dates use the first time, and approval uses the review date', () => {
  const b = byId(computeBadges({
    submissions: [
      { createdAt: '2026-11-05T10:00:00Z', status: 'approved', reviewedAt: '2026-11-07T09:00:00Z' },
      { createdAt: '2026-11-03T10:00:00Z', status: 'approved', reviewedAt: '2026-11-06T09:00:00Z' },
      { createdAt: '2026-11-01T10:00:00Z', status: 'needs_revision' },
    ],
  }));
  assert.equal(b.firstSubmission.earnedAt.toISOString(), '2026-11-01T10:00:00.000Z');
  assert.equal(b.firstApproval.earnedAt.toISOString(), '2026-11-06T09:00:00.000Z');
});

test('a task sent back for revision does not count as approved', () => {
  const b = byId(computeBadges({ submissions: [{ createdAt: '2026-11-01T10:00:00Z', status: 'needs_revision' }] }));
  assert.equal(b.firstApproval.earned, false);
});
