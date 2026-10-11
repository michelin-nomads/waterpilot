import { z } from 'zod';

import { PREFERS_DARK_QUERY } from '../lib/useMediaQuery';

export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type ResolvedTheme = Exclude<ThemePreference, 'system'>;

export const PALETTE_IDS = ['estuary', 'monsoon', 'grove'] as const;
export type PaletteId = (typeof PALETTE_IDS)[number];

/** Provisional palettes: original choices, not the unseen approved design. */
export const PALETTES: ReadonlyArray<{ id: PaletteId; label: string; description: string }> = [
  { id: 'estuary', label: 'Estuary', description: 'Teal accent' },
  { id: 'monsoon', label: 'Monsoon', description: 'Blue accent' },
  { id: 'grove', label: 'Grove', description: 'Green accent' },
];

export interface DisplayPreferences {
  theme: ThemePreference;
  palette: PaletteId;
}

export const DEFAULT_DISPLAY_PREFERENCES: DisplayPreferences = {
  theme: 'system',
  palette: 'estuary',
};

export const DISPLAY_STORAGE_KEY = 'waterlens.display.v1';

// Each field falls back on its own, so one corrupt value never resets the other preference.
const StoredSchema = z.object({
  theme: z.enum(THEME_PREFERENCES).catch(DEFAULT_DISPLAY_PREFERENCES.theme),
  palette: z.enum(PALETTE_IDS).catch(DEFAULT_DISPLAY_PREFERENCES.palette),
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

export function applyDisplayAttributes(
  root: HTMLElement,
  theme: ResolvedTheme,
  palette: PaletteId,
): void {
  root.dataset.theme = theme;
  root.dataset.palette = palette;
}

/** Applies the stored preference before the first React render to avoid a theme flash. */
export function applyStoredDisplayPreferences(): void {
  const { theme, palette } = readDisplayPreferences(getPreferenceStorage());
  const prefersDark =
    typeof window.matchMedia === 'function' && window.matchMedia(PREFERS_DARK_QUERY).matches;
  applyDisplayAttributes(document.documentElement, resolveTheme(theme, prefersDark), palette);
}
