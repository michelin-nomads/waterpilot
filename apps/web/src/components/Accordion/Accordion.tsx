import { useId, useState, type ReactNode } from 'react';

import { Icon, type IconName } from '../Icon/Icon';
import styles from './Accordion.module.scss';

export interface AccordionItem {
  id: string;
  title: ReactNode;
  summary?: ReactNode;
  icon?: IconName;
  content: ReactNode;
}

interface AccordionProps {
  items: readonly AccordionItem[];
  /** Ids expanded initially (uncontrolled). */
  defaultExpanded?: readonly string[];
  /** Controlled expansion; pair with `onExpandedChange`. */
  expanded?: readonly string[];
  onExpandedChange?: (expanded: string[]) => void;
  headingLevel?: 2 | 3 | 4;
  /** Shows 1, 2, 3… beside each item, as in the Make It Happen reference. */
  numbered?: boolean;
}

export function Accordion({
  items,
  defaultExpanded = [],
  expanded: controlled,
  onExpandedChange,
  headingLevel = 3,
  numbered = false,
}: AccordionProps) {
  const baseId = useId();
  const [uncontrolled, setUncontrolled] = useState<string[]>([...defaultExpanded]);
  const expanded = controlled ?? uncontrolled;
  const Heading = `h${headingLevel}` as const;

  const toggle = (id: string) => {
    const next = expanded.includes(id) ? expanded.filter((x) => x !== id) : [...expanded, id];
    if (controlled === undefined) setUncontrolled(next);
    onExpandedChange?.(next);
  };

  return (
    <div className={styles.accordion}>
      {items.map((item, index) => {
        const open = expanded.includes(item.id);
        const buttonId = `${baseId}-${item.id}-button`;
        const panelId = `${baseId}-${item.id}-panel`;
        return (
          <div key={item.id} className={styles.item} data-open={open}>
            <Heading className={styles.heading}>
              <button
                id={buttonId}
                type="button"
                className={styles.trigger}
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => toggle(item.id)}
              >
                {numbered && <span className={styles.number}>{index + 1}</span>}
                {item.icon && (
                  <span className={styles.icon}>
                    <Icon name={item.icon} />
                  </span>
                )}
                <span className={styles.text}>
                  <span className={styles.title}>{item.title}</span>
                  {item.summary && <span className={styles.summary}>{item.summary}</span>}
                </span>
                <span className={styles.chevron}>
                  <Icon name="chevron-down" />
                </span>
              </button>
            </Heading>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              className={styles.panel}
              hidden={!open}
            >
              {item.content}
            </div>
          </div>
        );
      })}
    </div>
  );
}
