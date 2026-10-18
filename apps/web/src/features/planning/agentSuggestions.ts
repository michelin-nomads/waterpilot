import type { SessionState } from '../../session/sessionState';
import { SHOW_COMMUNITY_BASELINE } from './visibility';

/** Match the visible page first; hidden baseline screens are never a required next step. */
export function agentSuggestions(
  session: SessionState | null | undefined,
  stage = session?.stage,
): string[] {
  if (!session?.areaId) return ['Help me choose a location for my water plan'];
  if (stage === 'UNDERSTAND')
    return [
      'Review my selected location and planning area',
      'Explain the available area data and its limitations',
    ];
  if (stage === 'SCENARIO')
    return [
      'Help me test a future demand or supply scenario',
      'Explain my scenario assumptions and missing inputs',
    ];
  if (stage?.startsWith('BASELINE') || (SHOW_COMMUNITY_BASELINE && !session.baselineReviewed))
    return ['What information is missing from this baseline?'];
  if (stage === 'MAKE_IT_HAPPEN')
    return [
      'Check funding eligibility for my selected plan',
      'Explain the required documents and source verification',
    ];
  if (stage === 'REVIEW')
    return [
      'Review my selected plan and its assumptions',
      'What information is needed before finalizing my report?',
    ];
  if (stage === 'GOAL')
    return ['Help me choose a water security goal', 'Review my saved goal and constraints'];
  if (stage === 'COMPARE')
    return [
      'Explain the tradeoffs between my plan options',
      'What inputs are needed to compare these options?',
    ];
  if (!session.scenario?.confirmed && !session.goal)
    return ['Help me test a future demand or supply scenario'];
  if (!session.goal) return ['Help me choose a water security goal'];
  if (!session.selectedPlanOptionId) return ['Explore intervention options for my goal'];
  return ['Review my selected plan and its assumptions'];
}
