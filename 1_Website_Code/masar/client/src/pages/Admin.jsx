import { useEffect, useRef, useState } from 'react';
import { api, apiDownload } from '../api.js';
import { useLang } from '../i18n/LanguageContext.jsx';
import { useAsync, useTracks } from '../hooks.js';
import EmptyState from '../components/EmptyState.jsx';
import { ErrorState, FormError, Loading } from '../components/States.jsx';
import { LevelBadge, Meter, StatusPill, TrackChip, trackById } from '../components/Bits.jsx';
import Pager from '../components/Pager.jsx';

const TABS = ['overview', 'students', 'submissions'];
const STATUSES = ['pending', 'needs_revision', 'approved'];

const STATIONS = ['registered', 'trackQuiz', 'levelTest', 'submitted', 'approved'];
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const isQuiet = (s) => s.approved === 0 && Date.now() - new Date(s.lastSeenAt || s.createdAt).getTime() > WEEK_MS;

// How many students reached each station, and where the biggest drop is.
function Funnel({ funnel, quiet, pending, onShowQuiet }) {
  const { t } = useLang();
  const total = funnel.registered;
  let drop = null;
  STATIONS.slice(1).forEach((key, i) => {
    const n = funnel[STATIONS[i]] - funnel[key];
    if (n > 0 && (!drop || n > drop.n)) drop = { n, from: STATIONS[i], to: key };
  });

  return (
    <section className="panel funnel" aria-labelledby="funnel-title">
      <h2 id="funnel-title" className="panel__title">
        {t('admin.funnelTitle')}
      </h2>
      {total === 0 ? (
        <EmptyState compact art="start" text={t('admin.funnelEmpty')} />
      ) : (
        <>
          <p className="muted funnel__lead">{t('admin.funnelLead')}</p>
          <ol className="funnel__list">
            {STATIONS.map((key) => {
              const n = funnel[key];
              const pct = Math.round((n / total) * 100);
              return (
                <li key={key} className={`funnel__row${drop?.to === key ? ' is-drop' : ''}`}>
                  <span className="funnel__name">{t(`admin.funnel.${key}`)}</span>
                  <span className="funnel__bar" aria-hidden="true">
                    <span className="funnel__fill" style={{ inlineSize: `${Math.max(pct, n ? 2 : 0)}%` }} />
                  </span>
                  <span className="funnel__count">
                    <strong>{n}</strong>
                    {key !== 'registered' && <span className="funnel__pct">{t('admin.funnelPct', { pct })}</span>}
                  </span>
                </li>
              );
            })}
          </ol>
          {drop && (
            <p className="funnel__note">
              {t('admin.funnelDrop', {
                from: t(`admin.funnel.${drop.from}`),
                to: t(`admin.funnel.${drop.to}`),
                n: drop.n,
              })}
              {/* Students waiting for a review haven't stopped; say so when that explains the drop. */}
              {drop.to === 'approved' && pending > 0 && ` ${t('admin.funnelPending', { n: pending })}`}
            </p>
          )}
        </>
      )}
      <div className={`quiet${quiet ? ' quiet--some' : ''}`}>
        {quiet ? (
          <>
            <div>
              <p className="quiet__title">{t('admin.quietTitle', { n: quiet })}</p>
              <p className="quiet__text">{t('admin.quietText')}</p>
            </div>
            <button type="button" className="btn btn--small btn--ghost" onClick={onShowQuiet}>
              {t('admin.showQuiet')}
            </button>
          </>
        ) : (
          <p className="quiet__text">{t('admin.quietNone')}</p>
        )}
      </div>
    </section>
  );
}

function Overview({ tracks, onShowQuiet }) {
  const { t, pick } = useLang();
  const stats = useAsync(() => api('/admin/stats'), []);
  if (stats.loading) return <Loading />;
  if (stats.error) return <ErrorState error={stats.error} onRetry={stats.reload} />;
  const s = stats.data;
  const maxRec = Math.max(1, ...Object.values(s.recommended));

  return (
    <>
      <dl className="counts counts--big">
        <div>
          <dt>{t('admin.students')}</dt>
          <dd>{s.students}</dd>
        </div>
        <div>
          <dt>{t('admin.newThisWeek')}</dt>
          <dd>{s.newThisWeek}</dd>
        </div>
        <div>
          <dt>{t('admin.trackQuizzes')}</dt>
          <dd>{s.trackQuizzes}</dd>
        </div>
        <div>
          <dt>{t('admin.levelTests')}</dt>
          <dd>{s.levelTests}</dd>
        </div>
        <div>
          <dt>{t('admin.toReview')}</dt>
          <dd>{s.submissions.pending}</dd>
        </div>
      </dl>

      {s.funnel && (
        <Funnel funnel={s.funnel} quiet={s.quiet || 0} pending={s.submissions.pending} onShowQuiet={onShowQuiet} />
      )}

      <div className="grid-2">
        <section className="panel" aria-labelledby="rec-title">
          <h2 id="rec-title" className="panel__title">
            {t('admin.recommended')}
          </h2>
          <ul className="match-list match-list--compact">
            {tracks.map((tr) => (
              <li key={tr.id} className="match-list__item" style={{ '--track-base': tr.color }}>
                <div className="match-list__top">
                  <span className="match-list__name">{pick(tr.name)}</span>
                  <span className="match-list__pct">{s.recommended[tr.id]}</span>
                </div>
                <Meter
                  value={(s.recommended[tr.id] / maxRec) * 100}
                  color={tr.color}
                  label={`${pick(tr.name)}: ${s.recommended[tr.id]}`}
                />
              </li>
            ))}
          </ul>
        </section>

        <section className="panel" aria-labelledby="lv-title">
          <h2 id="lv-title" className="panel__title">
            {t('admin.levelsByTrack')}
          </h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">{t('admin.colTrack')}</th>
                  <th scope="col">{t('levels.beginner')}</th>
                  <th scope="col">{t('levels.intermediate')}</th>
                  <th scope="col">{t('levels.advanced')}</th>
                </tr>
              </thead>
              <tbody>
                {tracks.map((tr) => (
                  <tr key={tr.id}>
                    <th scope="row">
                      <TrackChip track={tr} />
                    </th>
                    <td>{s.levelsByTrack[tr.id].beginner}</td>
                    <td>{s.levelsByTrack[tr.id].intermediate}</td>
                    <td>{s.levelsByTrack[tr.id].advanced}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}

function StudentProgress({ student, plan }) {
  const { t, pick, formatDate, formatAgo } = useLang();
  const task = plan?.nextTask;
  return (
    <section className="progress-card" aria-labelledby="progress-title">
      <h3 id="progress-title">{t('admin.progressTitle')}</h3>
      <dl className="progress-card__facts">
        <div>
          <dt>{t('admin.lastSeen')}</dt>
          <dd>
            {formatAgo(student.lastSeenAt || student.createdAt)}
            {isQuiet({ ...student, approved: plan?.tasksApproved ?? 0 }) && (
              <span className="quiet-chip">{t('admin.quietChip')}</span>
            )}
          </dd>
        </div>
        <div>
          <dt>{t('admin.joinedOn')}</dt>
          <dd>{formatDate(student.createdAt)}</dd>
        </div>
        <div>
          <dt>{t('admin.planProgress')}</dt>
          <dd>
            {plan ? (
              <span className="progress-card__steps">
                <Meter
                  value={(plan.stepsDone / plan.stepsTotal) * 100}
                  label={t('admin.planSteps', { n: plan.stepsDone, total: plan.stepsTotal })}
                />
                {t('admin.planSteps', { n: plan.stepsDone, total: plan.stepsTotal })}
              </span>
            ) : (
              t('admin.noPlanYet')
            )}
          </dd>
        </div>
        {plan && (
          <div>
            <dt>{t('admin.nextTask')}</dt>
            <dd>
              {!task
                ? t('admin.allTasksDone')
                : task.status === 'needs_revision'
                  ? t('admin.revisionTask', { task: pick(task.title) })
                  : pick(task.title)}
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}

function StudentDetails({ id, tracks, onClose }) {
  const { t, formatDate } = useLang();
  const details = useAsync(() => api(`/admin/students/${id}`), [id]);
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog ref={dialogRef} className="dialog" onClose={onClose} aria-labelledby="student-title">
      <div className="dialog__head">
        <h2 id="student-title">{details.data?.student.name || t('admin.details')}</h2>
        <button type="button" className="btn btn--small btn--ghost" onClick={() => dialogRef.current.close()}>
          {t('admin.close')}
        </button>
      </div>
      {details.loading && <Loading shape="rows" />}
      {details.error && <ErrorState error={details.error} onRetry={details.reload} />}
      {details.data && (
        <div className="dialog__body">
          <p className="muted" dir="ltr">
            {details.data.student.email}
          </p>
          {details.data.student.university && <p>{details.data.student.university}</p>}

          <StudentProgress student={details.data.student} plan={details.data.plan} />

          <h3>{t('admin.trackHistory')}</h3>
          <ul className="history">
            {details.data.trackResults.map((r) => (
              <li key={r.id}>
                <span>{formatDate(r.createdAt)}</span>
                <TrackChip track={trackById(tracks, r.recommendedTrack)} />
                <span>{t('common.percent', { n: r.scores[0].percent })}</span>
              </li>
            ))}
          </ul>

          <h3>{t('admin.levelHistory')}</h3>
          <ul className="history">
            {details.data.levelResults.map((r) => (
              <li key={r.id}>
                <span>{formatDate(r.createdAt)}</span>
                <TrackChip track={trackById(tracks, r.track)} />
                <LevelBadge level={r.level} />
                <span>{t('common.percent', { n: r.percent })}</span>
              </li>
            ))}
          </ul>

          <h3>{t('admin.tabs.submissions')}</h3>
          <ul className="history">
            {details.data.submissions.map((s) => (
              <li key={s.id}>
                <span>{s.taskId}</span>
                <a href={s.link} target="_blank" rel="noreferrer">
                  {t('common.open')}
                </a>
                <StatusPill status={s.status} />
              </li>
            ))}
          </ul>
          {!details.data.submissions.length && <p className="muted">{t('admin.noStudentSubmissions')}</p>}

          <ResetPassword id={id} />
        </div>
      )}
    </dialog>
  );
}

// Supervisor resets a student's password: a confirm step, then the one-time temporary password.
function ResetPassword({ id }) {
  const { t } = useLang();
  const [stage, setStage] = useState('idle'); // idle | confirm | busy | done
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const run = async () => {
    setStage('busy');
    setError(null);
    try {
      const d = await api(`/admin/students/${id}/reset-password`, { method: 'POST' });
      setPassword(d.temporaryPassword);
      setStage('done');
    } catch (err) {
      setError(err);
      setStage('confirm');
    }
  };

  return (
    <div className="reset-password">
      <h3>{t('admin.resetPassword')}</h3>
      {stage === 'idle' && (
        <button type="button" className="btn btn--small" onClick={() => setStage('confirm')}>
          {t('admin.resetPassword')}
        </button>
      )}
      {(stage === 'confirm' || stage === 'busy') && (
        <>
          <p>{t('admin.resetConfirm')}</p>
          <div className="form__actions">
            <button type="button" className="btn btn--small btn--primary" onClick={run} disabled={stage === 'busy'}>
              {t('admin.resetYes')}
            </button>
            <button
              type="button"
              className="btn btn--small btn--ghost"
              onClick={() => setStage('idle')}
              disabled={stage === 'busy'}
            >
              {t('admin.resetNo')}
            </button>
          </div>
          <FormError error={error} />
        </>
      )}
      {stage === 'done' && (
        <p className="notice notice--ok" role="status">
          {t('admin.resetDone')}{' '}
          <code className="temp-password" dir="ltr">
            {password}
          </code>
        </p>
      )}
    </div>
  );
}

function Students({ tracks, initialQuiet = false }) {
  const { t, pick, formatAgo } = useLang();
  const [query, setQuery] = useState({ search: '', track: '', quiet: initialQuiet, page: 1 });
  const [draft, setDraft] = useState('');
  const [openId, setOpenId] = useState(null);
  const list = useAsync(() => {
    const params = new URLSearchParams();
    if (query.search) params.set('search', query.search);
    if (query.track) params.set('track', query.track);
    if (query.quiet) params.set('quiet', '1');
    params.set('page', query.page);
    return api(`/admin/students?${params}`);
  }, [query.search, query.track, query.quiet, query.page]);

  return (
    <>
      <form
        className="filters"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery((q) => ({ ...q, search: draft.trim(), page: 1 }));
        }}
      >
        <label className="sr-only" htmlFor="student-search">
          {t('admin.search')}
        </label>
        <input
          id="student-search"
          type="search"
          placeholder={t('admin.search')}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <label className="sr-only" htmlFor="student-track">
          {t('admin.colTrack')}
        </label>
        <select
          id="student-track"
          value={query.track}
          onChange={(e) => setQuery((q) => ({ ...q, track: e.target.value, page: 1 }))}
        >
          <option value="">{t('admin.allTracks')}</option>
          {tracks.map((tr) => (
            <option key={tr.id} value={tr.id}>
              {pick(tr.name)}
            </option>
          ))}
        </select>
        <label className="filters__check">
          <input
            type="checkbox"
            checked={query.quiet}
            onChange={(e) => setQuery((q) => ({ ...q, quiet: e.target.checked, page: 1 }))}
          />
          {t('admin.quietOnly')}
        </label>
      </form>

      {list.loading && <Loading shape="rows" />}
      {list.error && <ErrorState error={list.error} onRetry={list.reload} />}
      {list.data &&
        !list.data.students.length &&
        (query.search || query.track || query.quiet ? (
          <EmptyState art="start" title={t('admin.noStudents')} text={t('admin.noStudentsHint')} headingLevel={3} />
        ) : (
          <EmptyState
            art="start"
            title={t('admin.noStudentsYet')}
            text={t('admin.noStudentsYetHint')}
            headingLevel={3}
          />
        ))}
      {list.data && list.data.students.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{t('admin.colName')}</th>
                <th scope="col">{t('admin.colEmail')}</th>
                <th scope="col">{t('admin.colTrack')}</th>
                <th scope="col">{t('admin.colLevel')}</th>
                <th scope="col">{t('admin.colSubmissions')}</th>
                <th scope="col">{t('admin.colLastSeen')}</th>
              </tr>
            </thead>
            <tbody>
              {list.data.students.map((s) => (
                <tr key={s.id}>
                  <th scope="row">
                    <button type="button" className="link-button" onClick={() => setOpenId(s.id)}>
                      {s.name}
                    </button>
                  </th>
                  <td dir="ltr">{s.email}</td>
                  <td>{s.chosenTrack ? <TrackChip track={trackById(tracks, s.chosenTrack)} /> : '—'}</td>
                  <td>{s.level ? <LevelBadge level={s.level} /> : '—'}</td>
                  <td>
                    {s.approved}/{s.submissions}
                  </td>
                  <td>
                    <span className="last-seen">
                      {formatAgo(s.lastSeenAt || s.createdAt)}
                      {isQuiet(s) && <span className="quiet-chip">{t('admin.quietChip')}</span>}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {list.data && (
        <Pager
          page={list.data.page}
          pages={list.data.pages}
          total={list.data.total}
          onChange={(page) => setQuery((q) => ({ ...q, page }))}
          label={t('admin.tabs.students')}
        />
      )}
      {openId && <StudentDetails id={openId} tracks={tracks} onClose={() => setOpenId(null)} />}
    </>
  );
}

function ReviewItem({ sub, task, track, onSaved }) {
  const { t, pick, formatDate } = useLang();
  const [feedback, setFeedback] = useState(sub.feedback || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const save = async (status) => {
    setBusy(true);
    setError(null);
    try {
      const d = await api(`/admin/submissions/${sub.id}`, { method: 'PATCH', body: { status, feedback } });
      onSaved(d.submission);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="task" style={{ '--track-base': track?.color }}>
      <div className="task__head">
        <h3 className="task__title">{task ? pick(task.title) : sub.taskId}</h3>
        <StatusPill status={sub.status} />
      </div>
      <p className="review-meta">
        <TrackChip track={track} />
        <span>
          {t('admin.student')}: {sub.user?.name}
        </span>
        <span>{formatDate(sub.updatedAt)}</span>
      </p>
      <p>
        <a href={sub.link} target="_blank" rel="noreferrer" dir="ltr" className="break">
          {sub.link}
        </a>
      </p>
      {sub.notes && (
        <p className="muted">
          {t('admin.notes')}: {sub.notes}
        </p>
      )}
      <div className="field">
        <label htmlFor={`fb-${sub.id}`}>{t('tasks.feedback')}</label>
        <textarea
          id={`fb-${sub.id}`}
          rows={2}
          maxLength={1000}
          placeholder={t('admin.feedbackPlaceholder')}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
        />
      </div>
      <FormError error={error} />
      <div className="row-actions">
        <button type="button" className="btn btn--small btn--primary" disabled={busy} onClick={() => save('approved')}>
          {t('admin.approve')}
        </button>
        <button
          type="button"
          className="btn btn--small btn--ghost"
          disabled={busy}
          onClick={() => save('needs_revision')}
        >
          {t('admin.requestChanges')}
        </button>
      </div>
    </li>
  );
}

function Submissions({ tracks }) {
  const { t, pick } = useLang();
  const [status, setStatus] = useState('pending');
  const [track, setTrack] = useState('');
  const [page, setPage] = useState(1);
  const tasks = useAsync(async () => {
    const all = await Promise.all(tracks.map((tr) => api(`/tracks/${tr.id}/tasks`)));
    return Object.fromEntries(all.flatMap((d) => d.tasks.map((task) => [task.id, task])));
  }, [tracks]);
  const subs = useAsync(() => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (track) params.set('track', track);
    params.set('page', page);
    return api(`/admin/submissions?${params}`);
  }, [status, track, page]);

  // A reviewed item leaves the "pending" list straight away.
  const onSaved = (updated) =>
    subs.setData((d) => {
      const submissions = d.submissions
        .map((s) => (s.id === updated.id ? updated : s))
        .filter((s) => !status || s.status === status);
      return { ...d, submissions, total: d.total - (d.submissions.length - submissions.length) };
    });

  return (
    <>
      <div className="filters">
        <label className="sr-only" htmlFor="sub-status">
          {t('admin.allStatuses')}
        </label>
        <select
          id="sub-status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">{t('admin.allStatuses')}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="sub-track">
          {t('admin.colTrack')}
        </label>
        <select
          id="sub-track"
          value={track}
          onChange={(e) => {
            setTrack(e.target.value);
            setPage(1);
          }}
        >
          <option value="">{t('admin.allTracks')}</option>
          {tracks.map((tr) => (
            <option key={tr.id} value={tr.id}>
              {pick(tr.name)}
            </option>
          ))}
        </select>
      </div>

      {(subs.loading || tasks.loading) && <Loading shape="rows" />}
      {subs.error && <ErrorState error={subs.error} onRetry={subs.reload} />}
      {subs.data &&
        tasks.data &&
        !subs.data.submissions.length &&
        (status === 'pending' && !track ? (
          <EmptyState art="done" title={t('admin.allReviewed')} text={t('admin.allReviewedHint')} headingLevel={3} />
        ) : (
          <EmptyState art="start" title={t('admin.noSubmissions')} headingLevel={3} />
        ))}
      {subs.data && tasks.data && (
        <ul className="task-list">
          {subs.data.submissions.map((s) => (
            <ReviewItem
              key={s.id}
              sub={s}
              task={tasks.data[s.taskId]}
              track={trackById(tracks, s.track)}
              onSaved={onSaved}
            />
          ))}
        </ul>
      )}
      {subs.data && tasks.data && (
        <Pager
          page={subs.data.page}
          pages={subs.data.pages}
          total={subs.data.total}
          onChange={setPage}
          label={t('admin.tabs.submissions')}
        />
      )}
    </>
  );
}

// All students and their results as a CSV file that opens in Excel.
function ExportButton() {
  const { t, lang } = useLang();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiDownload(`/admin/export.csv?lang=${lang}`, 'masar-students.csv');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="page-head__side">
      <button type="button" className="btn btn--ghost btn--small" onClick={download} disabled={busy}>
        {busy ? t('common.loading') : t('admin.exportCsv')}
      </button>
      <FormError error={error} />
    </div>
  );
}

export default function Admin() {
  const { t } = useLang();
  const [tab, setTab] = useState('overview');
  // Set when the supervisor follows "show their names" from the overview.
  const [quietOnly, setQuietOnly] = useState(false);
  const tracks = useTracks();

  if (tracks.loading) return <Loading />;
  if (tracks.error) return <ErrorState error={tracks.error} onRetry={tracks.reload} />;

  return (
    <div className="page page--wide">
      <header className="page-head page-head--plan">
        <h1 className="page-title">{t('admin.title')}</h1>
        <ExportButton />
      </header>
      <div className="tabs" role="tablist" aria-label={t('admin.title')}>
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`tab-${key}`}
            aria-selected={tab === key}
            aria-controls={`panel-${key}`}
            className="tabs__tab"
            onClick={() => {
              setQuietOnly(false);
              setTab(key);
            }}
          >
            {t(`admin.tabs.${key}`)}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="tabs__panel">
        {tab === 'overview' && (
          <Overview
            tracks={tracks.data}
            onShowQuiet={() => {
              setQuietOnly(true);
              setTab('students');
            }}
          />
        )}
        {tab === 'students' && <Students tracks={tracks.data} initialQuiet={quietOnly} />}
        {tab === 'submissions' && <Submissions tracks={tracks.data} />}
      </div>
    </div>
  );
}
