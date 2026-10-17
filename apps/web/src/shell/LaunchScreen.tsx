import { LaunchScene } from './LaunchScene';
import styles from './LaunchScreen.module.scss';

/** Decorative startup screen; ApplicationStartup owns its duration and dismissal. */
export function LaunchScreen() {
  return (
    <div className={styles.screen} aria-label="WaterPilot startup">
      <main className={styles.content}>
        <div className={styles.art}>
          <LaunchScene />
        </div>
        <div className={styles.message}>
          <p className={styles.eyebrow}>Water connects us</p>
          <p className={styles.title}>
            A more water-secure
            <br />
            tomorrow starts here.
          </p>
          <p className={styles.subtitle}>Thoughtful plans. Thriving communities.</p>
        </div>
        <div className={styles.loading} role="status">
          <span className={styles.loadingTrack} aria-hidden="true">
            <span />
          </span>
          <span className={styles.loadingText}>
            Preparing your workspace<span aria-hidden="true">…</span>
          </span>
        </div>
      </main>
      <footer className={styles.footer}>
        <span className={styles.footerLine} />
        <p>Smarter communities. More water secure.</p>
        <span className={styles.footerLine} />
      </footer>
    </div>
  );
}
