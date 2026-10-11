import { useId } from 'react';

import { Badge, Button } from '../../components';
import type { ScenarioComparisonFieldsFragment } from '../../graphql/generated/graphql';
import type { SessionState } from '../../session/sessionState';
import { ScenarioRows } from './ScenarioRows';
import styles from './Plans.module.scss';

interface Props {
  saved: ScenarioComparisonFieldsFragment;
  scenario: SessionState['scenario'];
  agentMode: boolean;
  onOpenAgent: () => void;
}

/**
 * A what-if saved from Agent mode, shown read-only in the shared workspace and labelled as
 * agent-generated. Traditional mode has no what-if controls; it can only open Agent mode.
 */
export function ScenarioResult({ saved, scenario, agentMode, onOpenAgent }: Props) {
  const id = useId();
  if (saved.status === 'none') return null;
  const awaiting = saved.status === 'awaiting_confirmation';
  return (
    <section
      className={styles.panel}
      aria-labelledby={`${id}-title`}
      data-scenario-result={saved.status}
    >
      <div className={styles.head}>
        <h2 id={`${id}-title`} className={styles.title}>
          What-if from Agent mode
        </h2>
        <Badge tone={awaiting ? 'neutral' : 'accent'}>
          {awaiting ? 'Agent-generated · not confirmed' : 'Agent-generated'}
        </Badge>
      </div>
      <p className={styles.muted}>
        {awaiting
          ? 'Waiting for your confirmation in Agent mode. The plans above ignore it until then.'
          : 'The plans above are compared under this what-if. Your baseline itself is unchanged.'}{' '}
        Calculated by the deterministic scenario engine ({saved.engineVersion}), not by a language
        model.
      </p>
      {scenario?.interpretedFrom && (
        <p className={styles.text}>Prepared from: “{scenario.interpretedFrom}”</p>
      )}
      <ScenarioRows comparison={saved} />
      {!agentMode && (
        <div className={styles.actions}>
          <p className={styles.muted}>To change, confirm or remove it, open Agent mode.</p>
          <Button variant="secondary" size="sm" startIcon="sparkle" onClick={onOpenAgent}>
            Open Agent mode
          </Button>
        </div>
      )}
    </section>
  );
}
