import { useEffect, useId, useRef, useState } from 'react';

import { Icon, type IconName } from '../components/Icon/Icon';
import { PALETTES, type ThemePreference } from '../theme/displayPreferences';
import { useDisplayPreferences } from '../theme/displayPreferencesContext';
import styles from './DisplayMenu.module.scss';

const THEME_OPTIONS: ReadonlyArray<{ id: ThemePreference; label: string; icon: IconName }> = [
  { id: 'system', label: 'System', icon: 'monitor' },
  { id: 'light', label: 'Light', icon: 'sun' },
  { id: 'dark', label: 'Dark', icon: 'moon' },
];

/**
 * Disclosure panel with two independent radio groups: theme and palette. Escape or an
 * outside click closes it and returns focus to the trigger.
 */
export function DisplayMenu() {
  const { preferences, setTheme, setPalette, persisted } = useDisplayPreferences();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="palette" />
        <span className={styles.triggerLabel}>Display</span>
      </button>
      <div id={panelId} className={styles.panel} hidden={!open}>
        <fieldset className={styles.group}>
          <legend className={styles.legend}>Theme</legend>
          <div className={styles.options}>
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
        </fieldset>
        <fieldset className={styles.group}>
          <legend className={styles.legend}>Palette (provisional)</legend>
          <div className={styles.options}>
            {PALETTES.map((palette) => (
              <label key={palette.id} className={styles.option}>
                <input
                  type="radio"
                  name={`${panelId}-palette`}
                  value={palette.id}
                  checked={preferences.palette === palette.id}
                  onChange={() => setPalette(palette.id)}
                />
                <span className={styles.swatch} data-swatch={palette.id} aria-hidden="true" />
                {palette.label}
                <span className={styles.hint}>{palette.description}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <p className={styles.note}>
          {persisted
            ? 'Saved on this device.'
            : 'This browser blocks storage, so the choice lasts for this tab only.'}{' '}
          No approved brand palette was supplied; these palettes are provisional.
        </p>
      </div>
    </div>
  );
}
