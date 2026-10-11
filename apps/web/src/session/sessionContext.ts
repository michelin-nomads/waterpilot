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
  /** Continue the current session, or start one (as a guest if needed) in `mode`. */
  startPlanning: (mode: PlanningMode) => Promise<SessionState>;
  /** Close the current session and start a new one in `mode` ("New report"). */
  newReport: (mode: PlanningMode) => Promise<SessionState>;
  /**
   * Try to save before signing out. Resolves false if edits remain unsaved, so the
   * caller can ask before discarding them.
   */
  prepareSignOut: () => Promise<boolean>;
}

export const PlanningSessionContext = createContext<PlanningSessionContextValue | null>(null);

export function usePlanningSession(): PlanningSessionContextValue {
  const value = useContext(PlanningSessionContext);
  if (!value) throw new Error('usePlanningSession must be used inside <PlanningSessionProvider>');
  return value;
}
