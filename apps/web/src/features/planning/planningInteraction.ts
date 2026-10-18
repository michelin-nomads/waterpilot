import { useSyncExternalStore } from 'react';
import { SHOW_COMMUNITY_BASELINE } from './visibility';
import type { SessionState } from '../../session/sessionState';
import type { Place } from '../location/types';

export type LocationInteraction = {
  status: 'absent' | 'resolving' | 'suggested' | 'confirming' | 'confirmed' | 'failed';
  candidateName?: string;
};
const empty: LocationInteraction = { status: 'absent' };
const locations = new Map<string, LocationInteraction>();
const listeners = new Set<() => void>();

/** Ephemeral review state only. Never used as a calculation input or sent as saved data. */
export function publishLocationInteraction(sessionId: string, next: LocationInteraction | null) {
  if (next) locations.set(sessionId, next);
  else locations.delete(sessionId);
  listeners.forEach((listener) => listener());
}
export function useLocationInteraction(sessionId?: string) {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => (sessionId ? locations.get(sessionId) : undefined) ?? empty,
    () => empty,
  );
}

export function planningInteraction(
  session: SessionState | null | undefined,
  page: string | undefined,
  location: LocationInteraction,
  inputsPending: boolean,
) {
  const currentLocation =
    location.status === 'absent' && session?.areaId
      ? { status: 'confirmed' as const, candidateName: session.areaName ?? undefined }
      : location;
  return {
    sessionId: session?.id,
    page: page ?? session?.stage,
    location: currentLocation,
    inputs: inputsPending ? ('pending' as const) : ('saved' as const),
    nextRequirement: !session?.areaId
      ? 'confirm-location'
      : SHOW_COMMUNITY_BASELINE && !session.baselineReviewed
        ? 'review-baseline'
        : !session.scenario?.confirmed && !session.goal
          ? 'confirm-scenario'
          : !session.goal
            ? 'choose-goal'
            : !session.selectedPlanOptionId
              ? 'select-plan'
              : 'review-plan',
  };
}

const confirmations = new Map<string, () => void>();
const selections = new Map<string, (place: Place) => void>();
export function registerLocationSelection(sessionId: string, action: (place: Place) => void) {
  selections.set(sessionId, action);
  listeners.forEach((listener) => listener());
  return () => {
    if (selections.get(sessionId) === action) {
      selections.delete(sessionId);
      listeners.forEach((listener) => listener());
    }
  };
}
export function useLocationSelection(sessionId?: string) {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => (sessionId ? selections.get(sessionId) : undefined),
    () => undefined,
  );
}
export function registerLocationConfirmation(sessionId: string, action: (() => void) | null) {
  if (action) confirmations.set(sessionId, action);
  else confirmations.delete(sessionId);
  listeners.forEach((listener) => listener());
  return () => {
    if (confirmations.get(sessionId) === action) {
      confirmations.delete(sessionId);
      listeners.forEach((listener) => listener());
    }
  };
}
export function useLocationConfirmation(sessionId?: string) {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => (sessionId ? confirmations.get(sessionId) : undefined),
    () => undefined,
  );
}
