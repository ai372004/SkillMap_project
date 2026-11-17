// The demo opens with a supervisor account and ten students spread along the
// journey, so every screen (including the supervisor's) has something to show.
// Answers are picked to steer each student to a track and a level, then scored
// by the server's own scoring code.
import { TRACK_IDS, TRACK_QUIZ, getTrackContent, isTrack } from './content.js';
import { scoreLevelTest, scoreTrackQuiz } from '../../server/src/services/scoring.js';

export const DEMO_ADMIN = { email: 'admin@masar.test', password: 'admin1234' };
export const DEMO_STUDENT = { email: 'omar@example.com', password: 'student123' };

const DAY = 24 * 60 * 60 * 1000;
const STAGES = ['registered', 'quiz', 'level', 'plan', 'submitted', 'revision', 'approved'];

// name, email, how far they got, aimed track, how well they do in the level test (0–1), days since last visit
const STUDENTS = [
  ['عمر خالد', 'omar@example.com', 'approved', 'frontend', 0.6, 0],
  ['مريم حسن', 'mariam@example.com', 'submitted', 'uiux', 0.4, 0],
  ['يوسف إبراهيم', 'youssef@example.com', 'plan', 'backend', 0.75, 2],
  ['نور الهدى علي', 'nour@example.com', 'level', 'data', 0.5, 3],
  ['كريم مصطفى', 'karim@example.com', 'quiz', 'data', 0, 11],
  ['سلمى عادل', 'salma@example.com', 'quiz', 'uiux', 0, 4],
  ['أحمد طارق', 'ahmed.t@example.com', 'registered', null, 0, 13],
  ['هنا محمود', 'hana@example.com', 'level', 'frontend', 0.3, 9],
  ['ليلى سامي', 'laila@example.com', 'revision', 'backend', 0.45, 2],
  ['زياد وليد', 'ziad@example.com', 'registered', null, 0, 0],
];

const iso = (ms) => new Date(ms).toISOString();

// The option on each question that gives the most points to `track`.
function quizAnswersFor(track) {
  return Object.fromEntries(
    TRACK_QUIZ.questions.map((q) => {
      const best = [...q.options].sort((a, b) => (b.points?.[track] || 0) - (a.points?.[track] || 0))[0];
      return [q.id, best.id];
    })
  );
}

// Right answers on roughly `skill` of the questions, spread across the test.
function levelAnswersFor(track, skill) {
  return Object.fromEntries(
    getTrackContent(track).levelTest.map((q, i) => {
      const right = (i * 7) % 10 < skill * 10;
      const wrong = q.options.find((o) => o.id !== q.answer);
      return [q.id, right ? q.answer : wrong.id];
    })
  );
}

export function seedDemo() {
  const db = { version: 1, seq: 0, users: [], trackResults: [], levelResults: [], submissions: [] };
  const id = () => `s${(db.seq += 1).toString(36)}`;
  const start = Date.now() - 20 * DAY;

  const admin = {
    id: id(),
    name: 'المشرف',
    email: DEMO_ADMIN.email,
    password: DEMO_ADMIN.password,
    role: 'admin',
    university: '',
    academicYear: '',
    recommendedTrack: null,
    chosenTrack: null,
    tokenVersion: 0,
    mustChangePassword: false,
    lastSeenAt: null,
    planDone: [],
    createdAt: iso(start),
    updatedAt: iso(start),
  };
  db.users.push(admin);

  STUDENTS.forEach(([name, email, stage, track, skill, idleDays], n) => {
    const reached = (s) => STAGES.indexOf(stage) >= STAGES.indexOf(s);
    const lastSeen = Date.now() - idleDays * DAY - n * 60 * 60 * 1000;
    let t = Math.min(lastSeen - 2 * DAY, start + n * DAY); // each step happens a little after the previous one
    const step = () => iso((t += 3 * 60 * 60 * 1000));
    const userId = id();
    const user = {
      id: userId,
      name,
      email,
      password: 'student123',
      role: 'student',
      university: 'جامعة الإسكندرية',
      academicYear: ['الأولى', 'الثانية', 'الثالثة', 'الرابعة'][n % 4],
      recommendedTrack: null,
      chosenTrack: null,
      tokenVersion: 0,
      mustChangePassword: false,
      lastSeenAt: iso(lastSeen),
      planDone: [],
      createdAt: iso(t),
      updatedAt: iso(t),
    };
    db.users.push(user);
    if (!reached('quiz')) return;

    const quiz = scoreTrackQuiz(quizAnswersFor(isTrack(track) ? track : TRACK_IDS[0]));
    const quizAt = step();
    db.trackResults.push({ id: id(), user: userId, ...quiz, createdAt: quizAt, updatedAt: quizAt });
    user.recommendedTrack = quiz.recommendedTrack;
    user.chosenTrack = quiz.recommendedTrack;
    if (!reached('level')) return;

    const chosen = user.chosenTrack;
    const { review: _review, ...level } = scoreLevelTest(chosen, levelAnswersFor(chosen, skill));
    const levelAt = step();
    db.levelResults.push({ id: id(), user: userId, track: chosen, ...level, createdAt: levelAt, updatedAt: levelAt });
    if (!reached('plan')) return;

    const content = getTrackContent(chosen);
    const steps = content.plans[level.level].steps;
    user.planDone = steps.slice(0, stage === 'approved' ? 3 : 2).map((s) => `${chosen}:${level.level}:${s.id}`);
    if (!reached('submitted')) return;

    const task = content.tasks.find((x) => x.level === level.level);
    const sentAt = step();
    const submission = {
      id: id(),
      user: userId,
      taskId: task.id,
      track: chosen,
      level: task.level,
      link: `https://github.com/${email.split('@')[0]}/${task.id}`,
      notes: '',
      status: 'pending',
      feedback: '',
      reviewedBy: null,
      reviewedAt: null,
      seenByStudent: true,
      createdAt: sentAt,
      updatedAt: sentAt,
    };
    db.submissions.push(submission);
    if (stage === 'revision' || stage === 'approved') {
      const reviewedAt = step();
      Object.assign(submission, {
        status: stage === 'approved' ? 'approved' : 'needs_revision',
        feedback:
          stage === 'approved'
            ? 'عمل ممتاز، الصفحة واضحة ومنظمة.'
            : 'أضف ملف README يشرح طريقة التشغيل ثم أعد التسليم.',
        reviewedBy: admin.id,
        reviewedAt,
        updatedAt: reviewedAt,
      });
    }
  });

  return db;
}
