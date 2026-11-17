import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLang } from '../i18n/LanguageContext.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { useTracks } from '../hooks.js';
import { dismissCelebration, useCelebration } from '../notifications.js';
import { trackById } from './Bits.jsx';
import BadgeIcon from './BadgeIcon.jsx';

const SHOW_MS = 6000;
// Where each badge points the student next. Badges without a link only explain.
const NEXT_LINK = { levelTest: '/plan', firstApproval: '/tasks' };

// Celebrates a badge the moment it is earned: one card at a time, closed by
// the student or after a few seconds. Hovering or focusing it holds it open.
function Toast({ id, color }) {
  const { t } = useLang();
  const { pathname } = useLocation();
  const [held, setHeld] = useState(false);
  const link = NEXT_LINK[id];

  useEffect(() => {
    if (held) return undefined;
    const timer = setTimeout(dismissCelebration, SHOW_MS);
    return () => clearTimeout(timer);
  }, [held]);

  return (
    <div
      className="toast"
      style={{ '--track-base': color }}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setHeld(false)}
    >
      <span className="toast__icon">
        <BadgeIcon id={id} size={24} />
      </span>
      <div className="toast__body">
        <p className="toast__head">
          <span className="toast__label">{t('celebrate.title')}</span>
          <span className="toast__name">{t(`badges.items.${id}.name`)}</span>
        </p>
        <p className="toast__next">{t(`celebrate.next.${id}`)}</p>
        {link && link !== pathname && (
          <Link to={link} className="toast__link" onClick={dismissCelebration}>
            {t(`celebrate.go.${id}`)}
          </Link>
        )}
      </div>
      <button type="button" className="toast__close" onClick={dismissCelebration} aria-label={t('celebrate.close')}>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>
    </div>
  );
}

export default function BadgeToast() {
  const id = useCelebration();
  const { user } = useAuth();
  const tracks = useTracks();
  const color = trackById(tracks.data, user?.chosenTrack)?.color || 'var(--primary)';

  // The live region stays in the page so screen readers announce each new card.
  return (
    <div className="toast-region" role="status" aria-live="polite">
      {id && <Toast key={id} id={id} color={color} />}
    </div>
  );
}
