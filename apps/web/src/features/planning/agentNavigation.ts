import { PLANNING_STAGES, stageForPath } from '../../shell/stages';
import { canOpenStage } from './stageAccess';
import type { SessionState } from '../../session/sessionState';

/** Explicit navigation only; never interprets a planning edit as a route change. */
export function agentNavigation(text: string, pathname: string, session: SessionState | null) {
  const command = text
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/, '')
    .replace(/\s+/g, ' ')
    .replace(/^(?:can|could|would|shall|should) (?:you|we|i) (?:please )?/, '')
    .replace(/^please /, '');
  const current = PLANNING_STAGES.findIndex((stage) => stage === stageForPath(pathname));
  let index: number;
  if (
    /^(?:(?:please )?(?:go|move|take me|navigate|proceed|continue) )?(?:to )?(?:the )?(?:next|forward)(?: step| page)?$/.test(
      command,
    )
  )
    index = current + 1;
  else if (
    /^(?:(?:please )?(?:go|move|take me|navigate) )?(?:to )?(?:the )?(?:back|previous)(?: step| page)?$/.test(
      command,
    )
  )
    index = current - 1;
  else {
    const match =
      /^(?:please )?(?:go|move|take me|navigate|return|switch)(?: back)? to (?:the )?(.+?)(?: step| page)?$/.exec(
        command,
      );
    if (!match) return null;
    const aliases: Record<string, number> = {
      area: 0,
      'understand your area': 0,
      location: 0,
      scenario: 1,
      'test a future scenario': 1,
      goal: 2,
      goals: 2,
      'set your goal': 2,
      compare: 3,
      'compare plans': 3,
      plans: 3,
      funding: 4,
      'make it happen': 4,
      review: 5,
      'take action': 5,
    };
    index = aliases[match[1]] ?? -1;
    if (index === -1) return null;
  }
  const target = PLANNING_STAGES[index];
  if (!target)
    return { message: index < 0 ? 'You are at the first step.' : 'You are at the final step.' };
  if (!canOpenStage(target, session)) {
    const missing = !session?.areaId
      ? 'Confirm your location and radius in the workspace first.'
      : !session.scenario?.confirmed && !session.goal
        ? 'Review and save your future scenario first.'
        : !session.goal
          ? 'Choose and save your water-saving goal first.'
          : 'Select a plan from Compare Plans first.';
    return { message: `Before ${target.label}: ${missing}` };
  }
  return { path: target.path, message: `Opened ${target.label}. Your saved work is preserved.` };
}
