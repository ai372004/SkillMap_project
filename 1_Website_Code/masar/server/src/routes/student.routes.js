// Everything a logged-in student does: quizzes, tests, tasks and plans.
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { TrackResult } from '../models/TrackResult.js';
import { User } from '../models/User.js';
import { LevelResult } from '../models/LevelResult.js';
import { Submission } from '../models/Submission.js';
import { findTask, getTrack, getTrackContent, isTrack, publicLevelTest } from '../content/index.js';
import { explainTrack, levelRetakeAt, scoreLevelTest, scoreTrackQuiz } from '../services/scoring.js';
import { HttpError, badRequest, notFound } from '../utils/httpError.js';
import { computeBadges } from '../services/badges.js';
import { planSummary } from '../services/plan.js';

const router = Router();
router.use(requireAuth);

function assertTrack(track) {
  if (!isTrack(track)) throw notFound('UNKNOWN_TRACK', 'Unknown track');
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// The four badges for one student. Only the first attempt of each kind matters,
// so the quiz and test lookups fetch a single date each.
async function badgesFor(userId, submissions) {
  const [firstTrackResult, firstLevelResult, subs] = await Promise.all([
    TrackResult.findOne({ user: userId }).sort({ createdAt: 1 }).select('createdAt'),
    LevelResult.findOne({ user: userId }).sort({ createdAt: 1 }).select('createdAt'),
    submissions ?? Submission.find({ user: userId }).select('createdAt status reviewedAt updatedAt'),
  ]);
  return computeBadges({
    trackResults: firstTrackResult ? [firstTrackResult] : [],
    levelResults: firstLevelResult ? [firstLevelResult] : [],
    submissions: subs,
  });
}

async function latestLevelResults(userId) {
  const results = await LevelResult.find({ user: userId }).sort({ createdAt: -1 }).select('-answers');
  const latest = {};
  for (const r of results) if (!latest[r.track]) latest[r.track] = r;
  return latest;
}

// ---- Track quiz ----

router.post('/track-quiz/submit', async (req, res) => {
  const result = scoreTrackQuiz(req.body?.answers);

  const saved = await TrackResult.create({ user: req.user._id, ...result });
  req.user.recommendedTrack = result.recommendedTrack;
  if (!req.user.chosenTrack) req.user.chosenTrack = result.recommendedTrack;
  await req.user.save();

  res.status(201).json({ result: withReasons(saved), user: req.user });
});

// A track result as the client sees it: the stored answers are replaced by
// the few that explain the recommendation.
function withReasons(doc) {
  if (!doc) return null;
  const { answers, ...rest } = doc.toJSON();
  return { ...rest, reasons: explainTrack(answers, rest.recommendedTrack) };
}

router.put('/me/track', async (req, res) => {
  const track = req.body?.track;
  assertTrack(track);
  req.user.chosenTrack = track;
  await req.user.save();
  res.json({ user: req.user });
});

// ---- Level test ----

// A level test can be retaken only after LEVEL_RETAKE_DAYS, checked both when
// the questions are opened and when answers are submitted.
async function assertCanTakeLevelTest(userId, track) {
  const last = await LevelResult.findOne({ user: userId, track }).sort({ createdAt: -1 }).select('createdAt');
  const retakeAt = levelRetakeAt(last?.createdAt);
  if (retakeAt && retakeAt > new Date()) {
    throw new HttpError(429, 'RETAKE_TOO_SOON', 'You can retake this level test later', { retakeAt });
  }
}

router.get('/tracks/:track/level-test', async (req, res) => {
  assertTrack(req.params.track);
  await assertCanTakeLevelTest(req.user._id, req.params.track);
  res.json({ track: getTrack(req.params.track), questions: publicLevelTest(req.params.track) });
});

router.post('/tracks/:track/level-test/submit', async (req, res) => {
  const { track } = req.params;
  assertTrack(track);
  await assertCanTakeLevelTest(req.user._id, track);
  const { review, ...result } = scoreLevelTest(track, req.body?.answers);

  const saved = await LevelResult.create({ user: req.user._id, track, ...result });
  res.status(201).json({ result: saved, review });
});

// ---- Tasks ----

router.get('/tracks/:track/tasks', async (req, res) => {
  const { track } = req.params;
  assertTrack(track);
  const submissions = await Submission.find({ user: req.user._id, track });
  const byTask = Object.fromEntries(submissions.map((s) => [s.taskId, s]));
  const tasks = getTrackContent(track).tasks.map((t) => ({ ...t, submission: byTask[t.id] || null }));
  res.json({ track: getTrack(track), tasks });
});

router.post('/tasks/:taskId/submissions', async (req, res) => {
  const task = findTask(req.params.taskId);
  if (!task) throw notFound('UNKNOWN_TASK', 'Unknown task');

  const link = String(req.body?.link || '').trim();
  const notes = String(req.body?.notes || '').trim().slice(0, 1000);
  if (!isHttpUrl(link) || link.length > 500) throw badRequest('INVALID_LINK', 'Please add a valid link that starts with http or https');

  const submission = await Submission.findOneAndUpdate(
    { user: req.user._id, taskId: task.id },
    {
      $set: { track: task.track, level: task.level, link, notes, status: 'pending', feedback: '', reviewedBy: null, reviewedAt: null, seenByStudent: true },
    },
    { upsert: true, new: true, runValidators: true }
  );

  res.status(201).json({ submission });
});

// ---- Supervisor replies the student hasn't opened yet ----

// Unseen supervisor replies, plus the earned badges so the app can celebrate
// a badge the moment it is earned (the app remembers which ones it has shown).
router.get('/me/notifications', async (req, res) => {
  const [unseen, badges] = await Promise.all([
    Submission.find({ user: req.user._id, seenByStudent: false })
      .sort({ reviewedAt: -1 })
      .select('taskId track status reviewedAt'),
    badgesFor(req.user._id),
  ]);
  res.json({
    unseenReviews: unseen.length,
    items: unseen,
    badges: badges.filter((b) => b.earned).map(({ id, earnedAt }) => ({ id, earnedAt })),
  });
});

router.post('/me/notifications/seen', async (req, res) => {
  await Submission.updateMany({ user: req.user._id, seenByStudent: false }, { $set: { seenByStudent: true } });
  res.json({ unseenReviews: 0 });
});

// ---- Progress and plan ----

router.get('/me/progress', async (req, res) => {
  const [trackResult, levels, submissions] = await Promise.all([
    TrackResult.findOne({ user: req.user._id }).sort({ createdAt: -1 }),
    latestLevelResults(req.user._id),
    Submission.find({ user: req.user._id }).sort({ updatedAt: -1 }),
  ]);

  const count = (status) => submissions.filter((s) => s.status === status).length;

  res.json({
    user: req.user,
    trackResult: withReasons(trackResult),
    levelResults: levels,
    submissions,
    plan: planSummary(req.user, levels, submissions),
    summary: {
      submitted: submissions.length,
      approved: count('approved'),
      pending: count('pending'),
      needsRevision: count('needs_revision'),
    },
    badges: await badgesFor(req.user._id, submissions),
  });
});

// The plan the student follows: their chosen track (or ?track=) at the level
// of their latest test in it. When a step is missing, `needs` says which one
// ('track' or 'level'); that is a normal state for a new student, not an error.
async function currentPlan(req) {
  const track = req.query.track || req.user.chosenTrack;
  if (!track) return { needs: 'track' };
  assertTrack(track);

  const levelResult = await LevelResult.findOne({ user: req.user._id, track }).sort({ createdAt: -1 }).select('-answers');
  if (!levelResult) return { needs: 'level', track };

  const content = getTrackContent(track);
  const plan = content.plans[levelResult.level];
  const prefix = `${track}:${levelResult.level}:`;
  const done = (req.user.planDone || []).filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length));
  return { track, levelResult, content, plan, prefix, done };
}

router.get('/me/plan', async (req, res) => {
  const current = await currentPlan(req);
  if (current.needs) return res.json({ needs: current.needs, track: current.track ? getTrack(current.track) : null });
  const { track, levelResult, content, plan, done } = current;
  const submissions = await Submission.find({ user: req.user._id, track });
  const byTask = Object.fromEntries(submissions.map((s) => [s.taskId, s]));

  res.json({
    track: getTrack(track),
    level: levelResult.level,
    levelResult,
    plan,
    done: plan.steps.map((s) => s.id).filter((id) => done.includes(id)),
    tasks: content.tasks.map((t) => ({ ...t, recommended: t.level === levelResult.level, submission: byTask[t.id] || null })),
    resources: content.resources,
  });
});

// Ticks a plan step on or off. Saved on the account, so it follows the student
// to any device; each track and level keeps its own ticks.
router.put('/me/plan/steps/:stepId', async (req, res) => {
  const { done } = req.body || {};
  if (typeof done !== 'boolean') throw badRequest('VALIDATION', 'done must be true or false');
  const current = await currentPlan(req);
  if (current.needs === 'track') throw badRequest('NO_TRACK', 'Take the track quiz or choose a track first');
  if (current.needs === 'level') throw badRequest('NO_LEVEL', 'Take the level test for this track first');
  const { plan, prefix } = current;
  if (!plan.steps.some((s) => s.id === req.params.stepId)) throw notFound('UNKNOWN_STEP', 'Unknown plan step');

  const key = prefix + req.params.stepId;
  await User.updateOne({ _id: req.user._id }, done ? { $addToSet: { planDone: key } } : { $pull: { planDone: key } });
  const user = await User.findById(req.user._id).select('planDone');
  const ids = user.planDone.filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length));
  res.json({ done: plan.steps.map((s) => s.id).filter((id) => ids.includes(id)) });
});

export default router;
