import { useLang } from '../i18n/LanguageContext.jsx';
import BadgeIcon from './BadgeIcon.jsx';

// The four progress badges on the student dashboard.
// Earned badges are filled in the track colour; the rest show how to earn them.
export default function Badges({ badges }) {
  const { t, formatDate } = useLang();
  if (!badges?.length) return null;
  const earned = badges.filter((b) => b.earned).length;

  return (
    <section className="panel" aria-labelledby="badges-title">
      <div className="panel__head">
        <h2 id="badges-title" className="panel__title">
          {t('badges.title')}
        </h2>
        <span className="muted">{t('badges.count', { n: earned, total: badges.length })}</span>
      </div>
      <ul className="badges">
        {badges.map((b) => (
          <li key={b.id} className={`badge-item${b.earned ? ' is-earned' : ''}`}>
            <span className="badge-item__icon" aria-hidden="true">
              <BadgeIcon id={b.id} />
            </span>
            <span className="badge-item__text">
              <span className="badge-item__name">{t(`badges.items.${b.id}.name`)}</span>
              <span className="badge-item__state">
                {b.earned
                  ? t('badges.earned', { date: formatDate(b.earnedAt) })
                  : `${t('badges.locked')}. ${t(`badges.items.${b.id}.how`)}`}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
