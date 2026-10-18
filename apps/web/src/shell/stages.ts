import { SHOW_COMMUNITY_BASELINE } from '../features/planning/visibility';
import type { PlanningStage as SessionStage } from '../graphql/generated/graphql';

/**
 * The six planning stages. Community baseline screens are retained behind a visibility switch.
 * `reference` points at the screenshot that defines the stage's flow and layout;
 * `ownerPhase` is the build-guide phase that implements its data and behaviour.
 */
export interface PlanningStage {
  id: 'area' | 'scenario' | 'goals' | 'plans' | 'funding' | 'review';
  /** The stage as the planning session records it. */
  sessionStage: SessionStage;
  path: string;
  label: string;
  subtitle: string;
  reference: string;
  ownerPhase: string;
}

export const PLANNING_STAGES: readonly PlanningStage[] = [
  {
    id: 'area',
    sessionStage: 'UNDERSTAND',
    path: '/area',
    label: 'Understand Your Area',
    subtitle: "Get a clear view of your community's current water situation.",
    reference: '3.png, 8.png',
    ownerPhase: '08',
  },
  {
    id: 'scenario',
    sessionStage: 'SCENARIO',
    path: '/scenarios',
    label: 'Test a Future Scenario',
    subtitle: 'Explore changes to demand, supply or rainfall against your baseline.',
    reference: 'Original Designs pp. 5–9',
    ownerPhase: '08–10',
  },
  {
    id: 'goals',
    sessionStage: 'GOAL',
    path: '/goals',
    label: 'Set Your Goal',
    subtitle: 'Choose what you want to improve and the limits you are working within.',
    reference: '5.png',
    ownerPhase: '11',
  },
  {
    id: 'plans',
    sessionStage: 'COMPARE',
    path: '/plans',
    label: 'Compare AI-Recommended Plans',
    subtitle: 'Compare feasible options, what they cost and how they affect neighbours.',
    reference: '6.png',
    ownerPhase: '12',
  },
  {
    id: 'funding',
    sessionStage: 'MAKE_IT_HAPPEN',
    path: '/make-it-happen',
    label: 'Make it Happen',
    subtitle: 'Explore funding for your selected plan.',
    reference: 'Funding',
    ownerPhase: '20',
  },
  {
    id: 'review',
    sessionStage: 'REVIEW',
    path: '/reports/review',
    label: 'Take Action',
    subtitle: 'Review your current plan before saving an immutable report.',
    reference: 'Original Designs p. 14',
    ownerPhase: '20',
  },
];

/** Where to resume a session: the route of the stage it records. */
export function pathForSessionStage(stage: SessionStage | null | undefined): string {
  // Baseline substates remain resumable inside Understand Your Area.
  if (stage === 'TRACK') return '/tracking';
  if (stage === 'BASELINE') return SHOW_COMMUNITY_BASELINE ? '/baseline' : '/area';
  if (stage === 'BASELINE_INPUTS') return SHOW_COMMUNITY_BASELINE ? '/baseline' : '/area';
  if (stage === 'BASELINE_OVERVIEW')
    return SHOW_COMMUNITY_BASELINE ? '/baseline/overview' : '/area';
  return PLANNING_STAGES.find((s) => s.sessionStage === stage)?.path ?? '/area';
}

export function stageForPath(pathname: string): PlanningStage | null {
  if (pathname === '/baseline' || pathname.startsWith('/baseline/'))
    return SHOW_COMMUNITY_BASELINE ? PLANNING_STAGES[0]! : null;
  return (
    PLANNING_STAGES.find((s) => pathname === s.path || pathname.startsWith(`${s.path}/`)) ?? null
  );
}

export function getStage(id: PlanningStage['id'] | 'baseline'): {
  stage: PlanningStage;
  index: number;
} {
  const index = PLANNING_STAGES.findIndex(
    (stage) => stage.id === (id === 'baseline' ? 'area' : id),
  );
  const stage = PLANNING_STAGES[index];
  if (!stage) throw new Error(`Unknown planning stage: ${id}`);
  return { stage, index };
}

/** Persist Baseline substates without introducing additional navbar steps. */
export function sessionStageForPath(pathname: string): SessionStage | undefined {
  if (!SHOW_COMMUNITY_BASELINE && (pathname === '/baseline' || pathname.startsWith('/baseline/')))
    return undefined;
  if (pathname === '/baseline') return 'BASELINE';
  if (pathname === '/baseline/inputs') return 'BASELINE_INPUTS';
  if (pathname === '/baseline/overview') return 'BASELINE_OVERVIEW';
  if (pathname.startsWith('/baseline/')) return 'BASELINE';
  return stageForPath(pathname)?.sessionStage;
}
