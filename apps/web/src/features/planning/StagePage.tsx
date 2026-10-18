import type { ReactNode } from 'react';

import { EmptyState } from '../../components/StatePanel/StatePanel';
import { PageHeader } from '../../shell/PageHeader';
import { getStage, PLANNING_STAGES, type PlanningStage } from '../../shell/stages';
import { PlanInputNotice } from './PlanInputNotice';
import styles from './StagePage.module.scss';

interface StagePageProps {
  stageId: PlanningStage['id'] | 'baseline';
  children: ReactNode;
  title?: string;
  titleSuffix?: ReactNode;
  subtitle?: string;
  actions?: ReactNode;
}

/** Standard frame for a planning stage: "Step N of 6", title and subtitle. */
export function StagePage({
  stageId,
  children,
  title,
  titleSuffix,
  subtitle,
  actions,
}: StagePageProps) {
  const { stage, index } = getStage(stageId);
  return (
    <div className={styles.stage}>
      <PageHeader
        eyebrow={`Step ${index + 1} of ${PLANNING_STAGES.length}`}
        title={title ?? stage.label}
        titleSuffix={titleSuffix}
        subtitle={subtitle ?? stage.subtitle}
        actions={actions}
      />
      <div className={styles.content}>
        <PlanInputNotice />
        <div className={styles.sections}>{children}</div>
      </div>
    </div>
  );
}

interface StageNotBuiltProps {
  stageId: PlanningStage['id'] | 'baseline';
  /** What this stage will do once built, in user terms. */
  capabilities: readonly string[];
}

/**
 * Honest placeholder for a stage whose data and behaviour belong to a later phase. It
 * shows no metrics, so nothing on screen can be mistaken for a result.
 */
export function StageNotBuilt({ stageId, capabilities }: StageNotBuiltProps) {
  const { stage } = getStage(stageId);
  return (
    <EmptyState icon="layers" title="This stage is not built yet">
      <p>
        No data is shown here yet, so nothing on this page is a result. This stage is implemented in
        Phase {stage.ownerPhase} (reference: {stage.reference}).
      </p>
      <p>When built, it will:</p>
      <ul>
        {capabilities.map((capability) => (
          <li key={capability}>{capability}</li>
        ))}
      </ul>
    </EmptyState>
  );
}
