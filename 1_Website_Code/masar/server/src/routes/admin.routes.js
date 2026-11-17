// Admin dashboard: statistics, students, and reviewing task submissions.
import { Router } from 'express';
import { randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { TrackResult } from '../models/TrackResult.js';
import { LevelResult } from '../models/LevelResult.js';
import { Submission, SUBMISSION_STATUSES } from '../models/Submission.js';
import { TRACK_IDS, TRACKS, isTrack } from '../content/index.js';
import { computeBadges } from '../services/badges.js';
import { planSummary } from '../services/plan.js';
import { toCsv } from '../utils/csv.js';
import { badRequest, notFound } from '../utils/httpError.js';

const router = Router();
router.use(requireAuth, requireAdmin);

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// A student "has gone quiet" when they haven't used the platform for a week
// and have no approved task yet (finished students are not chased).
async function quietFilter() {
  const weekAgo = new Date(Date.now() - WEEK_MS);
  const finished = await Submission.distinct('user', { status: 'approved' });
  return {
    role: 'student',
    _id: { $nin: finished },
    $or: [{ lastSeenAt: { $lt: weekAgo } }, { lastSeenAt: null, createdAt: { $lt: weekAgo } }],
  };
}

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Latest level result for each (student, track) pair.
async function latestLevels(filter = {}) {
  const results = await LevelResult.find(filter).sort({ createdAt: -1 }).select('-answers');
  const latest = new Map();
  for (const r of results) {
    const key = `${r.user}:${r.track}`;
    if (!latest.has(key)) latest.set(key, r);
  }
  return [...latest.values()];
}

const zeroByTrack = () => Object.fromEntries(TRACK_IDS.map((t) => [t, 0]));

router.get('/stats', async (_req, res) => {
  const weekAgo = new Date(Date.now() - WEEK_MS);
  const [students, trackQuizzes, levelTests, submissions, levels, quizUsers, levelUsers, quiet] = await Promise.all([
    User.find({ role: 'student' }).select('recommendedTrack chosenTrack createdAt'),
    TrackResult.countDocuments(),
    LevelResult.countDocuments(),
    Submission.find().select('status track user'),
    latestLevels(),
    TrackResult.distinct('user'),
    LevelResult.distinct('user'),
    quietFilter().then((f) => User.countDocuments(f)),
  ]);

  // How many students reached each station of the journey, to show where they stop.
  const studentIds = new Set(students.map((s) => s._id.toString()));
  const reached = (ids) => new Set(ids.map(String).filter((id) => studentIds.has(id))).size;
  const funnel = {
    registered: students.length,
    trackQuiz: reached(quizUsers),
    levelTest: reached(levelUsers),
    submitted: reached(submissions.map((s) => s.user)),
    approved: reached(submissions.filter((s) => s.status === 'approved').map((s) => s.user)),
  };

  const recommended = zeroByTrack();
  const chosen = zeroByTrack();
  for (const s of students) {
    if (s.recommendedTrack) recommended[s.recommendedTrack] += 1;
    if (s.chosenTrack) chosen[s.chosenTrack] += 1;
  }

  const levelsByTrack = Object.fromEntries(TRACK_IDS.map((t) => [t, { beginner: 0, intermediate: 0, advanced: 0 }]));
  for (const r of levels) levelsByTrack[r.track][r.level] += 1;

  const submissionsByStatus = Object.fromEntries(SUBMISSION_STATUSES.map((s) => [s, 0]));
  for (const s of submissions) submissionsByStatus[s.status] += 1;

  res.json({
    students: students.length,
    newThisWeek: students.filter((s) => s.createdAt >= weekAgo).length,
    trackQuizzes,
    levelTests,
    recommended,
    chosen,
    levelsByTrack,
    submissions: { total: submissions.length, ...submissionsByStatus },
    funnel,
    quiet,
  });
});

// ?page=1&pageSize=20 on list routes; pageSize is capped so one request stays small.
function paging(query) {
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(query.pageSize, 10) || 20));
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  return { page, pageSize, skip: (page - 1) * pageSize };
}
const pageInfo = ({ page, pageSize }, total) => ({ page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) });

router.get('/students', async (req, res) => {
  const filter = { role: 'student' };
  const search = String(req.query.search || '').trim();
  if (search) {
    const re = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: re }, { email: re }];
  }
  if (req.query.track && isTrack(req.query.track)) filter.chosenTrack = req.query.track;
  if (req.query.quiet === '1') {
    // Kept in $and so it combines with the name/email search, which also uses $or.
    const quiet = await quietFilter();
    filter._id = quiet._id;
    filter.$and = [{ $or: quiet.$or }];
  }

  const pg = paging(req.query);
  const [students, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(pg.skip).limit(pg.pageSize),
    User.countDocuments(filter),
  ]);
  const ids = students.map((s) => s._id);
  const [levels, submissions] = await Promise.all([
    latestLevels({ user: { $in: ids } }),
    Submission.find({ user: { $in: ids } }).select('user status'),
  ]);

  const rows = students.map((s) => {
    const id = s._id.toString();
    const level = levels.find((r) => r.user.toString() === id && r.track === s.chosenTrack);
    const mine = submissions.filter((x) => x.user.toString() === id);
    return {
      ...s.toJSON(),
      level: level?.level || null,
      levelPercent: level?.percent ?? null,
      submissions: mine.length,
      approved: mine.filter((x) => x.status === 'approved').length,
    };
  });

  res.json({ students: rows, ...pageInfo(pg, total) });
});

router.get('/students/:id', async (req, res) => {
  const student = await User.findById(req.params.id);
  if (!student) throw notFound('UNKNOWN_STUDENT', 'Student not found');

  const [trackResults, levelResults, submissions] = await Promise.all([
    TrackResult.find({ user: student._id }).sort({ createdAt: -1 }).select('-answers'),
    LevelResult.find({ user: student._id }).sort({ createdAt: -1 }).select('-answers'),
    Submission.find({ user: student._id }).sort({ updatedAt: -1 }),
  ]);
  const latestByTrack = {};
  for (const r of levelResults) latestByTrack[r.track] ??= r;

  res.json({ student, trackResults, levelResults, submissions, plan: planSummary(student, latestByTrack, submissions) });
});

router.get('/submissions', async (req, res) => {
  const filter = {};
  if (SUBMISSION_STATUSES.includes(req.query.status)) filter.status = req.query.status;
  if (isTrack(req.query.track)) filter.track = req.query.track;

  const pg = paging(req.query);
  const [submissions, total] = await Promise.all([
    Submission.find(filter).sort({ updatedAt: -1 }).skip(pg.skip).limit(pg.pageSize).populate('user', 'name email'),
    Submission.countDocuments(filter),
  ]);
  res.json({ submissions, ...pageInfo(pg, total) });
});

router.patch('/submissions/:id', async (req, res) => {
  const status = req.body?.status;
  const feedback = String(req.body?.feedback || '').trim().slice(0, 1000);
  if (!SUBMISSION_STATUSES.includes(status)) throw badRequest('INVALID_STATUS', 'Invalid status');

  const submission = await Submission.findById(req.params.id);
  if (!submission) throw notFound('UNKNOWN_SUBMISSION', 'Submission not found');

  submission.status = status;
  submission.feedback = feedback;
  submission.reviewedBy = req.user._id;
  submission.reviewedAt = new Date();
  submission.seenByStudent = false;
  await submission.save();
  await submission.populate('user', 'name email');

  res.json({ submission });
});

// Reset a student's password when they forget it (there is no email service).
// Returns a one-time temporary password; the student is asked to change it after logging in.
const TEMP_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
function temporaryPassword(length = 10) {
  return Array.from({ length }, () => TEMP_ALPHABET[randomInt(TEMP_ALPHABET.length)]).join('');
}

router.post('/students/:id/reset-password', async (req, res) => {
  const student = await User.findById(req.params.id).select('+tokenVersion');
  if (!student || student.role !== 'student') throw notFound('UNKNOWN_STUDENT', 'Student not found');

  const password = temporaryPassword();
  student.passwordHash = await bcrypt.hash(password, 10);
  student.tokenVersion = (student.tokenVersion || 0) + 1;
  student.mustChangePassword = true;
  await student.save();

  res.json({ temporaryPassword: password, student });
});

// All students and their results as a CSV file that opens in Excel (Arabic or English headers).
const EXPORT_LABELS = {
  ar: {
    name: 'الاسم', email: 'البريد الإلكتروني', university: 'الجامعة', academicYear: 'السنة الدراسية', joined: 'تاريخ التسجيل', lastSeen: 'آخر نشاط',
    recommended: 'المسار المقترح', chosen: 'المسار المختار', level: 'المستوى في مساره', percent: 'نسبة اختبار المستوى',
    levelIn: (t) => `المستوى في ${t}`, submitted: 'مهام مسلّمة', approved: 'مهام معتمدة', pending: 'قيد المراجعة',
    needsRevision: 'تحتاج تعديلًا', badges: 'الشارات', levels: { beginner: 'مبتدئ', intermediate: 'متوسط', advanced: 'متقدم' },
  },
  en: {
    name: 'Name', email: 'Email', university: 'University', academicYear: 'Academic year', joined: 'Joined', lastSeen: 'Last active',
    recommended: 'Recommended track', chosen: 'Chosen track', level: 'Level in chosen track', percent: 'Level test %',
    levelIn: (t) => `Level in ${t}`, submitted: 'Tasks submitted', approved: 'Tasks approved', pending: 'Pending review',
    needsRevision: 'Needs revision', badges: 'Badges', levels: { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' },
  },
};

router.get('/export.csv', async (req, res) => {
  const lang = req.query.lang === 'en' ? 'en' : 'ar';
  const L = EXPORT_LABELS[lang];
  const trackName = (id) => (id ? TRACKS.find((t) => t.id === id)?.short[lang] || id : '');

  const students = await User.find({ role: 'student' }).sort({ createdAt: 1 });
  const ids = students.map((s) => s._id);
  const [levels, allLevels, trackResults, submissions] = await Promise.all([
    latestLevels({ user: { $in: ids } }),
    LevelResult.find({ user: { $in: ids } }).select('user createdAt'),
    TrackResult.find({ user: { $in: ids } }).select('user createdAt'),
    Submission.find({ user: { $in: ids } }).select('user status createdAt reviewedAt updatedAt'),
  ]);
  const of = (list, id) => list.filter((x) => x.user.toString() === id);

  const header = [L.name, L.email, L.university, L.academicYear, L.joined, L.lastSeen, L.recommended, L.chosen, L.level, L.percent,
    ...TRACK_IDS.map((t) => L.levelIn(trackName(t))), L.submitted, L.approved, L.pending, L.needsRevision, L.badges];

  const rows = students.map((s) => {
    const id = s._id.toString();
    const mine = of(levels, id);
    const current = mine.find((r) => r.track === s.chosenTrack);
    const subs = of(submissions, id);
    const count = (st) => subs.filter((x) => x.status === st).length;
    const earned = computeBadges({ trackResults: of(trackResults, id), levelResults: of(allLevels, id), submissions: subs }).filter((b) => b.earned).length;
    return [
      s.name, s.email, s.university || '', s.academicYear || '', s.createdAt.toISOString().slice(0, 10),
      s.lastSeenAt ? s.lastSeenAt.toISOString().slice(0, 10) : '',
      trackName(s.recommendedTrack), trackName(s.chosenTrack),
      current ? L.levels[current.level] : '', current ? current.percent : '',
      ...TRACK_IDS.map((t) => { const r = mine.find((x) => x.track === t); return r ? `${L.levels[r.level]} (${r.percent}%)` : ''; }),
      subs.length, count('approved'), count('pending'), count('needs_revision'), `${earned}/4`,
    ];
  });

  const date = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="masar-students-${date}.csv"`);
  res.send(toCsv([header, ...rows]));
});

export default router;
