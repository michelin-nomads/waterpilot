import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

import styles from './Tabs.module.scss';

export interface TabItem {
  id: string;
  label: ReactNode;
  content: ReactNode;
}

interface TabsProps {
  /** Accessible name of the tab list. */
  label: string;
  items: readonly TabItem[];
  defaultSelected?: string;
  selected?: string;
  onSelectedChange?: (id: string) => void;
}

/**
 * WAI-ARIA tabs with automatic activation: Arrow keys, Home and End move between tabs and
 * only the selected tab is in the Tab order. Inactive panels stay mounted (hidden) so
 * their state survives switching.
 */
export function Tabs({
  label,
  items,
  defaultSelected,
  selected: controlled,
  onSelectedChange,
}: TabsProps) {
  const baseId = useId();
  const [uncontrolled, setUncontrolled] = useState(defaultSelected ?? items[0]?.id);
  const selected = controlled ?? uncontrolled;
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());

  const select = (id: string, focus: boolean) => {
    if (controlled === undefined) setUncontrolled(id);
    onSelectedChange?.(id);
    if (focus) tabRefs.current.get(id)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = items.findIndex((item) => item.id === selected);
    const last = items.length - 1;
    const target =
      event.key === 'ArrowRight'
        ? (index + 1) % items.length
        : event.key === 'ArrowLeft'
          ? (index - 1 + items.length) % items.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null;
    if (target === null) return;
    event.preventDefault();
    const item = items[target];
    if (item) select(item.id, true);
  };

  return (
    <div className={styles.tabs}>
      <div role="tablist" aria-label={label} className={styles.list} onKeyDown={onKeyDown}>
        {items.map((item) => {
          const isSelected = item.id === selected;
          return (
            <button
              key={item.id}
              ref={(node) => {
                if (node) tabRefs.current.set(item.id, node);
                else tabRefs.current.delete(item.id);
              }}
              id={`${baseId}-tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-controls={`${baseId}-panel-${item.id}`}
              tabIndex={isSelected ? 0 : -1}
              className={styles.tab}
              onClick={() => select(item.id, false)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          id={`${baseId}-panel-${item.id}`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${item.id}`}
          tabIndex={0}
          hidden={item.id !== selected}
          className={styles.panel}
        >
          {item.content}
        </div>
      ))}
    </div>
  );
}
