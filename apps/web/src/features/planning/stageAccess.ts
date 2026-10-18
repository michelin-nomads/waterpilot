import { SHOW_COMMUNITY_BASELINE } from './visibility';
import type { SessionState } from '../../session/sessionState';
import { PLANNING_STAGES, type PlanningStage } from '../../shell/stages';

/** Completion comes from saved inputs, never the URL or the last stage visited. */
export function unlockedStageIndex(session: SessionState | null): number {
  if (!session?.areaId || (SHOW_COMMUNITY_BASELINE && !session.baselineReviewed)) return 0;
  // Saved goals from earlier versions remain usable without repeating the new scenario step.
  if (!session.scenario?.confirmed && !session.goal) return 1;
  if (!session.goal) return 2;
  const hasLocalOption =
    typeof localStorage !== 'undefined' &&
    Boolean(
      (session?.id && localStorage.getItem(`waterpilot_selected_plan_${session.id}`)) ||
      (session?.id && localStorage.getItem(`waterpilot_selected_option_${session.id}`)) ||
      Object.keys(localStorage).some((k) => k.startsWith('waterpilot_selected_plan_')),
    );
  if (!session.selectedPlanOptionId && !hasLocalOption) return 3;
  // Funding is optional; an unmatched scheme must never block taking action.
  return 5;
}

export function canOpenStage(stage: PlanningStage, session: SessionState | null): boolean {
  return PLANNING_STAGES.indexOf(stage) <= unlockedStageIndex(session);
}
