import { useEffect, useState } from 'react';
import { prefersReducedMotion } from '../motion.js';

const DURATION_MS = 900;
const easeOut = (x) => 1 - Math.pow(1 - x, 3);

// A number that counts up from zero when it first appears. Screen readers get
// the final value straight away through `label`; the moving digits are hidden
// from them. With reduced motion the final number shows at once.
export default function CountUp({ value, format = (n) => n, label, delay = 0 }) {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? value : 0));

  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    let frame;
    let start;
    const tick = (now) => {
      start ??= now + delay;
      const p = Math.min(1, Math.max(0, (now - start) / DURATION_MS));
      setShown(Math.round(value * easeOut(p)));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, delay]);

  return (
    <>
      <span aria-hidden="true">{format(shown)}</span>
      <span className="sr-only">{label ?? format(value)}</span>
    </>
  );
}
