import { createContext, useContext } from 'react';

import type {
  DisplayPreferences,
  PaletteId,
  ResolvedTheme,
  ThemePreference,
} from './displayPreferences';

export interface DisplayPreferencesValue {
  preferences: DisplayPreferences;
  resolvedTheme: ResolvedTheme;
  /** `false` when the browser blocks storage; the choice then lasts for this tab only. */
  persisted: boolean;
  setTheme: (theme: ThemePreference) => void;
  setPalette: (palette: PaletteId) => void;
}

export const DisplayPreferencesContext = createContext<DisplayPreferencesValue | null>(null);

export function useDisplayPreferences(): DisplayPreferencesValue {
  const value = useContext(DisplayPreferencesContext);
  if (!value)
    throw new Error('useDisplayPreferences must be used inside DisplayPreferencesProvider');
  return value;
}
