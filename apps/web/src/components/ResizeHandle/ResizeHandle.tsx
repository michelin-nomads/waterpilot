import { useRef, type KeyboardEvent, type PointerEvent } from 'react';

import styles from './ResizeHandle.module.scss';

interface ResizeHandleProps {
  /** Current size of the controlled pane, in CSS pixels. */
  value: number;
  min: number;
  max: number;
  /** Size restored by Enter. */
  defaultValue: number;
  onChange: (value: number) => void;
  /** Accessible name, e.g. "Resize conversation pane". */
  label: string;
  /** Spoken value, e.g. (px) => `Conversation pane ${px} pixels wide`. */
  valueText: (value: number) => string;
  /** id of the pane being resized. */
  controls: string;
  step?: number;
  largeStep?: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Focusable vertical separator (WAI-ARIA window splitter) that resizes the pane on its
 * left. ←/→ adjust by `step` (Shift: `largeStep`), Home/End jump to the limits, Enter
 * restores the default; pointer drag uses pointer capture.
 */
export function ResizeHandle({
  value,
  min,
  max,
  defaultValue,
  onChange,
  label,
  valueText,
  controls,
  step = 16,
  largeStep = 64,
}: ResizeHandleProps) {
  const drag = useRef<{ startX: number; startValue: number } | null>(null);
  const current = clamp(value, min, max);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const delta = event.shiftKey ? largeStep : step;
    const next: Record<string, number> = {
      ArrowLeft: current - delta,
      ArrowRight: current + delta,
      Home: min,
      End: max,
      Enter: defaultValue,
    };
    if (!(event.key in next)) return;
    event.preventDefault();
    onChange(clamp(next[event.key] ?? current, min, max));
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus();
    drag.current = { startX: event.clientX, startValue: current };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    onChange(clamp(drag.current.startValue + event.clientX - drag.current.startX, min, max));
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-label={label}
      aria-controls={controls}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={current}
      aria-valuetext={valueText(current)}
      className={styles.handle}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <span className={styles.line} aria-hidden="true" />
    </div>
  );
}
