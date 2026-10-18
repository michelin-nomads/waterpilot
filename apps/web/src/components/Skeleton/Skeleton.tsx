import type { ReactNode } from 'react';

import { WaterDropletLoader } from '../WaterDropletLoader/WaterDropletLoader';
import styles from './Skeleton.module.scss';

interface SkeletonProps {
  shape?: 'text' | 'title' | 'block' | 'circle';
  width?: 'full' | 'three-quarters' | 'half' | 'third';
}

/** Decorative placeholder; always render inside a `LoadingRegion` that names what is loading. */
export function Skeleton({ shape = 'text', width = 'full' }: SkeletonProps) {
  return (
    <span className={`${styles.skeleton} ${styles[shape]} ${styles[width]}`} aria-hidden="true" />
  );
}

interface LoadingRegionProps {
  /** Announced to screen readers, e.g. "Loading area profile". */
  label: string;
  children?: ReactNode;
}

/**
 * Shared page/data loader. Existing skeleton children remain accepted for compatibility;
 * the droplet replaces them without delaying ready content or inventing progress.
 */
export function LoadingRegion({ label }: LoadingRegionProps) {
  return (
    <div className={styles.region} role="status" aria-busy="true">
      <WaterDropletLoader size="sm" indeterminate statusText={label} />
    </div>
  );
}
