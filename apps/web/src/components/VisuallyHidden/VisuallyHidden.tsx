import type { ReactNode } from 'react';

import styles from './VisuallyHidden.module.scss';

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className={styles.hidden}>{children}</span>;
}
