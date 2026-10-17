import type { ReactNode } from 'react';

import { Icon } from '../../components/Icon/Icon';
import styles from './Workspace.module.scss';

interface WorkspaceToolbarProps {
  searchLabel: string;
  search: string;
  onSearchChange: (value: string) => void;
  showArchived: boolean;
  onShowArchivedChange: (value: boolean) => void;
  /** Extra controls placed after the archived toggle. */
  children?: ReactNode;
}

/** Search field and "Show archived" toggle shared by the Reports and Communities tabs. */
export function WorkspaceToolbar({
  searchLabel,
  search,
  onSearchChange,
  showArchived,
  onShowArchivedChange,
  children,
}: WorkspaceToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <label className={styles.search}>
        <Icon name="search" />
        <input
          type="search"
          value={search}
          placeholder={`${searchLabel}…`}
          aria-label={searchLabel}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </label>
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(event) => onShowArchivedChange(event.target.checked)}
        />
        Show archived
      </label>
      {children}
    </div>
  );
}
