import { useId, useRef, useState } from 'react';

import { Icon, type IconName } from '../components/Icon/Icon';
import { useDismissable } from '../lib/useDismissable';
import { type ThemePreference } from '../theme/displayPreferences';
import { useDisplayPreferences } from '../theme/displayPreferencesContext';
import styles from './DisplayMenu.module.scss';

const THEME_OPTIONS: ReadonlyArray<{ id: ThemePreference; label: string; icon: IconName }> = [
  { id: 'system', label: 'System', icon: 'monitor' },
  { id: 'light', label: 'Light', icon: 'sun' },
  { id: 'dark', label: 'Dark', icon: 'moon' },
];

/**
 * Disclosure panel with one radio group: System, Light or Dark. Escape or an
 * outside click closes it and returns focus to the trigger.
 */
export function DisplayMenu() {
  const { preferences, setTheme, persisted } = useDisplayPreferences();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useDismissable(open, rootRef, (reason) => {
    setOpen(false);
    if (reason === 'escape') triggerRef.current?.focus();
  });

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-label="Display settings"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="sun" />
      </button>
      <div id={panelId} className={styles.panel} hidden={!open}>
        <div role="radiogroup" aria-label="Theme" className={styles.options}>
          {THEME_OPTIONS.map((option) => (
            <label key={option.id} className={styles.option}>
              <input
                type="radio"
                name={`${panelId}-theme`}
                value={option.id}
                checked={preferences.theme === option.id}
                onChange={() => setTheme(option.id)}
              />
              <Icon name={option.icon} size="sm" />
              {option.label}
            </label>
          ))}
        </div>
        <p className={styles.note}>
          {persisted
            ? 'Saved on this device.'
            : 'This browser blocks storage, so the choice lasts for this tab only.'}
        </p>
      </div>
    </div>
  );
}
