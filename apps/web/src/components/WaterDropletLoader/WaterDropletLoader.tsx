import { useId } from 'react';

import styles from './WaterDropletLoader.module.scss';

type WaterDropletLoaderProps = {
  /** Status text that describes the real work currently blocking the app. */
  statusText: string;
};

const dropletPath =
  'M120 18 C107 52 34 121 34 186 C34 237 71 276 120 276 C169 276 206 237 206 186 C206 121 133 52 120 18Z';

const wavePath = 'M-240 14 Q-180 -2 -120 14 T0 14 T120 14 T240 14 T360 14 T480 14 V320 H-240Z';

export function WaterDropletLoader({ statusText }: WaterDropletLoaderProps) {
  const clipId = `water-droplet-clip-${useId().replace(/:/g, '')}`;

  return (
    <div className={styles.loader} role="status">
      <svg className={styles.art} viewBox="0 0 240 300" aria-hidden="true">
        <defs>
          <clipPath id={clipId}>
            <path d={dropletPath} />
          </clipPath>
        </defs>

        <path className={styles.drop} d={dropletPath} />
        <g clipPath={`url(#${clipId})`}>
          <g className={styles.fillGroup}>
            <g className={styles.waveTrack}>
              <g transform="translate(70 0)">
                <path className={styles.backWave} d={wavePath} />
              </g>
            </g>
            <g className={styles.waveTrack}>
              <path className={styles.frontWave} d={wavePath} />
            </g>
          </g>
          <path className={styles.accentArc} d="M84 112 C69 135 57 160 54 186" />
        </g>
      </svg>
      <span className={styles.label}>{statusText}</span>
    </div>
  );
}
