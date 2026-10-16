import { useCallback, useEffect, useState, type RefObject } from 'react';

import { getPreferenceStorage } from '../../theme/displayPreferences';

/** Conversation-pane width bounds in CSS px; mirror --wl-agent-width* in tokens.scss. */
export const AGENT_WIDTH = { default: 384, min: 288, max: 640, maxShare: 0.45 } as const;
export const AGENT_WIDTH_STORAGE_KEY = 'waterlens.agentWidth.v1';

export function readAgentWidth(storage: Storage | null): number {
  try {
    const value = Number(storage?.getItem(AGENT_WIDTH_STORAGE_KEY));
    return Number.isInteger(value) && value >= AGENT_WIDTH.min && value <= AGENT_WIDTH.max
      ? value
      : AGENT_WIDTH.default;
  } catch {
    return AGENT_WIDTH.default;
  }
}

/** Persisted per-device width of the desktop conversation pane. */
export function useAgentWidth(): [number, (width: number) => void] {
  const [width, setWidthState] = useState(() => readAgentWidth(getPreferenceStorage()));
  const setWidth = useCallback((next: number) => {
    const rounded = Math.round(next);
    setWidthState(rounded);
    try {
      getPreferenceStorage()?.setItem(AGENT_WIDTH_STORAGE_KEY, String(rounded));
    } catch {
      // Storage blocked: the width still applies for this tab.
    }
  }, []);
  return [width, setWidth];
}

/**
 * Largest allowed pane width for the current planning area: the fixed maximum, or 45 % of
 * the area so the workspace always keeps the larger share.
 */
export function useAgentMaxWidth(areaRef: RefObject<HTMLElement | null>, enabled: boolean) {
  const [areaWidth, setAreaWidth] = useState(0);

  useEffect(() => {
    const element = areaRef.current;
    if (!enabled || !element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setAreaWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [areaRef, enabled]);

  if (areaWidth === 0) return AGENT_WIDTH.max;
  return Math.max(
    AGENT_WIDTH.min,
    Math.min(
      AGENT_WIDTH.max,
      Math.min(Math.floor(areaWidth * AGENT_WIDTH.maxShare), areaWidth - 560),
    ),
  );
}
