import type { PlanningStage as SessionStage } from '../graphql/generated/graphql';

/**
 * The five planning stages (ADR 0002: What-if is a workspace panel, not a stage).
 * `reference` points at the screenshot that defines the stage's flow and layout;
 * `ownerPhase` is the build-guide phase that implements its data and behaviour.
 */
export interface PlanningStage {
  id: 'area' | 'goals' | 'plans' | 'funding' | 'tracking';
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
    label: 'Compare Plans',
    subtitle: 'Compare feasible options, what they cost and how they affect neighbours.',
    reference: '6.png',
    ownerPhase: '12',
  },
  {
    id: 'funding',
    sessionStage: 'MAKE_IT_HAPPEN',
    path: '/make-it-happen',
    label: 'Make It Happen',
    subtitle: 'Turn your selected plan into an implementable, fundable project.',
    reference: '1.png, 2.png',
    ownerPhase: '13–14',
  },
  {
    id: 'tracking',
    sessionStage: 'TRACK',
    path: '/tracking',
    label: 'Take Action & Track',
    subtitle: 'Track milestones and compare observed results with the original forecast.',
    reference: '7.png',
    ownerPhase: '15',
  },
];

/** Where to resume a session: the route of the stage it records. */
export function pathForSessionStage(stage: SessionStage | null | undefined): string {
  return PLANNING_STAGES.find((s) => s.sessionStage === stage)?.path ?? '/area';
}

export function stageForPath(pathname: string): PlanningStage | null {
  return PLANNING_STAGES.find((s) => pathname.startsWith(s.path)) ?? null;
}

export function getStage(id: PlanningStage['id']): { stage: PlanningStage; index: number } {
  const index = PLANNING_STAGES.findIndex((stage) => stage.id === id);
  const stage = PLANNING_STAGES[index];
  if (!stage) throw new Error(`Unknown planning stage: ${id}`);
  return { stage, index };
}
