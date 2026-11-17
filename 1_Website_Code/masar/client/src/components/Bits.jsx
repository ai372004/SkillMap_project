import logoUrl from '../assets/skillmap-logo.png';
import { Fragment } from 'react';
import { useLang } from '../i18n/LanguageContext.jsx';

export function Logo() {
  const { t } = useLang();
  return (
    <span className="logo">
      <img className="logo__mark" src={logoUrl} alt="" width="36" height="36" />
      <span className="logo__word" dir="ltr" aria-label={t('brand')}>
        skill<span className="logo__word-accent">map</span>
      </span>
    </span>
  );
}

// A small label with the track's line colour.
export function TrackChip({ track, size }) {
  const { pick } = useLang();
  if (!track) return null;
  return (
    <span className={`track-chip${size === 'lg' ? ' track-chip--lg' : ''}`} style={{ '--track-base': track.color }}>
      <span className="track-chip__dot" aria-hidden="true" />
      {pick(track.name)}
    </span>
  );
}

export function StatusPill({ status }) {
  const { t } = useLang();
  const key = status || 'none';
  return <span className={`status status--${key}`}>{t(`status.${key}`)}</span>;
}

export function LevelBadge({ level }) {
  const { t } = useLang();
  if (!level) return null;
  const steps = { beginner: 1, intermediate: 2, advanced: 3 }[level];
  return (
    <span className="level-badge" data-level={level}>
      <span className="level-badge__bars" aria-hidden="true">
        {[1, 2, 3].map((i) => (
          <span key={i} className={i <= steps ? 'on' : ''} />
        ))}
      </span>
      {t(`levels.${level}`)}
    </span>
  );
}

// Horizontal bar used for match and score percentages.
// `reveal` fills the bar from empty when it first appears; `delay` (ms) staggers several bars.
export function Meter({ value, color, label, reveal = false, delay = 0 }) {
  return (
    <span
      className={`meter${reveal ? ' meter--reveal' : ''}`}
      role="img"
      aria-label={label || `${value}%`}
      style={{ '--track-base': color, '--delay': `${delay}ms` }}
    >
      <span className="meter__fill" style={{ inlineSize: `${Math.max(0, Math.min(100, value))}%` }} />
    </span>
  );
}

// Text with no Arabic letters (code, English names) is shown left-to-right
// so things like "[2, 4, 6]" don't get reversed in the Arabic interface.
const ARABIC = /[\u0600-\u06FF]/;
export const latinProps = (text) => (ARABIC.test(text || '') ? {} : { dir: 'ltr', className: 'latin' });

// Content marks code with backticks: "ما نتيجة `typeof []`؟".
// Code is shown as an isolated left-to-right <code> so it reads correctly
// inside Arabic sentences.
export function Rich({ text }) {
  if (!text || !text.includes('`')) return text || null;
  return text.split('`').map((part, i) =>
    i % 2 ? (
      <code key={i} dir="ltr">
        {part}
      </code>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  );
}

export const trackById = (tracks, id) => (tracks || []).find((t) => t.id === id) || null;
