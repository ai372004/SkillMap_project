// The Masar API, running inside the browser for the offline demo.
//
// It answers the same routes as server/src/routes with the same JSON shapes
// and error codes, and it reuses the server's own scoring, badge, plan and CSV
// modules, so results match the real platform. Data is kept in this browser's
// localStorage only; nothing is sent anywhere. Passwords are stored as typed:
// this is a local demo, never a real deployment.
import {
  TRACKS,
  TRACK_IDS,
  findTask,
  getTrack,
  getTrackContent,
  isTrack,
  publicLevelTest,
  publicTrackQuiz,
} from './content.js';
import { explainTrack, levelRetakeAt, scoreLevelTest, scoreTrackQuiz, ScoringError } from '../../server/src/services/scoring.js';
import { computeBadges } from '../../server/src/services/badges.js';
import { planSummary } from '../../server/src/services/plan.js';
import { toCsv } from '../../server/src/utils/csv.js';
import { seedDemo } from './seed.js';

const VARIANT = [import.meta.env.VITE_DEMO_TRACKS, import.meta.env.VITE_DEMO_GUEST && 'guest'].filter(Boolean).join('.');
const STORAGE_KEY = `masar.demo.db${VARIANT ? `.${VARIANT}` : ''}`;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const SEEN_EVERY_MS = 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STATUSES = ['pending', 'approved', 'needs_revision'];

// ---------- storage ----------

let memory = null; // used when the browser blocks localStorage

function load() {
  if (memory) return memory;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved?.version === 1) return (memory = saved);
  } catch {
    /* fall through to a fresh demo */
  }
  memory = seedDemo();
  save();
  return memory;
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    /* storage full or blocked: the demo keeps working until the tab closes */
  }
}

export function resetDemo() {
  memory = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

const now = () => new Date().toISOString();
const newId = (db) => `d${(db.seq += 1).toString(36)}${Math.random().toString(36).slice(2, 8)}`;

// ---------- errors, shaped like server/src/middleware/errors.js ----------

class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message || code);
    Object.assign(this, { status, code, details });
  }
}
const badRequest = (code, message, details) => new HttpError(400, code, message, details);
const unauthorized = (code = 'UNAUTHORIZED', message = 'Please log in') => new HttpError(401, code, message);
const forbidden = () => new HttpError(403, 'ADMIN_ONLY', 'Admins only');
const notFound = (code = 'NOT_FOUND', message = 'Not found') => new HttpError(404, code, message);
const conflict = (code, message) => new HttpError(409, code, message);

// ---------- serialization, matching the models' toJSON ----------

function publicUser(u) {
  if (!u) return null;
  const { password: _p, tokenVersion: _v, planDone: _d, ...rest } = u;
  return rest;
}
const withoutAnswers = ({ answers: _a, ...rest }) => rest;
// A level result as the API sends it, with the date the test opens again.
const levelOut = (r) => ({ ...withoutAnswers(r), retakeAt: levelRetakeAt(r.createdAt) });
const tokenFor = (u) => `demo.${u.id}.${u.tokenVersion}`;

/** Session token of the built-in visitor, for the no-login demo (VITE_DEMO_GUEST). */
export function guestToken(email) {
  const user = load().users.find((u) => u.email === email);
  return user ? tokenFor(user) : null;
}

function withReasons(result) {
  if (!result) return null;
  const { answers, ...rest } = result;
  return { ...rest, reasons: explainTrack(answers, rest.recommendedTrack) };
}

// ---------- queries ----------

const byNewest = (field) => (a, b) => (a[field] < b[field] ? 1 : -1);
const mine = (list, userId) => list.filter((x) => x.user === userId);

function latestLevels(db, userId) {
  const latest = {};
  for (const r of mine(db.levelResults, userId).sort(byNewest('createdAt'))) latest[r.track] ??= levelOut(r);
  return latest;
}

function badgesFor(db, userId) {
  return computeBadges({
    trackResults: mine(db.trackResults, userId),
    levelResults: mine(db.levelResults, userId),
    submissions: mine(db.submissions, userId),
  });
}

function isQuiet(db, user, approvedUsers) {
  const last = new Date(user.lastSeenAt || user.createdAt).getTime();
  return user.role === 'student' && !approvedUsers.has(user.id) && Date.now() - last > WEEK_MS;
}

const approvedSet = (db) => new Set(db.submissions.filter((s) => s.status === 'approved').map((s) => s.user));

function paging(query) {
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(query.get('pageSize'), 10) || 20));
  const page = Math.max(1, Number.parseInt(query.get('page'), 10) || 1);
  return { page, pageSize, skip: (page - 1) * pageSize };
}
const pageInfo = ({ page, pageSize }, total) => ({
  page,
  pageSize,
  total,
  pages: Math.max(1, Math.ceil(total / pageSize)),
});

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function currentPlan(db, user, query) {
  const track = query.get('track') || user.chosenTrack;
  if (!track) return { needs: 'track' };
  if (!isTrack(track)) throw notFound('UNKNOWN_TRACK', 'Unknown track');
  const levelResult = latestLevels(db, user.id)[track];
  if (!levelResult) return { needs: 'level', track };
  const content = getTrackContent(track);
  const plan = content.plans[levelResult.level];
  const prefix = `${track}:${levelResult.level}:`;
  const done = (user.planDone || []).filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length));
  return { track, levelResult, content, plan, prefix, done };
}

// ---------- routes ----------

const routes = [];
const route = (method, pattern, handler, access = 'public') => {
  const keys = [];
  const re = new RegExp(`^${pattern.replace(/:(\w+)/g, (_m, k) => (keys.push(k), '([^/]+)'))}$`);
  routes.push({ method, re, keys, handler, access });
};

// Auth
route('POST', '/auth/register', ({ db, body }) => {
  const name = String(body?.name || '').trim();
  const email = String(body?.email || '')
    .trim()
    .toLowerCase();
  const password = String(body?.password || '');
  const fields = [];
  if (name.length < 2 || name.length > 80) fields.push('name');
  if (!EMAIL_RE.test(email) || email.length > 120) fields.push('email');
  if (password.length < 8 || password.length > 72) fields.push('password');
  if (fields.length) throw badRequest('VALIDATION', 'Invalid data', { fields });
  if (db.users.some((u) => u.email === email)) throw conflict('EMAIL_TAKEN', 'This email is already registered');

  const at = now();
  const user = {
    id: newId(db),
    name,
    email,
    password,
    role: 'student',
    university: String(body?.university || '').trim(),
    academicYear: String(body?.academicYear || '').trim(),
    recommendedTrack: null,
    chosenTrack: null,
    tokenVersion: 0,
    mustChangePassword: false,
    lastSeenAt: at,
    planDone: [],
    createdAt: at,
    updatedAt: at,
  };
  db.users.push(user);
  return [201, { token: tokenFor(user), user: publicUser(user) }];
});

route('POST', '/auth/login', ({ db, body }) => {
  const email = String(body?.email || '')
    .trim()
    .toLowerCase();
  const password = String(body?.password || '');
  if (!email || !password)
    throw badRequest('VALIDATION', 'Email and password are required', { fields: ['email', 'password'] });
  const user = db.users.find((u) => u.email === email);
  if (!user || user.password !== password) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Wrong email or password');
  user.lastSeenAt = now();
  return { token: tokenFor(user), user: publicUser(user) };
});

route('GET', '/auth/me', ({ user }) => ({ user: publicUser(user) }), 'user');

route(
  'PATCH',
  '/auth/me',
  ({ user, body }) => {
    const name = String(body?.name ?? user.name).trim();
    const university = String(body?.university ?? user.university ?? '').trim();
    const academicYear = String(body?.academicYear ?? user.academicYear ?? '').trim();
    const fields = [];
    if (name.length < 2 || name.length > 80) fields.push('name');
    if (university.length > 120) fields.push('university');
    if (academicYear.length > 40) fields.push('academicYear');
    if (fields.length) throw badRequest('VALIDATION', 'Invalid data', { fields });
    Object.assign(user, { name, university, academicYear, updatedAt: now() });
    return { user: publicUser(user) };
  },
  'user'
);

route(
  'POST',
  '/auth/change-password',
  ({ user, body }) => {
    const currentPassword = String(body?.currentPassword || '');
    const newPassword = String(body?.newPassword || '');
    if (newPassword.length < 8 || newPassword.length > 72)
      throw badRequest('VALIDATION', 'Invalid data', { fields: ['newPassword'] });
    if (currentPassword !== user.password)
      throw badRequest('WRONG_PASSWORD', 'Current password is wrong', { fields: ['currentPassword'] });
    if (newPassword === user.password) {
      throw badRequest('SAME_PASSWORD', 'Choose a password different from the current one', {
        fields: ['newPassword'],
      });
    }
    Object.assign(user, {
      password: newPassword,
      tokenVersion: user.tokenVersion + 1,
      mustChangePassword: false,
      updatedAt: now(),
    });
    return { token: tokenFor(user), user: publicUser(user) };
  },
  'user'
);

// Public content
route('GET', '/tracks', () => ({ tracks: TRACKS }));
route('GET', '/track-quiz', () => publicTrackQuiz());
route('GET', '/tracks/:track/resources', ({ params }) => {
  if (!isTrack(params.track)) throw notFound('UNKNOWN_TRACK', 'Unknown track');
  return { resources: getTrackContent(params.track).resources };
});

// Student
route(
  'POST',
  '/track-quiz/submit',
  ({ db, user, body }) => {
    const result = scoreTrackQuiz(body?.answers);
    const at = now();
    const saved = { id: newId(db), user: user.id, ...result, createdAt: at, updatedAt: at };
    db.trackResults.push(saved);
    user.recommendedTrack = result.recommendedTrack;
    user.chosenTrack ||= result.recommendedTrack;
    return [201, { result: withReasons(saved), user: publicUser(user) }];
  },
  'user'
);

route(
  'PUT',
  '/me/track',
  ({ user, body }) => {
    if (!isTrack(body?.track)) throw notFound('UNKNOWN_TRACK', 'Unknown track');
    user.chosenTrack = body.track;
    return { user: publicUser(user) };
  },
  'user'
);

// Same rule as the server: a level test reopens LEVEL_RETAKE_DAYS after the last attempt.
function assertCanTakeLevelTest(db, user, track) {
  const last = mine(db.levelResults, user.id)
    .filter((r) => r.track === track)
    .sort(byNewest('createdAt'))[0];
  const retakeAt = levelRetakeAt(last?.createdAt);
  if (retakeAt && retakeAt > new Date()) {
    throw new HttpError(429, 'RETAKE_TOO_SOON', 'You can retake this level test later', { retakeAt });
  }
}

route(
  'GET',
  '/tracks/:track/level-test',
  ({ db, user, params }) => {
    if (!isTrack(params.track)) throw notFound('UNKNOWN_TRACK', 'Unknown track');
    assertCanTakeLevelTest(db, user, params.track);
    return { track: getTrack(params.track), questions: publicLevelTest(params.track) };
  },
  'user'
);

route(
  'POST',
  '/tracks/:track/level-test/submit',
  ({ db, user, params, body }) => {
    if (!isTrack(params.track)) throw notFound('UNKNOWN_TRACK', 'Unknown track');
    assertCanTakeLevelTest(db, user, params.track);
    const { review, ...result } = scoreLevelTest(params.track, body?.answers);
    const at = now();
    const saved = { id: newId(db), user: user.id, track: params.track, ...result, createdAt: at, updatedAt: at };
    db.levelResults.push(saved);
    return [201, { result: levelOut(saved), review }];
  },
  'user'
);

route(
  'GET',
  '/tracks/:track/tasks',
  ({ db, user, params }) => {
    if (!isTrack(params.track)) throw notFound('UNKNOWN_TRACK', 'Unknown track');
    const byTask = Object.fromEntries(mine(db.submissions, user.id).map((s) => [s.taskId, s]));
    const tasks = getTrackContent(params.track).tasks.map((t) => ({ ...t, submission: byTask[t.id] || null }));
    return { track: getTrack(params.track), tasks };
  },
  'user'
);

route(
  'POST',
  '/tasks/:taskId/submissions',
  ({ db, user, params, body }) => {
    const task = findTask(params.taskId);
    if (!task) throw notFound('UNKNOWN_TASK', 'Unknown task');
    const link = String(body?.link || '').trim();
    const notes = String(body?.notes || '')
      .trim()
      .slice(0, 1000);
    if (!isHttpUrl(link) || link.length > 500)
      throw badRequest('INVALID_LINK', 'Please add a valid link that starts with http or https');

    const at = now();
    let submission = db.submissions.find((s) => s.user === user.id && s.taskId === task.id);
    if (!submission) {
      submission = { id: newId(db), user: user.id, taskId: task.id, createdAt: at };
      db.submissions.push(submission);
    }
    Object.assign(submission, {
      track: task.track,
      level: task.level,
      link,
      notes,
      status: 'pending',
      feedback: '',
      reviewedBy: null,
      reviewedAt: null,
      seenByStudent: true,
      updatedAt: at,
    });
    return [201, { submission }];
  },
  'user'
);

route(
  'GET',
  '/me/notifications',
  ({ db, user }) => {
    const unseen = mine(db.submissions, user.id)
      .filter((s) => s.seenByStudent === false)
      .sort(byNewest('reviewedAt'))
      .map(({ id, taskId, track, status, reviewedAt }) => ({ id, taskId, track, status, reviewedAt }));
    return {
      unseenReviews: unseen.length,
      items: unseen,
      badges: badgesFor(db, user.id)
        .filter((b) => b.earned)
        .map(({ id, earnedAt }) => ({ id, earnedAt })),
    };
  },
  'user'
);

route(
  'POST',
  '/me/notifications/seen',
  ({ db, user }) => {
    for (const s of mine(db.submissions, user.id)) s.seenByStudent = true;
    return { unseenReviews: 0 };
  },
  'user'
);

route(
  'GET',
  '/me/progress',
  ({ db, user }) => {
    const trackResult = mine(db.trackResults, user.id).sort(byNewest('createdAt'))[0] || null;
    const levels = latestLevels(db, user.id);
    const submissions = mine(db.submissions, user.id).sort(byNewest('updatedAt'));
    const count = (status) => submissions.filter((s) => s.status === status).length;
    return {
      user: publicUser(user),
      trackResult: withReasons(trackResult),
      levelResults: levels,
      submissions,
      plan: planSummary(user, levels, submissions),
      summary: {
        submitted: submissions.length,
        approved: count('approved'),
        pending: count('pending'),
        needsRevision: count('needs_revision'),
      },
      badges: badgesFor(db, user.id),
    };
  },
  'user'
);

route(
  'GET',
  '/me/plan',
  ({ db, user, query }) => {
    const current = currentPlan(db, user, query);
    if (current.needs) return { needs: current.needs, track: current.track ? getTrack(current.track) : null };
    const { track, levelResult, content, plan, done } = current;
    const byTask = Object.fromEntries(
      mine(db.submissions, user.id)
        .filter((s) => s.track === track)
        .map((s) => [s.taskId, s])
    );
    return {
      track: getTrack(track),
      level: levelResult.level,
      levelResult,
      plan,
      done: plan.steps.map((s) => s.id).filter((id) => done.includes(id)),
      tasks: content.tasks.map((t) => ({
        ...t,
        recommended: t.level === levelResult.level,
        submission: byTask[t.id] || null,
      })),
      resources: content.resources,
    };
  },
  'user'
);

route(
  'PUT',
  '/me/plan/steps/:stepId',
  ({ db, user, params, body, query }) => {
    if (typeof body?.done !== 'boolean') throw badRequest('VALIDATION', 'done must be true or false');
    const current = currentPlan(db, user, query);
    if (current.needs === 'track') throw badRequest('NO_TRACK', 'Take the track quiz or choose a track first');
    if (current.needs === 'level') throw badRequest('NO_LEVEL', 'Take the level test for this track first');
    const { plan, prefix } = current;
    if (!plan.steps.some((s) => s.id === params.stepId)) throw notFound('UNKNOWN_STEP', 'Unknown plan step');
    const key = prefix + params.stepId;
    user.planDone = (user.planDone || []).filter((k) => k !== key);
    if (body.done) user.planDone.push(key);
    const ids = user.planDone.filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length));
    return { done: plan.steps.map((s) => s.id).filter((id) => ids.includes(id)) };
  },
  'user'
);

// Supervisor
route(
  'GET',
  '/admin/stats',
  ({ db }) => {
    const students = db.users.filter((u) => u.role === 'student');
    const ids = new Set(students.map((s) => s.id));
    const reached = (list) => new Set(list.map((x) => x.user).filter((id) => ids.has(id))).size;
    const approved = approvedSet(db);
    const weekAgo = Date.now() - WEEK_MS;

    const zero = () => Object.fromEntries(TRACK_IDS.map((t) => [t, 0]));
    const recommended = zero();
    const chosen = zero();
    for (const s of students) {
      if (s.recommendedTrack) recommended[s.recommendedTrack] += 1;
      if (s.chosenTrack) chosen[s.chosenTrack] += 1;
    }
    const levelsByTrack = Object.fromEntries(TRACK_IDS.map((t) => [t, { beginner: 0, intermediate: 0, advanced: 0 }]));
    for (const s of students)
      for (const r of Object.values(latestLevels(db, s.id))) levelsByTrack[r.track][r.level] += 1;
    const byStatus = Object.fromEntries(
      STATUSES.map((st) => [st, db.submissions.filter((s) => s.status === st).length])
    );

    return {
      students: students.length,
      newThisWeek: students.filter((s) => new Date(s.createdAt).getTime() >= weekAgo).length,
      trackQuizzes: db.trackResults.length,
      levelTests: db.levelResults.length,
      recommended,
      chosen,
      levelsByTrack,
      submissions: { total: db.submissions.length, ...byStatus },
      funnel: {
        registered: students.length,
        trackQuiz: reached(db.trackResults),
        levelTest: reached(db.levelResults),
        submitted: reached(db.submissions),
        approved: reached(db.submissions.filter((s) => s.status === 'approved')),
      },
      quiet: students.filter((s) => isQuiet(db, s, approved)).length,
    };
  },
  'admin'
);

route(
  'GET',
  '/admin/students',
  ({ db, query }) => {
    const search = String(query.get('search') || '')
      .trim()
      .toLowerCase();
    const track = query.get('track');
    const approved = approvedSet(db);
    const list = db.users
      .filter((u) => u.role === 'student')
      .filter((u) => !search || u.name.toLowerCase().includes(search) || u.email.includes(search))
      .filter((u) => !isTrack(track) || u.chosenTrack === track)
      .filter((u) => query.get('quiet') !== '1' || isQuiet(db, u, approved))
      .sort(byNewest('createdAt'));

    const pg = paging(query);
    const students = list.slice(pg.skip, pg.skip + pg.pageSize).map((s) => {
      const level = latestLevels(db, s.id)[s.chosenTrack];
      const subs = mine(db.submissions, s.id);
      return {
        ...publicUser(s),
        level: level?.level || null,
        levelPercent: level?.percent ?? null,
        submissions: subs.length,
        approved: subs.filter((x) => x.status === 'approved').length,
      };
    });
    return { students, ...pageInfo(pg, list.length) };
  },
  'admin'
);

route(
  'GET',
  '/admin/students/:id',
  ({ db, params }) => {
    const student = db.users.find((u) => u.id === params.id);
    if (!student) throw notFound('UNKNOWN_STUDENT', 'Student not found');
    const levels = mine(db.levelResults, student.id).sort(byNewest('createdAt')).map(levelOut);
    const submissions = mine(db.submissions, student.id).sort(byNewest('updatedAt'));
    return {
      student: publicUser(student),
      trackResults: mine(db.trackResults, student.id).sort(byNewest('createdAt')).map(withoutAnswers),
      levelResults: levels,
      submissions,
      plan: planSummary(student, latestLevels(db, student.id), submissions),
    };
  },
  'admin'
);

const withAuthor = (db, s) => {
  const u = db.users.find((x) => x.id === s.user);
  return { ...s, user: u ? { id: u.id, name: u.name, email: u.email } : null };
};

route(
  'GET',
  '/admin/submissions',
  ({ db, query }) => {
    const status = query.get('status');
    const track = query.get('track');
    const list = db.submissions
      .filter((s) => !STATUSES.includes(status) || s.status === status)
      .filter((s) => !isTrack(track) || s.track === track)
      .sort(byNewest('updatedAt'));
    const pg = paging(query);
    return {
      submissions: list.slice(pg.skip, pg.skip + pg.pageSize).map((s) => withAuthor(db, s)),
      ...pageInfo(pg, list.length),
    };
  },
  'admin'
);

route(
  'PATCH',
  '/admin/submissions/:id',
  ({ db, user, params, body }) => {
    if (!STATUSES.includes(body?.status)) throw badRequest('INVALID_STATUS', 'Invalid status');
    const submission = db.submissions.find((s) => s.id === params.id);
    if (!submission) throw notFound('UNKNOWN_SUBMISSION', 'Submission not found');
    const at = now();
    Object.assign(submission, {
      status: body.status,
      feedback: String(body?.feedback || '')
        .trim()
        .slice(0, 1000),
      reviewedBy: user.id,
      reviewedAt: at,
      seenByStudent: false,
      updatedAt: at,
    });
    return { submission: withAuthor(db, submission) };
  },
  'admin'
);

const TEMP_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
route(
  'POST',
  '/admin/students/:id/reset-password',
  ({ db, params }) => {
    const student = db.users.find((u) => u.id === params.id && u.role === 'student');
    if (!student) throw notFound('UNKNOWN_STUDENT', 'Student not found');
    const values = crypto.getRandomValues(new Uint32Array(10));
    const password = Array.from(values, (v) => TEMP_ALPHABET[v % TEMP_ALPHABET.length]).join('');
    Object.assign(student, {
      password,
      tokenVersion: student.tokenVersion + 1,
      mustChangePassword: true,
      updatedAt: now(),
    });
    return { temporaryPassword: password, student: publicUser(student) };
  },
  'admin'
);

// Same columns and labels as server/src/routes/admin.routes.js.
const EXPORT_LABELS = {
  ar: {
    name: 'الاسم',
    email: 'البريد الإلكتروني',
    university: 'الجامعة',
    academicYear: 'السنة الدراسية',
    joined: 'تاريخ التسجيل',
    lastSeen: 'آخر نشاط',
    recommended: 'المسار المقترح',
    chosen: 'المسار المختار',
    level: 'المستوى في مساره',
    percent: 'نسبة اختبار المستوى',
    levelIn: (t) => `المستوى في ${t}`,
    submitted: 'مهام مسلّمة',
    approved: 'مهام معتمدة',
    pending: 'قيد المراجعة',
    needsRevision: 'تحتاج تعديلًا',
    badges: 'الشارات',
    levels: { beginner: 'مبتدئ', intermediate: 'متوسط', advanced: 'متقدم' },
  },
  en: {
    name: 'Name',
    email: 'Email',
    university: 'University',
    academicYear: 'Academic year',
    joined: 'Joined',
    lastSeen: 'Last active',
    recommended: 'Recommended track',
    chosen: 'Chosen track',
    level: 'Level in chosen track',
    percent: 'Level test %',
    levelIn: (t) => `Level in ${t}`,
    submitted: 'Tasks submitted',
    approved: 'Tasks approved',
    pending: 'Pending review',
    needsRevision: 'Needs revision',
    badges: 'Badges',
    levels: { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' },
  },
};

route(
  'GET',
  '/admin/export.csv',
  ({ db, query }) => {
    const lang = query.get('lang') === 'en' ? 'en' : 'ar';
    const L = EXPORT_LABELS[lang];
    const trackName = (id) => (id ? TRACKS.find((t) => t.id === id)?.short[lang] || id : '');
    const day = (iso) => (iso ? iso.slice(0, 10) : '');
    const header = [
      L.name,
      L.email,
      L.university,
      L.academicYear,
      L.joined,
      L.lastSeen,
      L.recommended,
      L.chosen,
      L.level,
      L.percent,
      ...TRACK_IDS.map((t) => L.levelIn(trackName(t))),
      L.submitted,
      L.approved,
      L.pending,
      L.needsRevision,
      L.badges,
    ];
    const rows = db.users
      .filter((u) => u.role === 'student')
      .sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1))
      .map((s) => {
        const levels = latestLevels(db, s.id);
        const current = levels[s.chosenTrack];
        const subs = mine(db.submissions, s.id);
        const count = (st) => subs.filter((x) => x.status === st).length;
        const earned = badgesFor(db, s.id).filter((b) => b.earned).length;
        return [
          s.name,
          s.email,
          s.university || '',
          s.academicYear || '',
          day(s.createdAt),
          day(s.lastSeenAt),
          trackName(s.recommendedTrack),
          trackName(s.chosenTrack),
          current ? L.levels[current.level] : '',
          current ? current.percent : '',
          ...TRACK_IDS.map((t) => (levels[t] ? `${L.levels[levels[t].level]} (${levels[t].percent}%)` : '')),
          subs.length,
          count('approved'),
          count('pending'),
          count('needs_revision'),
          `${earned}/4`,
        ];
      });
    return { csv: toCsv([header, ...rows]), filename: `masar-students-${now().slice(0, 10)}.csv` };
  },
  'admin'
);

// ---------- request handling ----------

function authenticate(db, headers) {
  const header = headers.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw unauthorized();
  const [, id, version] = token.split('.');
  const user = db.users.find((u) => u.id === id);
  if (!user || String(user.tokenVersion) !== version)
    throw unauthorized('INVALID_TOKEN', 'Session expired, please log in again');
  if (!user.lastSeenAt || Date.now() - new Date(user.lastSeenAt).getTime() > SEEN_EVERY_MS) user.lastSeenAt = now();
  return user;
}

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Answers one API request (path without the /api prefix) as a fetch Response. */
export function handle(method, path, headers, bodyText) {
  const url = new URL(path, 'http://demo.local');
  const found = routes.find((r) => r.method === method && r.re.test(url.pathname));
  if (!found) return json(404, { error: { code: 'NOT_FOUND', message: `No route for ${method} ${url.pathname}` } });

  const db = load();
  try {
    const params = Object.fromEntries(
      found.keys.map((k, i) => [k, decodeURIComponent(url.pathname.match(found.re)[i + 1])])
    );
    let body;
    try {
      body = bodyText ? JSON.parse(bodyText) : undefined;
    } catch {
      throw badRequest('INVALID_JSON', 'Request body is not valid JSON');
    }
    const user = found.access === 'public' ? null : authenticate(db, headers);
    if (found.access === 'admin' && user.role !== 'admin') throw forbidden();

    const out = found.handler({ db, user, params, body, query: url.searchParams });
    save();
    if (out?.csv !== undefined) {
      return new Response(out.csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${out.filename}"`,
        },
      });
    }
    const [status, payload] = Array.isArray(out) ? out : [200, out];
    return json(status, payload);
  } catch (err) {
    save();
    if (err instanceof HttpError)
      return json(err.status, { error: { code: err.code, message: err.message, details: err.details } });
    if (err instanceof ScoringError)
      return json(400, { error: { code: 'INCOMPLETE_ANSWERS', message: err.message, details: err.details } });
    console.error(err);
    return json(500, { error: { code: 'SERVER_ERROR', message: 'Something went wrong' } });
  }
}
