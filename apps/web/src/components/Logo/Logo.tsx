import styles from './Logo.module.scss';

/**
 * PROVISIONAL mark: a droplet seen through a lens ring. No approved logo was supplied
 * (docs/design/approved/ is empty); this is not a reproduction of any prior asset.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      className={[styles.mark, className].filter(Boolean).join(' ')}
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="20" cy="20" r="17" className={styles.ring} />
      <path d="M20 8.5s-8 9.2-8 14.6a8 8 0 0 0 16 0c0-5.4-8-14.6-8-14.6Z" className={styles.drop} />
      <path d="M16.2 23.4a3.9 3.9 0 0 0 3.6 3.9" className={styles.glint} />
    </svg>
  );
}

export function Logo() {
  return (
    <span className={styles.logo}>
      <LogoMark />
      <span className={styles.wordmark}>WaterLens</span>
    </span>
  );
}
