import { useCallback, useState } from 'react';

import type { PlanningMode as SessionMode } from '../../graphql/generated/graphql';
import type { IconName } from '../../components/Icon/Icon';
import { usePlanningSession } from '../../session/sessionContext';
import { getPreferenceStorage } from '../../theme/displayPreferences';

/**
 * Traditional and Agent are two views over ONE planning session (ADR 0002). The session
 * records the mode it is in, so every tab and device resumes it the same way; the device
 * remembers the last choice only as the default for the next new session.
 */
export const PLANNING_MODES = ['traditional', 'agent'] as const;
export type PlanningMode = (typeof PLANNING_MODES)[number];

export interface PlanningModeOption {
  id: PlanningMode;
  label: string;
  description: string;
  icon: IconName;
}

export const PLANNING_MODE_OPTIONS: readonly PlanningModeOption[] = [
  {
    id: 'traditional',
    label: 'Explorer',
    description: 'Shape your water plan yourself, step by step.',
    icon: 'adjustments',
  },
  {
    id: 'agent',
    label: 'Copilot',
    description: 'Build your plan with AI assistance. Every step stays editable.',
    icon: 'sparkle',
  },
];

export const PLANNING_MODE_STORAGE_KEY = 'waterpilot.planningMode.v1';
export const DEFAULT_PLANNING_MODE: PlanningMode = 'traditional';

export const toSessionMode = (mode: PlanningMode): SessionMode =>
  mode === 'agent' ? 'AGENT' : 'TRADITIONAL';
export const fromSessionMode = (mode: SessionMode): PlanningMode =>
  mode === 'AGENT' ? 'agent' : 'traditional';

function isPlanningMode(value: unknown): value is PlanningMode {
  return PLANNING_MODES.includes(value as PlanningMode);
}

export function readPlanningMode(storage: Storage | null): PlanningMode {
  try {
    const raw = storage?.getItem(PLANNING_MODE_STORAGE_KEY);
    return isPlanningMode(raw) ? raw : DEFAULT_PLANNING_MODE;
  } catch {
    return DEFAULT_PLANNING_MODE;
  }
}

/** The device's last mode choice: the default on Welcome and New report. */
export function usePreferredPlanningMode(): [PlanningMode, (mode: PlanningMode) => void] {
  const [mode, setModeState] = useState<PlanningMode>(() =>
    readPlanningMode(getPreferenceStorage()),
  );
  const setMode = useCallback((next: PlanningMode) => {
    setModeState(next);
    try {
      getPreferenceStorage()?.setItem(PLANNING_MODE_STORAGE_KEY, next);
    } catch {
      // Storage blocked: the mode still applies for this tab.
    }
  }, []);
  return [mode, setMode];
}

/**
 * The mode of the current session when there is one (saved with the session), otherwise
 * the device's last choice. Switching updates both.
 */
export function usePlanningMode(): [PlanningMode, (mode: PlanningMode) => void] {
  const [preferred, setPreferred] = usePreferredPlanningMode();
  const { view, coordinator, state } = usePlanningSession();
  const mode = view ? fromSessionMode(view.mode) : preferred;
  const setMode = useCallback(
    (next: PlanningMode) => {
      setPreferred(next);
      if (state.status === 'ready') coordinator?.setMode(toSessionMode(next));
    },
    [setPreferred, coordinator, state.status],
  );
  return [mode, setMode];
}
