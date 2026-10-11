import { LogoMark } from '../components/Logo/Logo';
import styles from './LaunchScreen.module.scss';

/**
 * Shown while the router resolves the first route. It reflects real loading only — there
 * is no minimum display time and no progress percentage.
 */
export function LaunchScreen() {
  return (
    <div className={styles.launch} role="status">
      <div className={styles.emblem} aria-hidden="true">
        <span className={styles.ripple} />
        <span className={styles.ripple} />
        <LogoMark className={styles.mark} />
      </div>
      <p className={styles.text}>Loading WaterLens…</p>
    </div>
  );
}
