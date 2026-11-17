import { Link } from 'react-router-dom';
import { useLang } from '../i18n/LanguageContext.jsx';

// The student's journey drawn as stations on one line, coloured
// with their track's colour up to the current station.
export default function JourneyLine({ stations, color }) {
  const { t } = useLang();
  const currentIndex = stations.findIndex((s) => !s.done);
  const progress = currentIndex === -1 ? stations.length - 1 : currentIndex;

  return (
    <ol
      className="journey"
      style={{ '--track-base': color || 'var(--ink)', '--progress': progress / (stations.length - 1) }}
    >
      {stations.map((s, i) => {
        const state = s.done ? 'done' : i === currentIndex ? 'current' : 'todo';
        const label = (
          <>
            <span className="journey__dot" aria-hidden="true">
              {i + 1}
            </span>
            <span className="journey__label">{t(`dashboard.stations.${s.key}`)}</span>
            {s.value && <span className="journey__value">{s.value}</span>}
          </>
        );
        return (
          <li
            key={s.key}
            className={`journey__station is-${state}`}
            aria-current={state === 'current' ? 'step' : undefined}
          >
            {s.to && state !== 'todo' ? (
              <Link to={s.to} className="journey__link">
                {label}
              </Link>
            ) : (
              <span className="journey__link">{label}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
