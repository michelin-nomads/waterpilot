import { useId, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { useDismissable } from '../../lib/useDismissable';
import { Icon } from '../Icon/Icon';
import styles from './ActionMenu.module.scss';

export type ActionMenuItem =
  | { id: string; label: ReactNode; to: string; onSelect?: never; danger?: never }
  | { id: string; label: ReactNode; onSelect: () => void; to?: never; danger?: boolean };

interface ActionMenuProps {
  /** Names the trigger, e.g. "Actions for Koramangala Water Plan". */
  label: string;
  items: readonly ActionMenuItem[];
}

/**
 * A "more actions" disclosure: a short list of links and buttons opened from an icon
 * button. Escape or an outside press closes it and Escape returns focus to the trigger.
 * Not a WAI-ARIA menu (no roving focus): every item is an ordinary tabbable control.
 */
export function ActionMenu({ label, items }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useDismissable(open, rootRef, (reason) => {
    setOpen(false);
    if (reason === 'escape') triggerRef.current?.focus();
  });

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="more" />
      </button>
      <ul id={panelId} className={styles.panel} hidden={!open}>
        {items.map((item) => (
          <li key={item.id}>
            {item.to !== undefined ? (
              <Link className={styles.item} to={item.to} onClick={() => setOpen(false)}>
                {item.label}
              </Link>
            ) : (
              <button
                type="button"
                className={styles.item}
                data-danger={item.danger || undefined}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              >
                {item.label}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
