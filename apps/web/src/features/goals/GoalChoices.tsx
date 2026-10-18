import { useId } from 'react';
import { Button, Icon, type IconName } from '../../components';
import type { GoalKind } from '../../graphql/generated/graphql';
import { KIND_LABEL } from './goalLabels';
import type { GoalDraft } from './goalDraft';
import styles from './Goals.module.scss';

const GOAL_CHOICES: readonly { kind: GoalKind; icon: IconName; description: string }[] = [
  {
    kind: 'REDUCE_SHORTAGE',
    icon: 'droplet',
    description: 'Have fewer days without enough water.',
  },
  {
    kind: 'REDUCE_TANKER_DEPENDENCE',
    icon: 'truck',
    description: 'Rely less on water delivered by tankers.',
  },
  {
    kind: 'IMPROVE_GROUNDWATER',
    icon: 'chart',
    description: 'Work towards a healthier groundwater level.',
  },
  {
    kind: 'REDUCE_WATER_BILLS',
    icon: 'wallet',
    description: 'Lower water costs for your community.',
  },
  { kind: 'REDUCE_FLOOD_RISK', icon: 'waves', description: 'Reduce the number of flood events.' },
  {
    kind: 'IMPROVE_WATER_QUALITY',
    icon: 'droplet',
    description: 'Set a target for a measured water parameter.',
  },
];

/** Choosing an outcome does not imply a numerical target, deadline or an achievable result. */
function chooseGoal(draft: GoalDraft, kind: GoalKind): GoalDraft {
  if (draft.kind === kind) return draft;
  if (kind === 'REDUCE_SHORTAGE') {
    return {
      ...draft,
      kind,
      mode: 'ABSOLUTE_LEVEL',
      unit: 'DAY',
      targetValue: draft.targetValue || '50',
      targetParameter: '',
      confirmed: false,
      also: draft.also.filter((k) => k !== kind),
    };
  }
  return {
    ...draft,
    kind,
    mode: null,
    unit: null,
    targetValue: '',
    targetParameter: '',
    confirmed: false,
    also: draft.also.filter((k) => k !== kind),
  };
}

export function GoalChoices({
  draft,
  onChange,
}: {
  draft: GoalDraft;
  onChange: (draft: GoalDraft) => void;
}) {
  const name = useId();
  return (
    <>
      <fieldset className={styles.goalChoices}>
        <legend className={styles.hidden}>Primary goal</legend>
        <div className={styles.choiceGrid}>
          {GOAL_CHOICES.map((goal) => (
            <label className={styles.goalChoice} key={goal.kind}>
              <input
                type="radio"
                name={name}
                value={goal.kind}
                checked={draft.kind === goal.kind}
                onChange={() => onChange(chooseGoal(draft, goal.kind))}
              />
              <span className={styles.choiceTop}>
                <span className={styles.choiceIcon}>
                  <Icon name={goal.icon} />
                </span>
                <span className={styles.radioMark} />
              </span>
              <strong>{KIND_LABEL[goal.kind]}</strong>
              <span className={styles.choiceDescription}>{goal.description}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className={styles.customChoice}>
        <span className={styles.muted}>Have a different outcome in mind?</span>
        <Button
          variant="ghost"
          size="sm"
          className={styles.textAction}
          aria-pressed={draft.kind === 'CUSTOM'}
          onClick={() => onChange(chooseGoal(draft, 'CUSTOM'))}
        >
          {draft.kind === 'CUSTOM' ? 'Custom goal selected' : 'Set a custom goal'}
        </Button>
      </div>
    </>
  );
}
