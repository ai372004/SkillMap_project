import { useLang } from '../i18n/LanguageContext.jsx';
import { useErrorText } from '../hooks.js';

const Bar = ({ w = '100%', h = 14, className = '' }) => (
  <span className={`skel ${className}`} style={{ inlineSize: w, blockSize: h }} />
);

// The shape of each kind of page while it loads, in place of a spinner.
const SHAPES = {
  page: (
    <>
      <Bar w="38%" h={30} className="skel--title" />
      <Bar w="62%" />
      <div className="skeleton__grid">
        {[0, 1].map((i) => (
          <div key={i} className="skeleton__card">
            <Bar w="45%" h={18} />
            <Bar />
            <Bar w="80%" />
            <Bar w="34%" h={38} className="skel--pill" />
          </div>
        ))}
      </div>
      <div className="skeleton__card">
        <Bar w="30%" h={18} />
        <Bar />
        <Bar w="70%" />
      </div>
    </>
  ),
  quiz: (
    <>
      <Bar w="44%" h={30} className="skel--title" />
      <Bar h={10} className="skel--pill" />
      <Bar w="76%" h={22} />
      {[0, 1, 2, 3].map((i) => (
        <Bar key={i} h={54} className="skel--option" />
      ))}
    </>
  ),
  rows: (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <Bar key={i} h={44} />
      ))}
    </>
  ),
  table: (
    <>
      <Bar w="30%" h={30} className="skel--title" />
      <div className="skeleton__row">
        <Bar w="40%" h={40} />
        <Bar w="22%" h={40} />
      </div>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Bar key={i} h={44} />
      ))}
    </>
  ),
};

// Shown only if loading takes longer than a blink (see .skeleton in the CSS).
// Screen readers hear "Loading…" once; the grey shapes are hidden from them.
export function Loading({ shape = 'page' }) {
  const { t } = useLang();
  return (
    <div className={`skeleton skeleton--${shape}`} role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{t('common.loading')}</span>
      <div className="skeleton__shape" aria-hidden="true">
        {SHAPES[shape] || SHAPES.page}
      </div>
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  const { t } = useLang();
  const errorText = useErrorText();
  return (
    <div className="state state--error" role="alert">
      <p>{errorText(error)}</p>
      {onRetry && (
        <button type="button" className="btn btn--ghost" onClick={onRetry}>
          {t('common.retry')}
        </button>
      )}
    </div>
  );
}

export function FormError({ error }) {
  const errorText = useErrorText();
  if (!error) return null;
  return (
    <p className="form-error" role="alert">
      {errorText(error)}
    </p>
  );
}
