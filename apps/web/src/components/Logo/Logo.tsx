import styles from './Logo.module.scss';

/** The WaterPilot mark: a water droplet inside a 270° ring (open at the upper right). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      className={[styles.mark, className].filter(Boolean).join(' ')}
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M20 3A17 17 0 1 0 37 20" className={styles.ring} />
      <path
        d="M20 9.2s-7.8 8.8-7.8 14.3a7.8 7.8 0 0 0 15.6 0c0-5.5-7.8-14.3-7.8-14.3Z"
        className={styles.drop}
      />
      <path d="M16.6 23.6a4 4 0 0 0 3.8 3.9" className={styles.glint} />
    </svg>
  );
}

export function Logo() {
  return (
    <span className={styles.logo}>
      <LogoMark />
      <span className={styles.wordmark}>WaterPilot</span>
    </span>
  );
}
