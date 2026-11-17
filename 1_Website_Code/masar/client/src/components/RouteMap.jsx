import { useLang } from '../i18n/LanguageContext.jsx';

// The home page "transit map": four track lines leave one station
// together and branch to their own destinations.
const W = 420;
const ORIGIN_Y = 338;
const SPLIT_Y = 236;
const END_Y = 58;

export default function RouteMap({ tracks }) {
  const { t, pick, dir } = useLang();
  const list = tracks || [];
  const ordered = dir === 'rtl' ? [...list].reverse() : list;
  const n = ordered.length || 4;
  const gap = 12;

  return (
    <figure className="route-map" aria-label={list.map((tr) => pick(tr.name)).join('، ')}>
      <svg viewBox={`0 0 ${W} 380`} role="presentation">
        {ordered.map((track, i) => {
          const ox = W / 2 + (i - (n - 1) / 2) * gap;
          const tx = 56 + i * ((W - 112) / Math.max(1, n - 1));
          const d = `M${ox} ${ORIGIN_Y} V${SPLIT_Y} C${ox} ${SPLIT_Y - 70} ${tx} ${SPLIT_Y - 70} ${tx} ${SPLIT_Y - 140} V${END_Y}`;
          return (
            <g key={track.id} style={{ '--track-base': track.color, '--i': i }}>
              <path className="route-map__line" d={d} pathLength="1" />
              <circle className="route-map__stop" cx={tx} cy={SPLIT_Y - 140} r="6" />
              <circle className="route-map__end" cx={tx} cy={END_Y} r="13" />
              <text className="route-map__label" x={tx} y={END_Y - 26} textAnchor="middle">
                {pick(track.short)}
              </text>
            </g>
          );
        })}
        <rect className="route-map__pulse" x={W / 2 - 34} y={ORIGIN_Y - 14} width="68" height="28" rx="14" />
        <rect className="route-map__origin" x={W / 2 - 34} y={ORIGIN_Y - 14} width="68" height="28" rx="14" />
        <text className="route-map__here" x={W / 2} y={ORIGIN_Y + 44} textAnchor="middle">
          {t('home.youAreHere')}
        </text>
      </svg>
    </figure>
  );
}
