import { useId } from 'react';

import { Icon } from '../Icon/Icon';
import styles from './SuggestionChips.module.scss';

export interface Suggestion<T> {
  id: string;
  label: string;
  value: T;
  /** When set, the chip is shown but cannot be chosen, and the reason is announced. */
  unavailableReason?: string;
}

interface SuggestionChipsProps<T> {
  label: string;
  suggestions: readonly Suggestion<T>[];
  /** Fills editable input; a suggestion never runs anything by itself. */
  onSelect: (value: T, suggestion: Suggestion<T>) => void;
}

export function SuggestionChips<T>({ label, suggestions, onSelect }: SuggestionChipsProps<T>) {
  const labelId = useId();
  return (
    <div className={styles.wrapper}>
      <p id={labelId} className={styles.label}>
        {label}
      </p>
      <ul className={styles.list} role="list" aria-labelledby={labelId}>
        {suggestions.map((suggestion) => {
          const reasonId = suggestion.unavailableReason ? `${labelId}-${suggestion.id}` : undefined;
          return (
            <li key={suggestion.id}>
              <button
                type="button"
                className={styles.chip}
                aria-disabled={suggestion.unavailableReason ? true : undefined}
                aria-describedby={reasonId}
                onClick={() => {
                  if (!suggestion.unavailableReason) onSelect(suggestion.value, suggestion);
                }}
              >
                <Icon name={suggestion.unavailableReason ? 'lock' : 'sparkle'} size="sm" />
                {suggestion.label}
              </button>
              {reasonId && (
                <span id={reasonId} className={styles.reason}>
                  {suggestion.unavailableReason}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
