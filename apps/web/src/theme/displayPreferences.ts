import { z } from 'zod';

import { PREFERS_DARK_QUERY } from '../lib/useMediaQuery';

export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type ResolvedTheme = Exclude<ThemePreference, 'system'>;

/** One palette ships: Estuary, which follows the supplied design reference. */
export const PALETTE = 'estuary';

export interface DisplayPreferences {
  theme: ThemePreference;
}

export const DEFAULT_DISPLAY_PREFERENCES: DisplayPreferences = {
  theme: 'system',
};

export const DISPLAY_STORAGE_KEY = 'waterpilot.display.v1';

// An unknown stored theme falls back to the default; other stored keys (an old palette) are ignored.
const StoredSchema = z.object({
  theme: z.enum(THEME_PREFERENCES).catch(DEFAULT_DISPLAY_PREFERENCES.theme),
});

/** Returns `localStorage`, or `null` where storage is blocked (privacy modes, sandboxed frames). */
export function getPreferenceStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function parseDisplayPreferences(raw: string | null): DisplayPreferences {
  if (!raw) return DEFAULT_DISPLAY_PREFERENCES;
  try {
    const parsed = StoredSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_DISPLAY_PREFERENCES;
  } catch {
    return DEFAULT_DISPLAY_PREFERENCES;
  }
}

export function readDisplayPreferences(storage: Storage | null): DisplayPreferences {
  try {
    return parseDisplayPreferences(storage?.getItem(DISPLAY_STORAGE_KEY) ?? null);
  } catch {
    return DEFAULT_DISPLAY_PREFERENCES;
  }
}

/** Persists preferences; returns `false` when storage is unavailable or full. */
export function writeDisplayPreferences(
  storage: Storage | null,
  preferences: DisplayPreferences,
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(DISPLAY_STORAGE_KEY, JSON.stringify(preferences));
    return true;
  } catch {
    return false;
  }
}

export function resolveTheme(preference: ThemePreference, prefersDark: boolean): ResolvedTheme {
  if (preference === 'system') return prefersDark ? 'dark' : 'light';
  return preference;
}

export function applyDisplayAttributes(root: HTMLElement, theme: ResolvedTheme): void {
  root.dataset.theme = theme;
  root.dataset.palette = PALETTE;
}

/** Applies the stored preference before the first React render to avoid a theme flash. */
export function applyStoredDisplayPreferences(): void {
  const { theme } = readDisplayPreferences(getPreferenceStorage());
  const prefersDark =
    typeof window.matchMedia === 'function' && window.matchMedia(PREFERS_DARK_QUERY).matches;
  applyDisplayAttributes(document.documentElement, resolveTheme(theme, prefersDark));
}
