import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { useLang } from '../i18n/LanguageContext.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { useAsync } from '../hooks.js';
import EmptyState from '../components/EmptyState.jsx';
import { ErrorState, FormError, Loading } from '../components/States.jsx';
import { LevelBadge, Rich, StatusPill } from '../components/Bits.jsx';
import { markRepliesSeen } from '../notifications.js';

const LEVEL_ORDER = ['beginner', 'intermediate', 'advanced'];

function TaskItem({ task, recommended, onSaved, startOpen }) {
  const { t, pick } = useLang();
  const sub = task.submission;
  const [open, setOpen] = useState(startOpen || false);
  const [link, setLink] = useState(sub?.link || '');
  const [notes, setNotes] = useState(sub?.notes || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const d = await api(`/tasks/${task.id}/submissions`, { method: 'POST', body: { link, notes } });
      onSaved(task.id, d.submission);
      setDone(true);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li id={task.id} className={`task${recommended ? ' is-recommended' : ''}`}>
      <p className="task__num">{t('tasks.number', { n: task.id.split('-t')[1] })}</p>
      <div className="task__head">
        <h3 className="task__title">
          <Rich text={pick(task.title)} />
        </h3>
        <div className="task__pills">
          {sub && sub.seenByStudent === false && <span className="new-reply">{t('tasks.newReply')}</span>}
          <StatusPill status={sub?.status} />
        </div>
      </div>
      {recommended && <p className="task__flag">{t('tasks.recommended')}</p>}
      <p>
        <Rich text={pick(task.description)} />
      </p>
      <p className="task__deliverable">
        <strong>{t('tasks.deliverable')}:</strong> <Rich text={pick(task.deliverable)} />
      </p>

      {sub?.feedback && (
        <div className={`feedback feedback--${sub.status}`}>
          <strong>{t('tasks.feedback')}</strong>
          <p>{sub.feedback}</p>
        </div>
      )}

      {!open && (
        <button type="button" className="btn btn--small btn--ghost" onClick={() => setOpen(true)}>
          {sub ? t('tasks.resubmit') : t('tasks.submit')}
        </button>
      )}

      {open && (
        <form className="form task__form" onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor={`${task.id}-link`}>{t('tasks.link')}</label>
            <input
              id={`${task.id}-link`}
              type="url"
              dir="ltr"
              inputMode="url"
              placeholder={t('tasks.linkPlaceholder')}
              value={link}
              onChange={(e) => setLink(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor={`${task.id}-notes`}>
              {t('tasks.notes')} ({t('common.optional')})
            </label>
            <textarea
              id={`${task.id}-notes`}
              rows={3}
              maxLength={1000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <FormError error={error} />
          {done && (
            <p className="form-success" role="status">
              {t('tasks.submitted')}
            </p>
          )}
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {sub ? t('tasks.resubmit') : t('tasks.submit')}
          </button>
        </form>
      )}
    </li>
  );
}

export default function Tasks() {
  const { t, pick } = useLang();
  const { user } = useAuth();
  const { hash } = useLocation();
  const trackId = user.chosenTrack;
  const data = useAsync(async () => {
    if (!trackId) return null;
    const [tasks, progress] = await Promise.all([api(`/tracks/${trackId}/tasks`), api('/me/progress')]);
    return { ...tasks, level: progress.levelResults[trackId]?.level || null };
  }, [trackId]);

  useEffect(() => {
    if (hash && data.data) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [hash, data.data]);

  // Opening the tasks counts as reading the replies. The "new reply" labels stay
  // visible for this visit because they come from the data loaded above.
  const hasUnseen = !!data.data?.tasks?.some((task) => task.submission?.seenByStudent === false);
  useEffect(() => {
    if (hasUnseen) markRepliesSeen();
  }, [hasUnseen]);

  if (!trackId) {
    return (
      <div className="page page--narrow">
        <h1 className="page-title">{t('tasks.title')}</h1>
        <EmptyState art="start" text={t('tasks.noTrack')}>
          <Link to="/track-quiz" className="btn btn--primary">
            {t('dashboard.startQuiz')}
          </Link>
        </EmptyState>
      </div>
    );
  }
  if (data.loading) return <Loading />;
  if (data.error) return <ErrorState error={data.error} onRetry={data.reload} />;

  const { track, tasks, level } = data.data;

  const onSaved = (taskId, submission) =>
    data.setData((d) => ({ ...d, tasks: d.tasks.map((x) => (x.id === taskId ? { ...x, submission } : x)) }));

  return (
    <div className="page" style={{ '--track-base': track.color }}>
      <header className="page-head">
        <h1 className="page-title">
          {t('tasks.title')}: {pick(track.short)}
        </h1>
        <p className="page-lead">{t('tasks.lead')}</p>
      </header>

      {LEVEL_ORDER.map((lv) => (
        <section key={lv} className="task-group" aria-labelledby={`lv-${lv}`}>
          <h2 id={`lv-${lv}`} className="task-group__title">
            <LevelBadge level={lv} />
          </h2>
          <ul className="task-list">
            {tasks
              .filter((task) => task.level === lv)
              .map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  recommended={task.level === level}
                  onSaved={onSaved}
                  startOpen={hash === `#${task.id}`}
                />
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
