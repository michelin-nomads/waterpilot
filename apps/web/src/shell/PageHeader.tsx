import { useEffect, type ReactNode } from 'react';

import styles from './PageHeader.module.scss';

interface PageHeaderProps {
  title: string;
  titleSuffix?: ReactNode;
  eyebrow?: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}

/**
 * Page title block. The h1 is programmatically focusable so the shell can move focus to
 * it after client-side navigation; it also sets the document title.
 */
export function PageHeader({ title, titleSuffix, eyebrow, subtitle, actions }: PageHeaderProps) {
  useEffect(() => {
    document.title = `${title} · WaterPilot — AI-Redefined Water Saving`;
  }, [title]);

  return (
    <header className={styles.header}>
      <div className={styles.text}>
        {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
        <h1 className={styles.title} tabIndex={-1}>
          {title}
          {titleSuffix && (
            <>
              {' '}
              <span className={styles.titleSuffix}>{titleSuffix}</span>
            </>
          )}
        </h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
