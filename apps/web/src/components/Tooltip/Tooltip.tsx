import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

import { Icon } from '../Icon/Icon';
import styles from './Tooltip.module.scss';

const VIEWPORT_MARGIN = 8;

interface TooltipProps {
  /** Accessible name of the info button, e.g. "About water stress". */
  label: string;
  /** Short explanatory text; also exposed as the button's description. */
  children: ReactNode;
  /** Optional text trigger in place of the information icon. */
  trigger?: ReactNode;
}

/**
 * Info-icon tooltip. Opens on hover, keyboard focus or tap; Escape closes it. The text is
 * always linked through `aria-describedby`, so screen readers get it without hovering.
 * An open tip shifts sideways to stay inside the viewport.
 */
export function Tooltip({ label, children, trigger }: TooltipProps) {
  const id = useId();
  const tipRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [shift, setShift] = useState(0);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useLayoutEffect(() => {
    const tip = tipRef.current;
    if (!open || !tip) {
      setShift(0);
      return;
    }
    // The shift is reset to 0 whenever the tip closes, so this measures the centred position.
    const rect = tip.getBoundingClientRect();
    const viewport = document.documentElement.clientWidth;
    const overRight = rect.right - (viewport - VIEWPORT_MARGIN);
    const overLeft = VIEWPORT_MARGIN - rect.left;
    setShift(overRight > 0 ? -overRight : overLeft > 0 ? overLeft : 0);
  }, [open]);

  return (
    <span
      className={`${styles.wrapper} ${trigger ? styles.textWrapper : ''}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className={trigger ? styles.textTrigger : styles.trigger}
        aria-label={label}
        aria-describedby={id}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((value) => !value)}
      >
        {trigger ?? <Icon name="info" size="sm" />}
      </button>
      <span
        ref={tipRef}
        id={id}
        role="tooltip"
        className={styles.tip}
        data-open={open}
        style={{ '--tip-shift': `${shift}px` } as CSSProperties}
      >
        {children}
      </span>
    </span>
  );
}
