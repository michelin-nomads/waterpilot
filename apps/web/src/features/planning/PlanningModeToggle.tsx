import { useId } from 'react';

import { Icon, type IconName } from '../../components/Icon/Icon';
import type { PlanningMode } from './planningMode';
import styles from './PlanningModeToggle.module.scss';

const OPTIONS: ReadonlyArray<{ id: PlanningMode; label: string; icon: IconName }> = [
  { id: 'traditional', label: 'Traditional', icon: 'list' },
  { id: 'agent', label: 'Agent', icon: 'sparkle' },
];

interface Props {
  mode: PlanningMode;
  onChange: (mode: PlanningMode) => void;
}

/** Segmented control built on native radios, so arrow-key behaviour comes from the browser. */
export function PlanningModeToggle({ mode, onChange }: Props) {
  const name = useId();
  return (
    <fieldset className={styles.toggle}>
      <legend className={styles.legend}>Planning mode</legend>
      <div className={styles.options}>
        {OPTIONS.map((option) => (
          <label key={option.id} className={styles.option}>
            <input
              type="radio"
              name={name}
              value={option.id}
              checked={mode === option.id}
              onChange={() => onChange(option.id)}
            />
            <Icon name={option.icon} size="sm" />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
