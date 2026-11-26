// API tests.
// Part 1 runs without a database.
// Part 2 (the full student and admin journey) runs only when MONGO_URI_TEST
// points to an empty test database, for example:
//   MONGO_URI_TEST=mongodb://127.0.0.1:27017/masar_test npm test
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';

process.env.JWT_SECRET ||= 'test-secret';
process.env.MONGO_URI ||= 'mongodb://127.0.0.1:27017/masar_test';
process.env.AUTH_RATE_LIMIT ||= '1000';

const { createApp } = await import('../src/app.js');
const { TRACK_QUIZ, getTrackContent } = await import('../src/content/index.js');
const { User } = await import('../src/models/User.js');

const app = createApp();

describe('without a database', () => {
  test('health and public content', async () => {
    const health = await request(app).get('/api/health').expect(200);
    assert.equal(health.body.ok, true);

    const tracks = await request(app).get('/api/tracks').expect(200);
    assert.equal(tracks.body.tracks.length, 4);

    const config = await request(app).get('/api/config').expect(200);
    assert.equal(config.body.levels.length, 3);
  });

  test('responses are compressed', async () => {
    const res = await request(app).get('/api/tracks').set('Accept-Encoding', 'gzip').expect(200);
    assert.equal(res.headers['content-encoding'], 'gzip');
  });

  test('track quiz does not reveal the points', async () => {
    const res = await request(app).get('/api/track-quiz').expect(200);
    assert.equal(res.body.questions.length, 15);
    for (const q of res.body.questions) for (const o of q.options) assert.equal(o.points, undefined);
  });

  test('student routes require login', async () => {
    await request(app).get('/api/tracks/data/level-test').expect(401);
    await request(app).get('/api/me/progress').expect(401);
    await request(app).get('/api/admin/stats').expect(401);
    await request(app).get('/api/me/progress').set('Authorization', 'Bearer not-a-token').expect(401);
  });

  test('register and login validate input before touching the database', async () => {
    const bad = await request(app).post('/api/auth/register').send({ name: 'A', email: 'nope', password: '123' }).expect(400);
    assert.deepEqual(bad.body.error.details.fields.sort(), ['email', 'name', 'password']);
    await request(app).post('/api/auth/login').send({}).expect(400);
  });

  test('unknown resources', async () => {
    await request(app).get('/api/tracks/cooking/resources').expect(404);
  });
});

const TEST_DB = process.env.MONGO_URI_TEST;

describe('full journey with a database', { skip: !TEST_DB && 'set MONGO_URI_TEST to run' }, () => {
  before(async () => {
    await mongoose.connect(TEST_DB);
    await mongoose.connection.db.dropDatabase();
    await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).syncIndexes()));
  });

  after(async () => {
    await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
  });

  let studentToken;
  let adminToken;
  let submissionId;

  test('register, duplicate email, login', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Sara Test', email: 'Sara@Example.com', password: 'secret123' })
      .expect(201);
    assert.equal(reg.body.user.email, 'sara@example.com');
    assert.equal(reg.body.user.passwordHash, undefined);

    await request(app).post('/api/auth/register').send({ name: 'Sara', email: 'sara@example.com', password: 'secret123' }).expect(409);
    await request(app).post('/api/auth/login').send({ email: 'sara@example.com', password: 'wrong-pass' }).expect(401);

    const login = await request(app).post('/api/auth/login').send({ email: 'sara@example.com', password: 'secret123' }).expect(200);
    studentToken = login.body.token;
  });

  test('track quiz recommends a track and sets it as chosen', async () => {
    const answers = Object.fromEntries(TRACK_QUIZ.questions.map((q) => [q.id, q.options.find((o) => o.points.data === 3).id]));
    await request(app).post('/api/track-quiz/submit').set('Authorization', `Bearer ${studentToken}`).send({ answers: { tq1: 'a' } }).expect(400);

    const res = await request(app).post('/api/track-quiz/submit').set('Authorization', `Bearer ${studentToken}`).send({ answers }).expect(201);
    assert.equal(res.body.result.answers, undefined, 'raw answers stay on the server');
    assert.equal(res.body.result.reasons.length, 3);
    assert.equal(res.body.result.recommendedTrack, 'data');
    assert.equal(res.body.user.chosenTrack, 'data');
  });

  test('level test hides answers, then scores and returns a plan', async () => {
    const test1 = await request(app).get('/api/tracks/data/level-test').set('Authorization', `Bearer ${studentToken}`).expect(200);
    assert.equal(test1.body.questions.length, 15);
    for (const q of test1.body.questions) {
      assert.equal(q.answer, undefined);
      assert.equal(q.explain, undefined);
    }

    // Before the level test the plan says what is missing instead of failing.
    const early = await request(app).get('/api/me/plan').set('Authorization', `Bearer ${studentToken}`).expect(200);
    assert.equal(early.body.needs, 'level');
    assert.equal(early.body.track.id, 'data');
    await request(app).put('/api/me/plan/steps/s1').set('Authorization', `Bearer ${studentToken}`).send({ done: true }).expect(400);

    const questions = getTrackContent('data').levelTest;
    const answers = Object.fromEntries(questions.map((q) => [q.id, q.difficulty === 'hard' ? q.options.find((o) => o.id !== q.answer).id : q.answer]));
    const res = await request(app).post('/api/tracks/data/level-test/submit').set('Authorization', `Bearer ${studentToken}`).send({ answers }).expect(201);
    assert.equal(res.body.result.percent, 50);
    assert.equal(res.body.result.level, 'intermediate');
    assert.equal(res.body.review.length, 15);
    assert.ok(new Date(res.body.result.retakeAt) > new Date(), 'the result says when the test reopens');

    // Right after an attempt the test is locked: the review showed the answers.
    const locked = await request(app).get('/api/tracks/data/level-test').set('Authorization', `Bearer ${studentToken}`).expect(429);
    assert.equal(locked.body.error.code, 'RETAKE_TOO_SOON');
    assert.ok(locked.body.error.details.retakeAt);
    const resubmit = await request(app).post('/api/tracks/data/level-test/submit').set('Authorization', `Bearer ${studentToken}`).send({ answers }).expect(429);
    assert.equal(resubmit.body.error.code, 'RETAKE_TOO_SOON');

    const plan = await request(app).get('/api/me/plan').set('Authorization', `Bearer ${studentToken}`).expect(200);
    assert.equal(plan.body.level, 'intermediate');
    assert.equal(plan.body.tasks.filter((t) => t.recommended).length, 2);
    assert.deepEqual(plan.body.done, []);

    // Ticking plan steps is saved on the account, in plan order, and can be undone.
    const auth = { Authorization: `Bearer ${studentToken}` };
    const [first, second] = plan.body.plan.steps.map((s) => s.id);
    await request(app).put(`/api/me/plan/steps/${second}`).set(auth).send({ done: true }).expect(200);
    const ticked = await request(app).put(`/api/me/plan/steps/${first}`).set(auth).send({ done: true }).expect(200);
    assert.deepEqual(ticked.body.done, [first, second]);
    await request(app).put(`/api/me/plan/steps/${first}`).set(auth).send({ done: true }).expect(200);
    const untick = await request(app).put(`/api/me/plan/steps/${second}`).set(auth).send({ done: false }).expect(200);
    assert.deepEqual(untick.body.done, [first]);
    await request(app).put('/api/me/plan/steps/nope').set(auth).send({ done: true }).expect(404);
    await request(app).put(`/api/me/plan/steps/${first}`).set(auth).send({ done: 'yes' }).expect(400);
    const again = await request(app).get('/api/me/plan').set(auth).expect(200);
    assert.deepEqual(again.body.done, [first]);

    // The dashboard gets a short summary of the same plan and the next task to do.
    const summary = (await request(app).get('/api/me/progress').set(auth).expect(200)).body.plan;
    const levelTasks = getTrackContent('data').tasks.filter((t) => t.level === 'intermediate');
    assert.equal(summary.stepsDone, 1);
    assert.equal(summary.stepsTotal, plan.body.plan.steps.length);
    assert.equal(summary.tasksTotal, levelTasks.length);
    assert.equal(summary.nextTask.id, levelTasks[0].id);
    assert.equal(summary.nextTask.status, null);
    const me = await request(app).get('/api/auth/me').set(auth).expect(200);
    assert.equal(me.body.user.planDone, undefined);
  });

  test('task submission and resubmission', async () => {
    await request(app).post('/api/tasks/da-t3/submissions').set('Authorization', `Bearer ${studentToken}`).send({ link: 'not a link' }).expect(400);
    await request(app).post('/api/tasks/nope/submissions').set('Authorization', `Bearer ${studentToken}`).send({ link: 'https://x.com' }).expect(404);

    const first = await request(app)
      .post('/api/tasks/da-t3/submissions')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ link: 'https://colab.research.google.com/drive/abc', notes: 'first try' })
      .expect(201);
    submissionId = first.body.submission.id;

    const again = await request(app)
      .post('/api/tasks/da-t3/submissions')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ link: 'https://github.com/sara/eda' })
      .expect(201);
    assert.equal(again.body.submission.id, submissionId);
    assert.equal(again.body.submission.link, 'https://github.com/sara/eda');
  });

  test('students cannot open admin routes', async () => {
    await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${studentToken}`).expect(403);
  });

  test('admin sees stats and reviews a submission', async () => {
    await request(app).post('/api/auth/register').send({ name: 'Admin', email: 'admin@example.com', password: 'adminpass1' }).expect(201);
    await User.updateOne({ email: 'admin@example.com' }, { role: 'admin' });
    const login = await request(app).post('/api/auth/login').send({ email: 'admin@example.com', password: 'adminpass1' }).expect(200);
    adminToken = login.body.token;

    const stats = await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${adminToken}`).expect(200);
    assert.equal(stats.body.students, 1);
    assert.equal(stats.body.recommended.data, 1);
    assert.equal(stats.body.levelsByTrack.data.intermediate, 1);
    assert.equal(stats.body.submissions.pending, 1);
    // Where students are on the journey: Sara has submitted but nothing is approved yet.
    assert.deepEqual(stats.body.funnel, { registered: 1, trackQuiz: 1, levelTest: 1, submitted: 1, approved: 0 });
    assert.equal(stats.body.quiet, 0);

    const list = await request(app).get('/api/admin/students?search=sara').set('Authorization', `Bearer ${adminToken}`).expect(200);
    assert.equal(list.body.students.length, 1);
    assert.deepEqual([list.body.page, list.body.total, list.body.pages], [1, 1, 1]);
    const empty = await request(app).get('/api/admin/students?page=2&pageSize=1').set('Authorization', `Bearer ${adminToken}`).expect(200);
    assert.equal(empty.body.students.length, 0);
    assert.equal(empty.body.pages, 1);
    assert.equal(list.body.students[0].level, 'intermediate');
    assert.ok(Date.parse(list.body.students[0].lastSeenAt), 'last activity is recorded');

    // The supervisor sees the student's plan progress and next task.
    const details = await request(app).get(`/api/admin/students/${list.body.students[0].id}`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    assert.equal(details.body.plan.stepsDone, 1);
    assert.equal(details.body.plan.stepsTotal, 4);
    assert.ok(details.body.plan.nextTask);

    // A student who hasn't been back for ten days shows up as gone quiet.
    await request(app).post('/api/auth/register').send({ name: 'Omar Quiet', email: 'omar@example.com', password: 'secret123' }).expect(201);
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    await User.collection.updateOne({ email: 'omar@example.com' }, { $set: { lastSeenAt: tenDaysAgo, createdAt: tenDaysAgo } });
    const quietStats = await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${adminToken}`).expect(200);
    assert.equal(quietStats.body.quiet, 1);
    assert.equal(quietStats.body.funnel.registered, 2);
    assert.equal(quietStats.body.funnel.trackQuiz, 1);
    const quiet = await request(app).get('/api/admin/students?quiet=1').set('Authorization', `Bearer ${adminToken}`).expect(200);
    assert.deepEqual(quiet.body.students.map((x) => x.name), ['Omar Quiet']);
    const quietSara = await request(app).get('/api/admin/students?quiet=1&search=sara').set('Authorization', `Bearer ${adminToken}`).expect(200);
    assert.equal(quietSara.body.total, 0);

    const subs = await request(app).get('/api/admin/submissions?status=pending').set('Authorization', `Bearer ${adminToken}`).expect(200);
    assert.equal(subs.body.submissions[0].user.name, 'Sara Test');
    assert.equal(subs.body.total, 1);

    await request(app).patch(`/api/admin/submissions/${submissionId}`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'done' }).expect(400);
    const reviewed = await request(app)
      .patch(`/api/admin/submissions/${submissionId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'approved', feedback: 'Great work' })
      .expect(200);
    assert.equal(reviewed.body.submission.status, 'approved');

    // The student is told about the reply until they open their tasks.
    const studentAuth = { Authorization: `Bearer ${studentToken}` };
    const unseen = await request(app).get('/api/me/notifications').set(studentAuth).expect(200);
    assert.equal(unseen.body.unseenReviews, 1);
    assert.equal(unseen.body.items[0].status, 'approved');
    // Earned badges come with the notifications so the app can celebrate them.
    assert.deepEqual(unseen.body.badges.map((b) => b.id).sort(), [
      'firstApproval',
      'firstSubmission',
      'levelTest',
      'trackQuiz',
    ]);
    assert.ok(unseen.body.badges.every((b) => !Number.isNaN(Date.parse(b.earnedAt))));
    await request(app).post('/api/me/notifications/seen').set(studentAuth).expect(200);
    const seen = await request(app).get('/api/me/notifications').set(studentAuth).expect(200);
    assert.equal(seen.body.unseenReviews, 0);

    const progress = await request(app).get('/api/me/progress').set('Authorization', `Bearer ${studentToken}`).expect(200);
    assert.equal(progress.body.summary.approved, 1);
    const badges = Object.fromEntries(progress.body.badges.map((b) => [b.id, b.earned]));
    assert.deepEqual(badges, { trackQuiz: true, levelTest: true, firstSubmission: true, firstApproval: true });
  });

  test('admin exports results as an Excel-ready CSV', async () => {
    await request(app).get('/api/admin/export.csv').set('Authorization', `Bearer ${studentToken}`).expect(403);
    const res = await request(app).get('/api/admin/export.csv').set('Authorization', `Bearer ${adminToken}`).expect(200);
    assert.match(res.headers['content-type'], /text\/csv/);
    assert.match(res.headers['content-disposition'], /attachment; filename="masar-students-/);
    assert.ok(res.text.startsWith('\uFEFF'), 'starts with a BOM so Excel reads Arabic');
    const lines = res.text.trim().split('\r\n');
    assert.equal(lines.length, 3, 'header + two students (admins are not exported)');
    assert.match(lines[0], /الاسم/);
    assert.match(lines[0], /آخر نشاط/);
    const sara = lines.find((l) => l.includes('sara@example.com'));
    assert.match(sara, /4\/4/);
    const en = await request(app).get('/api/admin/export.csv?lang=en').set('Authorization', `Bearer ${adminToken}`).expect(200);
    assert.match(en.text, /^\uFEFFName,Email/);
  });

  test('student updates profile and changes password; old sessions end', async () => {
    const auth = { Authorization: `Bearer ${studentToken}` };
    await request(app).patch('/api/auth/me').set(auth).send({ name: 'S' }).expect(400);
    const me = await request(app).patch('/api/auth/me').set(auth).send({ name: 'Sara Ahmed', university: 'Alexandria' }).expect(200);
    assert.equal(me.body.user.name, 'Sara Ahmed');
    assert.equal(me.body.user.tokenVersion, undefined);

    await request(app).post('/api/auth/change-password').set(auth).send({ currentPassword: 'wrong-pass', newPassword: 'newsecret1' }).expect(400);
    await request(app).post('/api/auth/change-password').set(auth).send({ currentPassword: 'secret123', newPassword: 'short' }).expect(400);
    await request(app).post('/api/auth/change-password').set(auth).send({ currentPassword: 'secret123', newPassword: 'secret123' }).expect(400);
    const changed = await request(app).post('/api/auth/change-password').set(auth).send({ currentPassword: 'secret123', newPassword: 'newsecret1' }).expect(200);

    await request(app).get('/api/auth/me').set(auth).expect(401);
    await request(app).get('/api/auth/me').set('Authorization', `Bearer ${changed.body.token}`).expect(200);
    await request(app).post('/api/auth/login').send({ email: 'sara@example.com', password: 'secret123' }).expect(401);
    const login = await request(app).post('/api/auth/login').send({ email: 'sara@example.com', password: 'newsecret1' }).expect(200);
    studentToken = login.body.token;
  });

  test('admin resets a forgotten password with a temporary one', async () => {
    const admin = { Authorization: `Bearer ${adminToken}` };
    const sara = await User.findOne({ email: 'sara@example.com' });
    const adminUser = await User.findOne({ email: 'admin@example.com' });

    await request(app).post(`/api/admin/students/${sara.id}/reset-password`).set('Authorization', `Bearer ${studentToken}`).expect(403);
    await request(app).post(`/api/admin/students/${adminUser.id}/reset-password`).set(admin).expect(404);

    const reset = await request(app).post(`/api/admin/students/${sara.id}/reset-password`).set(admin).expect(200);
    const temp = reset.body.temporaryPassword;
    assert.match(temp, /^[A-Za-z2-9]{10}$/);

    await request(app).get('/api/auth/me').set('Authorization', `Bearer ${studentToken}`).expect(401);
    const login = await request(app).post('/api/auth/login').send({ email: 'sara@example.com', password: temp }).expect(200);
    assert.equal(login.body.user.mustChangePassword, true);

    const changed = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ currentPassword: temp, newPassword: 'mynewpass9' })
      .expect(200);
    assert.equal(changed.body.user.mustChangePassword, false);
  });
});
