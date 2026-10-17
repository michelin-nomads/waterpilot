import { Icon } from '../../components/Icon/Icon';
import { PLANNING_MODE_OPTIONS, type PlanningMode } from './planningMode';
import styles from './PlanningModeToggle.module.scss';

interface Props {
  mode: PlanningMode;
  onChange: (mode: PlanningMode) => void;
}

const MODE_HELP: Record<PlanningMode, string> = {
  traditional: 'Build your plan yourself, step by step.',
  agent: 'Plan with AI assistance. You can make changes yourself anytime.',
};

const TOGGLE_OPTIONS = [...PLANNING_MODE_OPTIONS].reverse();

/** Two compact, keyboard-operable icon radios for switching the current session's view. */
export function PlanningModeToggle({ mode, onChange }: Props) {
  return (
    <fieldset className={styles.group} aria-label="Planning mode">
      {TOGGLE_OPTIONS.map((option) => (
        <label
          key={option.id}
          className={styles.option}
          data-active={mode === option.id}
          title={`${option.label}: ${MODE_HELP[option.id]}`}
        >
          <input
            type="radio"
            name="planning-mode"
            value={option.id}
            checked={mode === option.id}
            aria-label={`${option.label}: ${MODE_HELP[option.id]}`}
            onChange={() => onChange(option.id)}
          />
          <span className={styles.icon} aria-hidden="true">
            <Icon name={option.icon} size="md" />
          </span>
          <span className={styles.tooltip} role="tooltip">
            <strong>{option.label}</strong>
            <span>{MODE_HELP[option.id]}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
