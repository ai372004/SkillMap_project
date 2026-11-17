import { Link } from 'react-router-dom';
import { useLang } from '../i18n/LanguageContext.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { useTracks } from '../hooks.js';
import RouteMap from '../components/RouteMap.jsx';

export default function Home() {
  const { t, pick } = useLang();
  const { user, ready } = useAuth();
  const { data: tracks } = useTracks();
  const steps = t('home.steps');

  return (
    <>
      <section className="hero">
        <div className="hero__text">
          <h1 className="hero__title">{t('home.title')}</h1>
          <p className="hero__lead">{t('home.lead')}</p>
          <div className="hero__actions">
            {!ready ? null : user ? (
              <Link to="/dashboard" className="btn btn--primary btn--lg">
                {t('home.continue')}
              </Link>
            ) : (
              <>
                <Link to="/register" className="btn btn--primary btn--lg">
                  {t('home.start')}
                </Link>
                <Link to="/login" className="btn btn--ghost btn--lg">
                  {t('home.haveAccount')}
                </Link>
              </>
            )}
          </div>
        </div>
        <RouteMap tracks={tracks} />
      </section>

      <section className="section" aria-labelledby="how-title">
        <h2 id="how-title" className="section__title">
          {t('home.howTitle')}
        </h2>
        <ol className="steps">
          {steps.map((s, i) => (
            <li key={s.title} className="steps__item">
              <span className="steps__num" aria-hidden="true">
                {i + 1}
              </span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="section" aria-labelledby="tracks-title">
        <h2 id="tracks-title" className="section__title">
          {t('home.tracksTitle')}
        </h2>
        <p className="section__lead">{t('home.tracksLead')}</p>
        <ul className="track-list">
          {(tracks || []).map((track) => (
            <li key={track.id} className="track-list__item" style={{ '--track-base': track.color }}>
              <h3>{pick(track.name)}</h3>
              <p>{pick(track.description)}</p>
              <p className="tools">{track.tools.join(', ')}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
