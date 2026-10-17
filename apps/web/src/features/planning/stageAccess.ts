import type { SessionState } from '../../session/sessionState';
import { PLANNING_STAGES, type PlanningStage } from '../../shell/stages';

/** Completion comes from saved inputs, never the URL or the last stage visited. */
export function unlockedStageIndex(session: SessionState | null): number {
  if (!session?.areaId) return 0;
  if (!session.baselineReviewed) return 1;
  if (!session.goal) return 2;
  if (!session.selectedPlanOptionId) return 3;
  return 4;
}

export function canOpenStage(stage: PlanningStage, session: SessionState | null): boolean {
  return PLANNING_STAGES.indexOf(stage) <= unlockedStageIndex(session);
}
