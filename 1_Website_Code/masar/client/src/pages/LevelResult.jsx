import { Link, useLocation, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useLang } from '../i18n/LanguageContext.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { useAsync, useTracks } from '../hooks.js';
import { ErrorState, Loading } from '../components/States.jsx';
import { LevelBadge, Meter, Rich, latinProps, trackById } from '../components/Bits.jsx';
import CountUp from '../components/CountUp.jsx';

export default function LevelResult() {
  const { track: trackId } = useParams();
  const { t, pick, formatDate } = useLang();
  const { user } = useAuth();
  const location = useLocation();
  const fresh = location.state?.result?.track === trackId ? location.state : null;
  const progress = useAsync(() => (fresh ? Promise.resolve(null) : api('/me/progress')), [fresh, trackId]);
  const tracks = useTracks();

  if (progress.loading || tracks.loading) return <Loading />;
  if (progress.error || tracks.error)
    return <ErrorState error={progress.error || tracks.error} onRetry={progress.reload} />;

  const track = trackById(tracks.data, trackId);
  if (!track) return <ErrorState error={{ code: 'UNKNOWN_TRACK' }} />;

  const result = fresh ? fresh.result : progress.data.levelResults[trackId];
  if (!result) {
    return (
      <div className="page page--narrow">
        <h1 className="page-title">{t('levelResult.title', { track: pick(track.name) })}</h1>
        <p>{t('levelResult.none')}</p>
        <Link to={`/level-test/${trackId}`} className="btn btn--primary">
          {t('dashboard.startLevel')}
        </Link>
      </div>
    );
  }

  const isChosen = user.chosenTrack === trackId;
  const retakeLocked = result.retakeAt && new Date(result.retakeAt) > new Date();
  const questionsById = fresh ? Object.fromEntries(fresh.questions.map((q) => [q.id, q])) : {};

  return (
    <div className="page page--narrow" style={{ '--track-base': track.color }}>
      <header className="page-head">
        <h1 className="page-title">{t('levelResult.title', { track: pick(track.name) })}</h1>
      </header>

      <section className="result-hero result-hero--reveal">
        <LevelBadge level={result.level} />
        <p className="result-hero__score result-hero__score--big">
          <CountUp value={result.percent} format={(n) => t('common.percent', { n })} delay={200} />
        </p>
        <Meter value={result.percent} color={track.color} reveal delay={200} />
        <p className="result-hero__text">
          {t('levelResult.correct', { c: result.correctCount, t: result.total })}
          <br />
          {t('levelResult.weighted', { s: result.weightedScore, m: result.maxScore })}
        </p>
      </section>

      {result.byDifficulty && (
        <section aria-labelledby="diff-title">
          <h2 id="diff-title" className="section__title section__title--sm">
            {t('levelResult.byDifficulty')}
          </h2>
          <dl className="counts">
            {['easy', 'medium', 'hard'].map((d) => (
              <div key={d}>
                <dt>{t(`difficulty.${d}`)}</dt>
                <dd>
                  {result.byDifficulty[d]?.correct ?? 0}/{result.byDifficulty[d]?.total ?? 0}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <div className="page-actions">
        {isChosen && (
          <Link to="/plan" className="btn btn--primary">
            {t('levelResult.openPlan')}
          </Link>
        )}
        {retakeLocked ? (
          <p className="muted">{t('levelResult.retakeOn', { date: formatDate(result.retakeAt) })}</p>
        ) : (
          <Link to={`/level-test/${trackId}`} className="btn btn--ghost">
            {t('levelResult.retake')}
          </Link>
        )}
      </div>

      <section aria-labelledby="review-title" className="review">
        <h2 id="review-title" className="section__title section__title--sm">
          {t('levelResult.review')}
        </h2>
        {fresh ? (
          <ol className="review__list">
            {fresh.review.map((r) => {
              const q = questionsById[r.id];
              const optionText = (id) => pick(q.options.find((o) => o.id === id)?.text);
              return (
                <li key={r.id} className={`review__item ${r.isCorrect ? 'is-right' : 'is-wrong'}`}>
                  <details>
                    <summary>
                      <span className="review__mark" aria-hidden="true">
                        {r.isCorrect ? '✓' : '✗'}
                      </span>
                      <span>
                        <Rich text={pick(q.q)} />
                      </span>
                    </summary>
                    <dl>
                      <div>
                        <dt>{t('levelResult.yourAnswer')}</dt>
                        <dd>
                          <span {...latinProps(optionText(r.chosen))}>
                            <Rich text={optionText(r.chosen)} />
                          </span>
                        </dd>
                      </div>
                      {!r.isCorrect && (
                        <div>
                          <dt>{t('levelResult.rightAnswer')}</dt>
                          <dd>
                            <span {...latinProps(optionText(r.correct))}>
                              <Rich text={optionText(r.correct)} />
                            </span>
                          </dd>
                        </div>
                      )}
                    </dl>
                    <p className="review__explain">
                      <Rich text={pick(r.explain)} />
                    </p>
                  </details>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="muted">{t('levelResult.reviewUnavailable')}</p>
        )}
      </section>
    </div>
  );
}
