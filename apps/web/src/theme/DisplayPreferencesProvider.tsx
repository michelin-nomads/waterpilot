import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';

import { PREFERS_DARK_QUERY, useMediaQuery } from '../lib/useMediaQuery';
import {
  applyDisplayAttributes,
  DISPLAY_STORAGE_KEY,
  getPreferenceStorage,
  parseDisplayPreferences,
  readDisplayPreferences,
  resolveTheme,
  writeDisplayPreferences,
  type DisplayPreferences,
  type ThemePreference,
} from './displayPreferences';
import {
  DisplayPreferencesContext,
  type DisplayPreferencesValue,
} from './displayPreferencesContext';

interface Props {
  children: ReactNode;
  /** Injected in tests; defaults to `localStorage` (or `null` when blocked). */
  storage?: Storage | null;
}

export function DisplayPreferencesProvider({ children, storage: injected }: Props) {
  const storage = injected === undefined ? getPreferenceStorage() : injected;
  const [preferences, setPreferences] = useState<DisplayPreferences>(() =>
    readDisplayPreferences(storage),
  );
  const [persisted, setPersisted] = useState(storage !== null);
  const prefersDark = useMediaQuery(PREFERS_DARK_QUERY);
  const resolvedTheme = resolveTheme(preferences.theme, prefersDark);

  useLayoutEffect(() => {
    applyDisplayAttributes(document.documentElement, resolvedTheme);
  }, [resolvedTheme]);

  // Keep other open tabs in sync with a change made here.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === DISPLAY_STORAGE_KEY)
        setPreferences(parseDisplayPreferences(event.newValue));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const update = useCallback(
    (patch: Partial<DisplayPreferences>) => {
      const next = { ...preferences, ...patch };
      setPreferences(next);
      setPersisted(writeDisplayPreferences(storage, next));
    },
    [preferences, storage],
  );

  const value = useMemo<DisplayPreferencesValue>(
    () => ({
      preferences,
      resolvedTheme,
      persisted,
      setTheme: (theme: ThemePreference) => update({ theme }),
    }),
    [preferences, resolvedTheme, persisted, update],
  );

  return (
    <DisplayPreferencesContext.Provider value={value}>
      {children}
    </DisplayPreferencesContext.Provider>
  );
}
