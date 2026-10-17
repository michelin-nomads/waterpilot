import type { ReactNode } from 'react';

import { PageHeader } from '../../shell/PageHeader';
import styles from './Workspace.module.scss';

interface WorkspacePageProps {
  title: string;
  subtitle: string;
  /** The page's main action, placed at the top right. */
  action: ReactNode;
  children: ReactNode;
}

/**
 * The frame shared by the signed-in pages (Reports, Communities): title and subtitle with
 * the page's main action at the top right, then the page's own content. The header's
 * Reports and Communities links are the navigation between them.
 */
export function WorkspacePage({ title, subtitle, action, children }: WorkspacePageProps) {
  return (
    <div className={styles.page}>
      <PageHeader title={title} subtitle={subtitle} actions={action} />
      {children}
    </div>
  );
}
