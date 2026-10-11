import styles from './Decor.module.scss';

const MERIDIANS = [12, 30, 48, 66, 84];
const PARALLELS = [-60, -36, -12, 12, 36, 60];

/**
 * Very faint, purely decorative globe graticule behind the page. Abstract lines only — it
 * draws no coastlines, boundaries or places, so it cannot be mistaken for map data.
 */
export function EarthBackground() {
  return (
    <div className={styles.earth} aria-hidden="true" data-decor="earth">
      <svg viewBox="-100 -100 200 200" className={styles.globe}>
        <circle r="96" className={styles.outline} />
        <g className={styles.spin}>
          {MERIDIANS.map((rx) => (
            <ellipse key={rx} rx={rx} ry="96" className={styles.line} />
          ))}
          <line x1="0" y1="-96" x2="0" y2="96" className={styles.line} />
        </g>
        {PARALLELS.map((y) => (
          <line
            key={y}
            x1={-Math.sqrt(96 ** 2 - y ** 2)}
            x2={Math.sqrt(96 ** 2 - y ** 2)}
            y1={y}
            y2={y}
            className={styles.line}
          />
        ))}
      </svg>
    </div>
  );
}

const WAVE = 'M0 12 Q 50 0 100 12 T 200 12 T 300 12 T 400 12 V 24 H 0 Z';

/** Subtle flowing-water band under the header. Decorative; pauses when hidden or reduced. */
export function WaterFlow() {
  return (
    <div className={styles.water} aria-hidden="true" data-decor="water">
      <svg
        viewBox="0 0 400 24"
        preserveAspectRatio="none"
        className={`${styles.wave} ${styles.back}`}
      >
        <path d={WAVE} />
      </svg>
      <svg
        viewBox="0 0 400 24"
        preserveAspectRatio="none"
        className={`${styles.wave} ${styles.front}`}
      >
        <path d={WAVE} />
      </svg>
    </div>
  );
}
