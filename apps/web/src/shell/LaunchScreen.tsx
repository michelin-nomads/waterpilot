import { WaterDropletLoader } from '../components/WaterDropletLoader/WaterDropletLoader';
import styles from './LaunchScreen.module.scss';

/**
 * Shown while auth restores and the router resolves the first route; readiness unmounts it.
 * It only centres the droplet loader on the page background.
 */
export function LaunchScreen() {
  return (
    <div className={styles.screen}>
      <WaterDropletLoader />
    </div>
  );
}
