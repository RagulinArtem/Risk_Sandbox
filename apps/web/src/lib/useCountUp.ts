import { useEffect, useState } from "react";

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** Animates from `from` to `to` (ease-out) whenever `runKey` changes; lands
 * exactly on `to`. Instant when the user prefers reduced motion. */
export function useCountUp(from: number, to: number, runKey: unknown, durationMs = 1400): number {
  const [value, setValue] = useState(to);
  useEffect(() => {
    // Reduced motion, or a background tab (where requestAnimationFrame is
    // paused): show the final number straight away.
    if (prefersReducedMotion() || document.hidden) {
      setValue(to);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(t >= 1 ? to : from + (to - from) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    setValue(from);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // runKey (a new result object per Run) is what replays the animation
  }, [runKey, from, to, durationMs]);
  return value;
}

export function reducedMotion(): boolean {
  return prefersReducedMotion();
}
