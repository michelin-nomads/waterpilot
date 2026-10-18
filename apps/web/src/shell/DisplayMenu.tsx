import { Icon } from '../components/Icon/Icon';
import { useDisplayPreferences } from '../theme/displayPreferencesContext';
import styles from './DisplayMenu.module.scss';

/**
 * Direct theme toggle button:
 * - Initially when loaded, system theme is picked.
 * - When the theme is dark, the sunlight icon ('sun') is displayed.
 * - When the theme is light, the moon icon ('moon') is displayed.
 */
export function DisplayMenu() {
  const { resolvedTheme, setTheme } = useDisplayPreferences();
  const isDark = resolvedTheme === 'dark';

  const toggle = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  return (
    <div className={styles.root}>
      <button
        type="button"
        className={styles.trigger}
        aria-label="Display settings"
        title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        onClick={toggle}
      >
        <Icon name={isDark ? 'sun' : 'moon'} />
      </button>
    </div>
  );
}

