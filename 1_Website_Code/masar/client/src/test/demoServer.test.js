// The offline demo's in-browser API (demo/server.js) must answer like the real server.
import { describe, it, expect, beforeEach } from 'vitest';
import { handle, resetDemo } from '../../demo/server.js';
import { DEMO_ADMIN, DEMO_STUDENT } from '../../demo/seed.js';

async function call(method, path, { body, token } = {}) {
  const headers = new Headers(token ? { Authorization: `Bearer ${token}` } : {});
  const res = handle(method, path, headers, body === undefined ? undefined : JSON.stringify(body));
  const type = res.headers.get('Content-Type') || '';
  return { status: res.status, data: type.includes('json') ? await res.json() : await res.text() };
}

describe('Offline demo API', () => {
  beforeEach(() => {
    localStorage.clear();
    resetDemo();
  });

  it('starts with the sample supervisor and students', async () => {
    const admin = await call('POST', '/auth/login', { body: DEMO_ADMIN });
    expect(admin.status).toBe(200);
    const stats = await call('GET', '/admin/stats', { token: admin.data.token });
    expect(stats.data.funnel).toEqual({ registered: 10, trackQuiz: 8, levelTest: 6, submitted: 3, approved: 1 });
    expect(stats.data.quiet).toBe(3);

    const omar = await call('POST', '/auth/login', { body: DEMO_STUDENT });
    const progress = await call('GET', '/me/progress', { token: omar.data.token });
    expect(progress.data.summary.approved).toBe(1);
    expect(progress.data.trackResult.reasons).toHaveLength(3);
  });

  it('runs a new student journey with the real scoring and the real error codes', async () => {
    const weak = await call('POST', '/auth/register', {
      body: { name: 'Mona', email: 'mona@example.com', password: 'short' },
    });
    expect(weak.status).toBe(400);
    expect(weak.data.error.details.fields).toEqual(['password']);

    const { data } = await call('POST', '/auth/register', {
      body: { name: 'Mona', email: 'mona@example.com', password: 'secret123' },
    });
    const token = data.token;
    expect(
      (
        await call('POST', '/auth/register', {
          body: { name: 'Mona', email: 'MONA@example.com', password: 'secret123' },
        })
      ).data.error.code
    ).toBe('EMAIL_TAKEN');

    const quiz = await call('GET', '/track-quiz');
    const answers = Object.fromEntries(quiz.data.questions.map((q) => [q.id, q.options[0].id]));
    const incomplete = await call('POST', '/track-quiz/submit', { token, body: { answers: {} } });
    expect(incomplete.data.error.code).toBe('INCOMPLETE_ANSWERS');
    const result = await call('POST', '/track-quiz/submit', { token, body: { answers } });
    expect(result.status).toBe(201);
    expect(result.data.result.answers).toBeUndefined();
    const track = result.data.user.chosenTrack;

    expect((await call('GET', '/me/plan', { token })).data).toEqual(expect.objectContaining({ needs: 'level' }));
    const test = await call('GET', `/tracks/${track}/level-test`, { token });
    const levelAnswers = Object.fromEntries(test.data.questions.map((q) => [q.id, q.options[0].id]));
    expect(
      (await call('POST', `/tracks/${track}/level-test/submit`, { token, body: { answers: levelAnswers } })).status
    ).toBe(201);

    const plan = await call('GET', '/me/plan', { token });
    const step = plan.data.plan.steps[0].id;
    expect((await call('PUT', `/me/plan/steps/${step}`, { token, body: { done: true } })).data.done).toEqual([step]);

    const task = plan.data.tasks.find((t) => t.recommended);
    expect(
      (await call('POST', `/tasks/${task.id}/submissions`, { token, body: { link: 'not a link' } })).data.error.code
    ).toBe('INVALID_LINK');
    expect(
      (await call('POST', `/tasks/${task.id}/submissions`, { token, body: { link: 'https://github.com/mona/x' } }))
        .status
    ).toBe(201);

    // Students can't open supervisor pages; the supervisor sees the new work and can export it.
    expect((await call('GET', '/admin/stats', { token })).status).toBe(403);
    const admin = (await call('POST', '/auth/login', { body: DEMO_ADMIN })).data.token;
    const pending = await call('GET', '/admin/submissions?status=pending', { token: admin });
    expect(pending.data.submissions.some((s) => s.user.email === 'mona@example.com')).toBe(true);
    const csv = await call('GET', '/admin/export.csv?lang=en', { token: admin });
    expect(csv.data.split('\r\n')[0]).toMatch(/^\uFEFF?Name,Email/);
    expect(csv.data).toContain('mona@example.com');
  });

  it('signs out other sessions when the password changes', async () => {
    const first = (await call('POST', '/auth/login', { body: DEMO_STUDENT })).data.token;
    const changed = await call('POST', '/auth/change-password', {
      token: first,
      body: { currentPassword: DEMO_STUDENT.password, newPassword: 'another123' },
    });
    expect(changed.status).toBe(200);
    expect((await call('GET', '/auth/me', { token: first })).status).toBe(401);
    expect((await call('GET', '/auth/me', { token: changed.data.token })).status).toBe(200);
  });
});
