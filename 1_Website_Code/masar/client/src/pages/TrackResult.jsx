import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { useLang } from '../i18n/LanguageContext.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { useAsync, useTracks } from '../hooks.js';
import { ErrorState, FormError, Loading } from '../components/States.jsx';
import { Meter, trackById } from '../components/Bits.jsx';
import CountUp from '../components/CountUp.jsx';

export default function TrackResult() {
  const { t, pick } = useLang();
  const { user, setUser } = useAuth();
  const location = useLocation();
  const fromQuiz = location.state?.result;
  const progress = useAsync(
    () => (fromQuiz ? Promise.resolve({ trackResult: fromQuiz }) : api('/me/progress')),
    [fromQuiz]
  );
  const tracks = useTracks();
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState(null);

  if (progress.loading || tracks.loading) return <Loading />;
  if (progress.error || tracks.error)
    return <ErrorState error={progress.error || tracks.error} onRetry={progress.reload} />;

  const result = progress.data.trackResult;
  if (!result) {
    return (
      <div className="page page--narrow">
        <h1 className="page-title">{t('trackResult.title')}</h1>
        <p>{t('trackResult.none')}</p>
        <Link to="/track-quiz" className="btn btn--primary">
          {t('dashboard.startQuiz')}
        </Link>
      </div>
    );
  }

  const best = trackById(tracks.data, result.recommendedTrack);
  const chosen = trackById(tracks.data, user.chosenTrack);

  const choose = async (trackId) => {
    setSaving(trackId);
    setError(null);
    try {
      const d = await api('/me/track', { method: 'PUT', body: { track: trackId } });
      setUser(d.user);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="page page--narrow" style={{ '--track-base': best.color }}>
      <header className="page-head">
        <h1 className="page-title">{t('trackResult.title')}</h1>
      </header>

      <section className="result-hero result-hero--reveal">
        <div className="result-line" aria-hidden="true">
          <span className="result-line__track" />
          <span className="result-line__stop" style={{ '--at': '0%' }} />
          <span className="result-line__stop" style={{ '--at': '50%' }} />
          <span className="result-line__stop result-line__stop--end" style={{ '--at': '100%' }} />
        </div>
        <p className="result-hero__label">{t('trackResult.best')}</p>
        <p className="result-hero__track">{pick(best.name)}</p>
        <p className="result-hero__score">
          <CountUp value={result.scores[0].percent} format={(n) => t('trackResult.match', { n })} delay={300} />
        </p>
        <p className="result-hero__text">{pick(best.description)}</p>
      </section>

      {result.reasons?.length > 0 && (
        <section className="reasons" aria-labelledby="why-title">
          <h2 id="why-title" className="section__title section__title--sm">
            {t('trackResult.why', { track: pick(best.short) })}
          </h2>
          <ul className="reasons__list">
            {result.reasons.map((r, i) => (
              <li key={r.questionId} className="reasons__item" style={{ '--delay': `${900 + i * 150}ms` }}>
                <span className="reasons__q">{pick(r.question)}</span>
                <span className="reasons__a">
                  {t('trackResult.youAnswered')} <strong>{pick(r.answer)}</strong>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {result.closeMatch && <p className="notice">{t('trackResult.close')}</p>}

      <section aria-labelledby="all-title">
        <h2 id="all-title" className="section__title section__title--sm">
          {t('trackResult.all')}
        </h2>
        <ul className="match-list">
          {result.scores.map((s, i) => {
            const tr = trackById(tracks.data, s.track);
            const isChosen = user.chosenTrack === s.track;
            return (
              <li key={s.track} className="match-list__item" style={{ '--track-base': tr.color }}>
                <div className="match-list__top">
                  <span className="match-list__name">{pick(tr.name)}</span>
                  <span className="match-list__pct">
                    <CountUp value={s.percent} format={(n) => t('common.percent', { n })} delay={500 + i * 150} />
                  </span>
                </div>
                <Meter
                  value={s.percent}
                  color={tr.color}
                  label={`${pick(tr.name)} ${s.percent}%`}
                  reveal
                  delay={500 + i * 150}
                />
                <div className="match-list__actions">
                  {isChosen ? (
                    <span className="chosen-mark">{t('trackResult.current')}</span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn--small btn--ghost"
                      onClick={() => choose(s.track)}
                      disabled={!!saving}
                    >
                      {t('trackResult.choose')}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <FormError error={error} />
      </section>

      <div className="page-actions">
        {chosen && (
          <Link to={`/level-test/${chosen.id}`} className="btn btn--primary">
            {t('trackResult.startLevel', { track: pick(chosen.short) })}
          </Link>
        )}
        <Link to="/track-quiz" className="btn btn--ghost">
          {t('trackResult.retake')}
        </Link>
      </div>
    </div>
  );
}
