// Unit tests for the scoring logic and content files. No database needed: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRACK_IDS, TRACK_QUIZ, getTrackContent } from '../src/content/index.js';
import {
  LEVEL_RETAKE_DAYS,
  explainTrack,
  levelFromPercent,
  levelRetakeAt,
  scoreLevelTest,
  scoreTrackQuiz,
  ScoringError,
} from '../src/services/scoring.js';

// Picks, for every question, the option whose main track is `track`.
function answersFor(track) {
  return Object.fromEntries(
    TRACK_QUIZ.questions.map((q) => [q.id, q.options.find((o) => o.points[track] === 3).id])
  );
}

test('every track quiz question has one main option per track', () => {
  for (const q of TRACK_QUIZ.questions) {
    for (const track of TRACK_IDS) {
      assert.equal(q.options.filter((o) => o.points[track] === 3).length, 1, `${q.id} / ${track}`);
    }
  }
});

test('choosing one track everywhere recommends it at 100%', () => {
  for (const track of TRACK_IDS) {
    const result = scoreTrackQuiz(answersFor(track));
    assert.equal(result.recommendedTrack, track);
    assert.equal(result.scores[0].percent, 100);
    assert.equal(result.closeMatch, false);
  }
});

test('a split between two tracks is flagged as a close match', () => {
  const a = answersFor('frontend');
  const b = answersFor('backend');
  const mixed = Object.fromEntries(TRACK_QUIZ.questions.map((q, i) => [q.id, i % 2 ? b[q.id] : a[q.id]]));
  const result = scoreTrackQuiz(mixed);
  assert.ok(['frontend', 'backend'].includes(result.recommendedTrack));
  assert.equal(result.closeMatch, true);
});

test('missing answers are rejected', () => {
  assert.throws(() => scoreTrackQuiz({ tq1: 'a' }), ScoringError);
});

test('level thresholds', () => {
  assert.equal(levelFromPercent(0), 'beginner');
  assert.equal(levelFromPercent(49), 'beginner');
  assert.equal(levelFromPercent(50), 'intermediate');
  assert.equal(levelFromPercent(79), 'intermediate');
  assert.equal(levelFromPercent(80), 'advanced');
  assert.equal(levelFromPercent(100), 'advanced');
});

test('level test: all correct is advanced, all wrong is beginner', () => {
  for (const track of TRACK_IDS) {
    const questions = getTrackContent(track).levelTest;
    const right = Object.fromEntries(questions.map((q) => [q.id, q.answer]));
    const wrong = Object.fromEntries(questions.map((q) => [q.id, q.options.find((o) => o.id !== q.answer).id]));

    const best = scoreLevelTest(track, right);
    assert.equal(best.percent, 100);
    assert.equal(best.level, 'advanced');
    assert.equal(best.maxScore, 30);

    const worst = scoreLevelTest(track, wrong);
    assert.equal(worst.percent, 0);
    assert.equal(worst.level, 'beginner');
  }
});

test('level test weights hard questions more', () => {
  const questions = getTrackContent('data').levelTest;
  const onlyEasy = Object.fromEntries(
    questions.map((q) => [q.id, q.difficulty === 'easy' ? q.answer : q.options.find((o) => o.id !== q.answer).id])
  );
  const result = scoreLevelTest('data', onlyEasy);
  assert.equal(result.correctCount, 5);
  assert.equal(result.weightedScore, 5);
  assert.equal(result.percent, 17);
});

test('explainTrack returns the answers that point to the track, strongest first', () => {
  const quiz = {
    questions: [
      { id: 'x1', q: { ar: 'س1', en: 'Q1' }, options: [{ id: 'a', text: { ar: 'أ', en: 'A' }, points: { uiux: 1 } }] },
      { id: 'x2', q: { ar: 'س2', en: 'Q2' }, options: [{ id: 'a', text: { ar: 'ب', en: 'B' }, points: { uiux: 3 } }] },
      { id: 'x3', q: { ar: 'س3', en: 'Q3' }, options: [{ id: 'a', text: { ar: 'ج', en: 'C' }, points: { data: 3 } }] },
      { id: 'x4', q: { ar: 'س4', en: 'Q4' }, options: [{ id: 'a', text: { ar: 'د', en: 'D' }, points: { uiux: 3 } }] },
    ],
  };
  const answers = { x1: 'a', x2: 'a', x3: 'a', x4: 'a' };
  const reasons = explainTrack(answers, 'uiux', quiz, 2);
  assert.deepEqual(reasons.map((r) => r.questionId), ['x2', 'x4']);
  assert.deepEqual(reasons[0].answer, { ar: 'ب', en: 'B' });
  assert.deepEqual(explainTrack(answers, 'backend', quiz), []);
  assert.deepEqual(explainTrack(null, 'uiux', quiz), []);
});

test('explainTrack works on the real quiz for every recommended track', () => {
  for (const track of TRACK_IDS) {
    const answers = Object.fromEntries(
      TRACK_QUIZ.questions.map((q) => [q.id, q.options.find((o) => o.points[track] === 3).id])
    );
    const result = scoreTrackQuiz(answers);
    const reasons = explainTrack(answers, result.recommendedTrack);
    assert.equal(reasons.length, 3, track);
    assert.ok(reasons.every((r) => r.question.ar && r.answer.ar && r.answer.en), track);
  }
});

test('every plan step has an id that is unique within its plan', () => {
  for (const track of TRACK_IDS) {
    for (const [level, plan] of Object.entries(getTrackContent(track).plans)) {
      const ids = plan.steps.map((s) => s.id);
      assert.ok(ids.every((id) => typeof id === 'string' && /^[a-z0-9-]+$/.test(id)), `${track} ${level}`);
      assert.equal(new Set(ids).size, ids.length, `${track} ${level}`);
    }
  }
});

test('a level test reopens LEVEL_RETAKE_DAYS after the last attempt', () => {
  assert.equal(levelRetakeAt(null), null);
  const at = '2026-11-10T09:00:00.000Z';
  const reopens = levelRetakeAt(at);
  assert.equal(reopens.getTime() - new Date(at).getTime(), LEVEL_RETAKE_DAYS * 24 * 60 * 60 * 1000);
  assert.equal(levelRetakeAt(at, 3).toISOString(), '2026-11-13T09:00:00.000Z');
});
