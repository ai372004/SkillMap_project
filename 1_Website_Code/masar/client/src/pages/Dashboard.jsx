import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useLang } from '../i18n/LanguageContext.jsx';
import { useAsync, useTracks } from '../hooks.js';
import { ErrorState, Loading } from '../components/States.jsx';
import JourneyLine from '../components/JourneyLine.jsx';
import Badges from '../components/Badges.jsx';
import { LevelBadge, TrackChip, trackById } from '../components/Bits.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { hasProgress, progressKey, savedAnswerCount } from '../quizProgress.js';

const QUESTIONS = 15;
// Rough time per question, from watching students take each quiz.
const SECONDS_PER_QUESTION = { quiz: 20, level: 40 };

function minutesLeft(t, answered, kind) {
  const n = Math.max(1, Math.ceil(((QUESTIONS - answered) * SECONDS_PER_QUESTION[kind]) / 60));
  const form = n === 1 ? 'one' : n === 2 ? 'two' : n <= 10 ? 'few' : 'many';
  return t(`dashboard.minutes.${form}`, { n });
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="6.2" />
      <path d="M8 4.6V8l2.3 1.6" />
    </svg>
  );
}

function StepsIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M2 8h12" />
      <circle cx="3" cy="8" r="1.8" />
      <circle cx="8" cy="8" r="1.8" />
      <circle cx="13" cy="8" r="1.8" />
    </svg>
  );
}

// First visit: one welcome panel and one button, instead of empty counters.
function Welcome({ name, resume }) {
  const { t } = useLang();
  const steps = ['quiz', 'level', 'plan'];
  return (
    <div className="page">
      <section className="welcome" aria-labelledby="welcome-title">
        <h1 id="welcome-title" className="page-title">
          {t('dashboard.hello', { name })}
        </h1>
        <p className="welcome__lead">{t('dashboard.welcomeLead')}</p>
        <ol className="welcome__steps">
          {steps.map((key, i) => (
            <li key={key}>
              <span className="welcome__num" aria-hidden="true">
                {i + 1}
              </span>
              <span>
                <strong>{t(`dashboard.welcome.${key}.title`)}</strong>
                <span className="welcome__meta">{t(`dashboard.welcome.${key}.meta`)}</span>
              </span>
            </li>
          ))}
        </ol>
        <Link to="/track-quiz" className="btn btn--primary btn--large">
          {resume ? t('dashboard.resumeQuiz') : t('dashboard.startQuiz')}
        </Link>
      </section>
    </div>
  );
}

export default function Dashboard() {
  const { t, pick } = useLang();
  const { user: me } = useAuth();
  const progress = useAsync(() => api('/me/progress'), []);
  const tracks = useTracks();

  if (progress.loading || tracks.loading) return <Loading />;
  if (progress.error || tracks.error)
    return <ErrorState error={progress.error || tracks.error} onRetry={progress.reload} />;

  const { user, trackResult, levelResults, submissions, summary, badges, plan } = progress.data;
  const firstName = user.name.split(' ')[0];
  if (!trackResult && !user.chosenTrack) {
    return <Welcome name={firstName} resume={hasProgress(progressKey(me?.id, 'track-quiz'))} />;
  }
  const track = trackById(tracks.data, user.chosenTrack);
  const level = track ? levelResults[track.id] : null;
  const trackSubs = submissions.filter((s) => s.track === user.chosenTrack);

  const stations = [
    { key: 'quiz', done: !!trackResult, to: trackResult ? '/track-result' : '/track-quiz' },
    { key: 'track', done: !!track, value: track ? pick(track.short) : null, to: '/track-result' },
    {
      key: 'level',
      done: !!level,
      value: level ? t(`levels.${level.level}`) : null,
      to: track ? `/level-result/${track.id}` : null,
    },
    { key: 'plan', done: !!level, to: '/plan' },
    {
      key: 'tasks',
      done: trackSubs.some((s) => s.status === 'approved'),
      value: trackSubs.length ? `${trackSubs.length}/6` : null,
      to: '/tasks',
    },
  ];

  // The one thing to do next, with a hint of how long it takes or how far along it is.
  const next = (() => {
    if (!track) {
      const answered = savedAnswerCount(progressKey(me?.id, 'track-quiz'));
      return {
        text: answered
          ? t('dashboard.resumeQuizText', { n: answered, total: QUESTIONS })
          : t('dashboard.startQuizText'),
        label: answered ? t('dashboard.resumeQuiz') : t('dashboard.startQuiz'),
        to: '/track-quiz',
        meta: { icon: 'clock', text: minutesLeft(t, answered, 'quiz') },
      };
    }
    if (!level) {
      const answered = savedAnswerCount(progressKey(me?.id, `level-${track.id}`));
      return {
        text: answered
          ? t('dashboard.resumeLevelText', { n: answered, total: QUESTIONS, track: pick(track.short) })
          : t('dashboard.startLevelText', { track: pick(track.name) }),
        label: answered ? t('dashboard.resumeLevel') : t('dashboard.startLevel'),
        to: `/level-test/${track.id}`,
        meta: { icon: 'clock', text: minutesLeft(t, answered, 'level') },
      };
    }
    const levelName = t(`levels.${level.level}`);
    const steps = {
      icon: 'steps',
      text: t('plan.progress', { n: plan?.stepsDone ?? 0, total: plan?.stepsTotal ?? 0 }),
    };
    const taskMeta = {
      icon: 'steps',
      text: t('dashboard.tasksMeta', { n: plan?.tasksApproved ?? 0, total: plan?.tasksTotal ?? 0 }),
    };
    const task = plan?.nextTask;
    if (task?.status === 'needs_revision') {
      return {
        text: t('dashboard.fixTaskText', { task: pick(task.title) }),
        label: t('dashboard.fixTask'),
        to: `/tasks#${task.id}`,
        meta: taskMeta,
      };
    }
    if (!plan || (plan.stepsDone === 0 && trackSubs.length === 0)) {
      return {
        text: t('dashboard.openPlanText', { track: pick(track.name), level: levelName }),
        label: t('dashboard.openPlan'),
        to: '/plan',
        meta: plan ? steps : null,
      };
    }
    if (task) {
      return {
        text: t('dashboard.nextTaskText', { task: pick(task.title) }),
        label: t('dashboard.nextTask'),
        to: `/tasks#${task.id}`,
        meta: taskMeta,
      };
    }
    if (plan.stepsDone < plan.stepsTotal) {
      return {
        text: t('dashboard.continuePlanText', { track: pick(track.short), level: levelName }),
        label: t('dashboard.openPlan'),
        to: '/plan',
        meta: steps,
      };
    }
    return { text: t('dashboard.allTasksText'), label: t('dashboard.goTasks'), to: '/tasks', meta: taskMeta };
  })();

  const otherTracks = (tracks.data || []).filter((tr) => tr.id !== user.chosenTrack);

  return (
    <div className="page" style={{ '--track-base': track?.color || 'var(--ink)' }}>
      <header className="page-head">
        <h1 className="page-title">{t('dashboard.hello', { name: firstName })}</h1>
      </header>

      <section aria-labelledby="journey-title" className="panel panel--journey">
        <h2 id="journey-title" className="panel__title">
          {t('dashboard.journey')}
        </h2>
        <JourneyLine stations={stations} color={track?.color} />
      </section>

      <div className="grid-2">
        <section className="panel next-step" aria-labelledby="next-title">
          <h2 id="next-title" className="panel__title">
            {t('dashboard.nextTitle')}
          </h2>
          <p>{next.text}</p>
          {next.meta && (
            <p className="next-step__meta">
              {next.meta.icon === 'clock' ? <ClockIcon /> : <StepsIcon />}
              {next.meta.text}
            </p>
          )}
          <Link to={next.to} className="btn btn--primary">
            {next.label}
          </Link>
        </section>

        <section className="panel" aria-labelledby="where-title">
          <h2 id="where-title" className="sr-only">
            {t('dashboard.yourTrack')}
          </h2>
          <dl className="facts">
            <div>
              <dt>{t('dashboard.yourTrack')}</dt>
              <dd>{track ? <TrackChip track={track} /> : t('dashboard.notYet')}</dd>
            </div>
            <div>
              <dt>{t('dashboard.yourLevel')}</dt>
              <dd>{level ? <LevelBadge level={level.level} /> : t('dashboard.notYet')}</dd>
            </div>
          </dl>
          {trackResult && (
            <Link to="/track-result" className="text-link">
              {t('dashboard.changeTrack')}
            </Link>
          )}
        </section>
      </div>

      <section className="panel" aria-labelledby="tasks-title">
        <div className="panel__head">
          <h2 id="tasks-title" className="panel__title">
            {t('dashboard.tasksTitle')}
          </h2>
          <Link to="/tasks" className="text-link">
            {t('dashboard.goTasks')}
          </Link>
        </div>
        {summary.submitted === 0 ? (
          <EmptyState compact art="start" text={level ? t('dashboard.noTasksYet') : t('dashboard.tasksAfterLevel')} />
        ) : (
          <dl className="counts">
            <div>
              <dt>{t('dashboard.submitted')}</dt>
              <dd>{summary.submitted}</dd>
            </div>
            <div>
              <dt>{t('dashboard.approved')}</dt>
              <dd>{summary.approved}</dd>
            </div>
            <div>
              <dt>{t('dashboard.pending')}</dt>
              <dd>{summary.pending}</dd>
            </div>
            <div>
              <dt>{t('dashboard.needsRevision')}</dt>
              <dd>{summary.needsRevision}</dd>
            </div>
          </dl>
        )}
      </section>

      <Badges badges={badges} />

      {track && (
        <section className="panel" aria-labelledby="other-title">
          <h2 id="other-title" className="panel__title">
            {t('dashboard.otherTracks')}
          </h2>
          <p className="muted">{t('dashboard.otherTracksText')}</p>
          <ul className="other-tracks">
            {otherTracks.map((tr) => {
              const r = levelResults[tr.id];
              return (
                <li key={tr.id}>
                  <Link to={r ? `/level-result/${tr.id}` : `/level-test/${tr.id}`} className="other-tracks__link">
                    <TrackChip track={tr} />
                    {r ? <LevelBadge level={r.level} /> : <span className="muted">{t('dashboard.startLevel')}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
