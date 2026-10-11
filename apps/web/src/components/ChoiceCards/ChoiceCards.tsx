import { useId, type ReactNode } from 'react';

import { Icon, type IconName } from '../Icon/Icon';
import styles from './ChoiceCards.module.scss';

export interface ChoiceOption<V extends string> {
  value: V;
  title: string;
  description?: ReactNode;
  icon?: IconName;
  /** Small label such as a Badge; never the only carrier of meaning. */
  badge?: ReactNode;
  /** When set, the option is shown but cannot be chosen, and this explains why. */
  disabledReason?: string;
}

interface ChoiceCardsProps<V extends string> {
  legend: ReactNode;
  /** Visually hide the legend when a visible heading already names the group. */
  hideLegend?: boolean;
  hint?: ReactNode;
  options: readonly ChoiceOption<V>[];
  value: V | null;
  onChange: (value: V) => void;
  /** Cards per row from tablet width up; one per row below that. */
  columns?: 2 | 3;
}

/**
 * Single choice presented as cards (mode chooser, goal presets, plan choice). Native radio
 * inputs supply the keyboard model (arrow keys move, Space selects) and announcements.
 */
export function ChoiceCards<V extends string>({
  legend,
  hideLegend = false,
  hint,
  options,
  value,
  onChange,
  columns = 2,
}: ChoiceCardsProps<V>) {
  const name = useId();
  const hintId = hint ? `${name}-hint` : undefined;

  return (
    <fieldset className={styles.fieldset} aria-describedby={hintId}>
      <legend className={hideLegend ? styles.hiddenLegend : styles.legend}>{legend}</legend>
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      <div className={`${styles.grid} ${styles[`cols${columns}`]}`}>
        {options.map((option) => {
          const id = `${name}-${option.value}`;
          const reasonId = option.disabledReason ? `${id}-reason` : undefined;
          const descriptionId = option.description ? `${id}-description` : undefined;
          const disabled = Boolean(option.disabledReason);
          return (
            <label
              key={option.value}
              htmlFor={id}
              className={styles.card}
              data-disabled={disabled || undefined}
            >
              <input
                id={id}
                type="radio"
                name={name}
                value={option.value}
                className={styles.input}
                checked={value === option.value}
                disabled={disabled}
                aria-describedby={[descriptionId, reasonId].filter(Boolean).join(' ') || undefined}
                onChange={() => {
                  if (!disabled) onChange(option.value);
                }}
              />
              {option.icon && (
                <span className={styles.icon}>
                  <Icon name={option.icon} />
                </span>
              )}
              <span className={styles.content}>
                <span className={styles.titleRow}>
                  <span className={styles.title}>{option.title}</span>
                  {option.badge}
                </span>
                {option.description && (
                  <span id={descriptionId} className={styles.description}>
                    {option.description}
                  </span>
                )}
                {option.disabledReason && (
                  <span id={reasonId} className={styles.reason}>
                    {option.disabledReason}
                  </span>
                )}
              </span>
              <span className={styles.check} aria-hidden="true">
                <Icon name="check" size="sm" />
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
