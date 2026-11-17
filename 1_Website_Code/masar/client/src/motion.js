// True when the viewer asked the system for less motion. Animations in CSS
// already collapse through a media query; JavaScript-driven ones check this.
export function prefersReducedMotion() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
