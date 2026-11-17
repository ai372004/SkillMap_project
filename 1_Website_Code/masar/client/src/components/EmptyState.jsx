// A calm empty or "not found" state drawn as a small metro line, so empty
// pages still feel like part of the journey. `art` picks the drawing:
//   start  the line is waiting for its first stations (nothing here yet)
//   done   every station is lit (all caught up)
//   lost   the line runs out (page not found)
function MetroArt({ art }) {
  return (
    <svg className={`empty__art empty__art--${art}`} viewBox="0 0 200 56" aria-hidden="true" focusable="false">
      {art === 'done' && (
        <>
          <path className="empty__line" d="M14 28 H186" />
          <circle className="empty__stop is-lit" cx="14" cy="28" r="7" />
          <circle className="empty__stop is-lit" cx="100" cy="28" r="7" />
          <circle className="empty__stop is-lit is-end" cx="186" cy="28" r="12" />
          <path className="empty__tick" d="M180 28.5l4.2 4.2 7.8-8.7" />
        </>
      )}
      {art === 'start' && (
        <>
          <path className="empty__line" d="M14 28 H74" />
          <path className="empty__line empty__line--todo" d="M74 28 H186" />
          <circle className="empty__stop is-lit" cx="14" cy="28" r="7" />
          <circle className="empty__stop" cx="110" cy="28" r="7" />
          <circle className="empty__stop" cx="186" cy="28" r="7" />
          <g className="empty__train">
            <rect x="34" y="18" width="32" height="20" rx="10" />
            <rect className="empty__window" x="52" y="23" width="9" height="6" rx="2" />
          </g>
        </>
      )}
      {art === 'lost' && (
        <>
          <path className="empty__line" d="M14 28 H100" />
          <path className="empty__line empty__line--fade" d="M118 28 H136 M152 28 H166 M180 28 H188" />
          <circle className="empty__stop is-lit" cx="14" cy="28" r="7" />
          <circle className="empty__stop" cx="100" cy="28" r="7" />
        </>
      )}
    </svg>
  );
}

export default function EmptyState({ art = 'start', title, text, children, compact = false, headingLevel = 2 }) {
  const Heading = `h${headingLevel}`;
  return (
    <div className={`empty${compact ? ' empty--compact' : ''}`}>
      <MetroArt art={art} />
      <div className="empty__body">
        {title && <Heading className="empty__title">{title}</Heading>}
        {text && <p className="empty__text">{text}</p>}
        {children && <div className="empty__actions">{children}</div>}
      </div>
    </div>
  );
}
