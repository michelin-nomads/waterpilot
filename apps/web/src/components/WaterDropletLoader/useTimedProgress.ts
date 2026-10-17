import { useEffect, useRef, useState } from 'react';

/**
 * Fills from 0 to 1 over `durationMs`, one animation frame at a time, then calls
 * `onComplete` once. With reduced motion the fill is immediate. Kept apart from the
 * loader so the drawing never depends on where its progress comes from.
 */
export function useTimedProgress(durationMs: number, onComplete?: () => void): number {
  const [progress, setProgress] = useState(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setProgress(1);
      onCompleteRef.current?.();
      return;
    }

    let frameId = 0;
    let startTime: number | undefined;

    const animate = (timestamp: number) => {
      startTime ??= timestamp;
      const next = Math.min((timestamp - startTime) / Math.max(durationMs, 1), 1);
      setProgress(next);
      if (next < 1) {
        frameId = window.requestAnimationFrame(animate);
      } else {
        onCompleteRef.current?.();
      }
    };

    frameId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frameId);
  }, [durationMs]);

  return progress;
}
