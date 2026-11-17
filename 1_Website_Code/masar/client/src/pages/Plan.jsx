import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useLang } from '../i18n/LanguageContext.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { useAsync } from '../hooks.js';
import { ErrorState, FormError, Loading } from '../components/States.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { LevelBadge, Rich, StatusPill } from '../components/Bits.jsx';

// A small ring that fills as plan steps are ticked off.
function ProgressRing({ done, total }) {
  const r = 24;
  const length = 2 * Math.PI * r;
  const filled = total ? done / total : 0;
  return (
    <svg className="ring" viewBox="0 0 60 60" width="60" height="60" aria-hidden="true" focusable="false">
      <circle className="ring__track" cx="30" cy="30" r={r} />
      <circle
        className="ring__fill"
        cx="30"
        cy="30"
        r={r}
        strokeDasharray={length}
        strokeDashoffset={length * (1 - filled)}
      />
      <text className="ring__text" x="30" y="30" dominantBaseline="central" textAnchor="middle">
        {done}/{total}
      </text>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
  );
}

export default function Plan() {
  const { t, pick } = useLang();
  const { user } = useAuth();
  const plan = useAsync(() => api('/me/plan'), [user.chosenTrack]);
  const [saving, setSaving] = useState({});
  const [saveError, setSaveError] = useState(null);

  // Ticks a step at once and saves it in the background; if saving fails the
  // tick is undone and the reason shown. A step can't be toggled again until
  // its last change is saved, so requests never overtake each other.
  const toggle = async (stepId, nextDone) => {
    if (saving[stepId]) return;
    const apply = (on) =>
      plan.setData((d) => ({
        ...d,
        done: on ? [...new Set([...d.done, stepId])] : d.done.filter((id) => id !== stepId),
      }));
    apply(nextDone);
    setSaveError(null);
    setSaving((s) => ({ ...s, [stepId]: true }));
    try {
      await api(`/me/plan/steps/${stepId}`, { method: 'PUT', body: { done: nextDone } });
    } catch (err) {
      apply(!nextDone);
      setSaveError(err);
    } finally {
      setSaving((s) => ({ ...s, [stepId]: false }));
    }
  };

  if (plan.loading) return <Loading />;

  if (plan.data?.needs) {
    const noTrack = plan.data.needs === 'track';
    return (
      <div className="page page--narrow">
        <h1 className="page-title">{t('plan.title')}</h1>
        <EmptyState art="start" text={noTrack ? t('plan.noTrack') : t('plan.noLevel')}>
          <Link to={noTrack ? '/track-quiz' : `/level-test/${plan.data.track.id}`} className="btn btn--primary">
            {noTrack ? t('dashboard.startQuiz') : t('dashboard.startLevel')}
          </Link>
        </EmptyState>
      </div>
    );
  }
  if (plan.error) return <ErrorState error={plan.error} onRetry={plan.reload} />;

  const { track, level, plan: p, tasks, resources } = plan.data;
  const levelTasks = tasks.filter((task) => task.recommended);
  const done = new Set(plan.data.done || []);
  const doneCount = p.steps.filter((step) => done.has(step.id)).length;
  const finished = doneCount === p.steps.length;

  return (
    <div className="page" style={{ '--track-base': track.color }}>
      <header className="page-head page-head--plan">
        <div>
          <h1 className="page-title">{pick(p.title)}</h1>
          <p className="page-lead">{pick(p.summary)}</p>
        </div>
        <div className="page-head__side">
          <LevelBadge level={level} />
          <p className="muted">{t('plan.subtitle', { track: pick(track.short), level: t(`levels.${level}`) })}</p>
        </div>
      </header>

      <div className="plan-layout">
        <section aria-labelledby="steps-title">
          <div className="steps-head">
            <h2 id="steps-title" className="section__title section__title--sm">
              {t('plan.steps')}
            </h2>
            <div className="steps-head__progress">
              <ProgressRing done={doneCount} total={p.steps.length} />
              <p role="status" aria-live="polite">
                {t('plan.progress', { n: doneCount, total: p.steps.length })}
              </p>
            </div>
          </div>
          <FormError error={saveError} />
          <ol className="line-steps">
            {p.steps.map((step, i) => {
              const isDone = done.has(step.id);
              return (
                <li key={step.id} className={`line-steps__item${isDone ? ' is-done' : ''}`}>
                  <span className="line-steps__dot" aria-hidden="true">
                    {isDone ? <CheckIcon /> : i + 1}
                  </span>
                  <h3>{pick(step.title)}</h3>
                  <p>
                    <Rich text={pick(step.details)} />
                  </p>
                  <label className="step-check">
                    <input
                      type="checkbox"
                      checked={isDone}
                      onChange={(e) => toggle(step.id, e.target.checked)}
                      aria-busy={saving[step.id] || undefined}
                    />
                    <span>
                      {t('plan.markDone')}
                      <span className="sr-only">: {pick(step.title)}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ol>

          {finished && (
            <div className="plan-finished">
              <span className="plan-finished__icon" aria-hidden="true">
                <CheckIcon />
              </span>
              <div>
                <h3>{t('plan.finishedTitle')}</h3>
                <p>{t(level === 'advanced' ? 'plan.finishedTextTop' : 'plan.finishedText')}</p>
                <div className="plan-finished__actions">
                  <Link to="/tasks" className="btn btn--primary btn--small">
                    {t('celebrate.go.firstApproval')}
                  </Link>
                  {level !== 'advanced' && (
                    <Link to={`/level-test/${track.id}`} className="btn btn--ghost btn--small">
                      {t('plan.retake')}
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        <aside className="plan-side">
          <section className="panel" aria-labelledby="ptasks-title">
            <h2 id="ptasks-title" className="panel__title">
              {t('plan.tasksForLevel')}
            </h2>
            <ul className="mini-tasks">
              {levelTasks.map((task) => (
                <li key={task.id}>
                  <Link to={`/tasks#${task.id}`}>
                    {t('tasks.number', { n: task.id.split('-t')[1] })}: {pick(task.title)}
                  </Link>
                  <StatusPill status={task.submission?.status} />
                </li>
              ))}
            </ul>
            <Link to="/tasks" className="text-link">
              {t('plan.allTasks')}
            </Link>
          </section>

          <section className="panel" aria-labelledby="res-title">
            <h2 id="res-title" className="panel__title">
              {t('plan.resources')}
            </h2>
            <ul className="resources">
              {resources.map((r) => (
                <li key={r.url}>
                  <a href={r.url} target="_blank" rel="noreferrer" dir="auto">
                    {r.title}
                  </a>
                  <span className="resources__lang">{t(`common.${r.lang}`)}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
