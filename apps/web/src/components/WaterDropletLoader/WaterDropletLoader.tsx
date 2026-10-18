import { useId } from 'react';

import styles from './WaterDropletLoader.module.scss';
import { useTimedProgress } from './useTimedProgress';

interface WaterDropletLoaderProps {
  /** Time for the droplet to fill, in milliseconds. */
  durationMs?: number;
  /** Controlled workflow progress from 0 to 1; overrides the timed fill. */
  progress?: number;
  indeterminate?: boolean;
  size?: 'md' | 'sm';
  /** Text shown below the animation. */
  statusText?: string;
  /** Called once when the fill reaches 100%. */
  onComplete?: () => void;
}

const dropletPath =
  'M120 18 C107 52 34 121 34 186 C34 237 71 276 120 276 C169 276 206 237 206 186 C206 121 133 52 120 18Z';

// Each wave repeats every 240 SVG units so the -240px drift loop is seamless.
const backWavePath =
  'M-480 9 C-440 0 -400 0 -360 9 C-320 18 -280 18 -240 9 C-200 0 -160 0 -120 9 C-80 18 -40 18 0 9 C40 0 80 0 120 9 C160 18 200 18 240 9 C280 0 320 0 360 9 C400 18 440 18 480 9 C520 0 560 0 600 9 C640 18 680 18 720 9 V320 H-480Z';

const frontWavePath =
  'M-480 13 C-440 -3 -400 -3 -360 13 C-320 29 -280 29 -240 13 C-200 -3 -160 -3 -120 13 C-80 29 -40 29 0 13 C40 -3 80 -3 120 13 C160 29 200 29 240 13 C280 -3 320 -3 360 13 C400 29 440 29 480 13 C520 -3 560 -3 600 13 C640 29 680 29 720 13 V320 H-480Z';

export function WaterDropletLoader({
  durationMs = 8000,
  progress: requestProgress,
  indeterminate = false,
  size = 'md',
  statusText = 'Preparing your water plan…',
  onComplete,
}: WaterDropletLoaderProps) {
  const clipId = `water-droplet-clip-${useId().replace(/:/g, '')}`;
  const timedProgress = useTimedProgress(
    durationMs,
    indeterminate || requestProgress != null ? undefined : onComplete,
  );
  const progress = Math.max(0, Math.min(1, requestProgress ?? timedProgress));

  const waterY = indeterminate ? 140 : 286 - progress * 266;
  const percentage = Math.round(progress * 100);

  return (
    <section
      className={`${styles.loader} ${size === 'sm' ? styles.compact : ''}`}
      aria-label="WaterPilot loading"
    >
      <div className={styles.art} data-complete={!indeterminate && progress >= 1}>
        <svg
          className={styles.svg}
          viewBox="0 0 240 300"
          role="progressbar"
          aria-label={statusText}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={indeterminate ? undefined : percentage}
        >
          <defs>
            <clipPath id={clipId}>
              <path d={dropletPath} />
            </clipPath>
          </defs>

          <path className={styles.drop} d={dropletPath} />

          <g clipPath={`url(#${clipId})`}>
            <g transform={`translate(0 ${waterY})`}>
              <g className={styles.waveTrack}>
                <g transform="translate(70 0)">
                  <path className={styles.backWave} d={backWavePath} />
                </g>
              </g>
              <g className={styles.waveTrack}>
                <path className={styles.frontWave} d={frontWavePath} />
              </g>
            </g>

            <path className={styles.accentArc} d="M84 112 C69 135 57 160 54 186" />
          </g>
        </svg>
      </div>

      {/* The progressbar above carries the value for assistive technology. */}
      {!indeterminate && (
        <p className={styles.percentage} aria-hidden="true">
          {percentage}%
        </p>
      )}
      <p className={styles.status}>{statusText}</p>
    </section>
  );
}
