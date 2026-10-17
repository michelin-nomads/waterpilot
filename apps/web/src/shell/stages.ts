import type { PlanningStage as SessionStage } from '../graphql/generated/graphql';

/**
 * The five planning stages (ADR 0002: What-if is a workspace panel, not a stage).
 * `reference` points at the screenshot that defines the stage's flow and layout;
 * `ownerPhase` is the build-guide phase that implements its data and behaviour.
 */
export interface PlanningStage {
  id: 'area' | 'baseline' | 'goals' | 'plans' | 'review';
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
    label: 'Location',
    subtitle: "Get a clear view of your community's current water situation.",
    reference: '3.png, 8.png',
    ownerPhase: '08',
  },
  {
    id: 'baseline',
    sessionStage: 'BASELINE',
    path: '/baseline',
    label: 'Baseline',
    subtitle: 'Build and review your community’s water baseline.',
    reference: 'Original Designs pp. 5–9',
    ownerPhase: '08–10',
  },
  {
    id: 'goals',
    sessionStage: 'GOAL',
    path: '/goals',
    label: 'Goal',
    subtitle: 'Choose what you want to improve and the limits you are working within.',
    reference: '5.png',
    ownerPhase: '11',
  },
  {
    id: 'plans',
    sessionStage: 'COMPARE',
    path: '/plans',
    label: 'Compare',
    subtitle: 'Compare feasible options, what they cost and how they affect neighbours.',
    reference: '6.png',
    ownerPhase: '12',
  },
  {
    id: 'review',
    sessionStage: 'REVIEW',
    path: '/reports/review',
    label: 'Review',
    subtitle: 'Review your current plan before saving an immutable report.',
    reference: 'Original Designs p. 14',
    ownerPhase: '20',
  },
];

/** Where to resume a session: the route of the stage it records. */
export function pathForSessionStage(stage: SessionStage | null | undefined): string {
  // Legacy branch stages keep their original destination; never reinterpret them as Review.
  if (stage === 'MAKE_IT_HAPPEN') return '/make-it-happen';
  if (stage === 'TRACK') return '/tracking';
  if (stage === 'BASELINE_INPUTS') return '/baseline';
  if (stage === 'BASELINE_OVERVIEW') return '/baseline/overview';
  return PLANNING_STAGES.find((s) => s.sessionStage === stage)?.path ?? '/area';
}

export function stageForPath(pathname: string): PlanningStage | null {
  return (
    PLANNING_STAGES.find((s) => pathname === s.path || pathname.startsWith(`${s.path}/`)) ?? null
  );
}

export function getStage(id: PlanningStage['id']): { stage: PlanningStage; index: number } {
  const index = PLANNING_STAGES.findIndex((stage) => stage.id === id);
  const stage = PLANNING_STAGES[index];
  if (!stage) throw new Error(`Unknown planning stage: ${id}`);
  return { stage, index };
}

/** Persist Baseline substates without introducing additional navbar steps. */
export function sessionStageForPath(pathname: string): SessionStage | undefined {
  if (pathname === '/baseline/inputs') return 'BASELINE_INPUTS';
  if (pathname === '/baseline/overview') return 'BASELINE_OVERVIEW';
  return stageForPath(pathname)?.sessionStage;
}
