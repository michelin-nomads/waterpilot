import { createContext, useContext } from 'react';

import type { PlanningMode } from '../graphql/generated/graphql';
import type { CoordinatorState, SessionCoordinator } from './coordinator';
import type { SessionState } from './sessionState';

export interface PlanningSessionContextValue {
  /** The signed-in (or guest) user's coordinator; null with no identity yet. */
  coordinator: SessionCoordinator | null;
  state: CoordinatorState;
  /** The session as the user sees it: the server copy with unsaved edits applied. */
  view: SessionState | null;
  /** True while an unsaved edit changes location, goal or scenario (derived data is stale). */
  inputsPending: boolean;
  /**
   * Start a new plan in `mode` (as a guest when nobody is signed in), replacing any current
   * one. Plans are not kept between visits, so there is nothing to continue.
   */
  newReport: (mode: PlanningMode) => Promise<SessionState>;
}

export const PlanningSessionContext = createContext<PlanningSessionContextValue | null>(null);

export function usePlanningSession(): PlanningSessionContextValue {
  const value = useContext(PlanningSessionContext);
  if (!value) throw new Error('usePlanningSession must be used inside <PlanningSessionProvider>');
  return value;
}
