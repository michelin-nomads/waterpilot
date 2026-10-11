import type { ReactNode } from 'react';

import { EmptyState } from '../../components/StatePanel/StatePanel';
import { PageHeader } from '../../shell/PageHeader';
import { getStage, PLANNING_STAGES, type PlanningStage } from '../../shell/stages';
import { PlanSummary } from './PlanSummary';

interface StagePageProps {
  stageId: PlanningStage['id'];
  children: ReactNode;
}

/** Standard frame for a planning stage: "Step N of 5", title and subtitle. */
export function StagePage({ stageId, children }: StagePageProps) {
  const { stage, index } = getStage(stageId);
  return (
    <>
      <PageHeader
        eyebrow={`Step ${index + 1} of ${PLANNING_STAGES.length}`}
        title={stage.label}
        subtitle={stage.subtitle}
      />
      <PlanSummary />
      {children}
    </>
  );
}

interface StageNotBuiltProps {
  stageId: PlanningStage['id'];
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
