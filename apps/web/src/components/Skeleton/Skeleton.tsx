import type { ReactNode } from 'react';

import { VisuallyHidden } from '../VisuallyHidden/VisuallyHidden';
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
  children: ReactNode;
}

/**
 * Wraps skeletons with a polite status message. Skeletons fade in after a short delay so
 * fast responses do not flash; content is never held back to show them.
 */
export function LoadingRegion({ label, children }: LoadingRegionProps) {
  return (
    <div className={styles.region} role="status" aria-busy="true">
      <VisuallyHidden>{label}</VisuallyHidden>
      {children}
    </div>
  );
}
