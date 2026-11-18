/**
 * Live matchMedia for the visitor's reduced-motion setting.
 * Canvas games read `.matches` to tone down screen shake and camera motion,
 * which CSS `prefers-reduced-motion` blocks cannot reach.
 */
export const motionQuery =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : { matches: false };

export const prefersReducedMotion = () => Boolean(motionQuery.matches);
