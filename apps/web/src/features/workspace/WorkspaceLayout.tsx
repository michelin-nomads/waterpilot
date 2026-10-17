import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

import { Button } from '../../components/Button/Button';
import { Icon } from '../../components/Icon/Icon';
import { PageHeader } from '../../shell/PageHeader';
import { NewReportDialog } from './NewReportDialog';
import styles from './Workspace.module.scss';

/**
 * The signed-in home: one workspace with Reports and Communities tabs and a New report
 * action. The tabs are routes, so each has its own address and survives a reload.
 */
export default function WorkspaceLayout() {
  const [newReportOpen, setNewReportOpen] = useState(false);

  return (
    <div className={styles.page}>
      <PageHeader
        title="Your water planning workspace"
        subtitle="Manage your reports and community plans."
      />
      <div className={styles.bar}>
        <nav aria-label="Workspace" className={styles.tabs}>
          <NavLink to="/reports" className={styles.tab}>
            <Icon name="clipboard" size="sm" />
            Reports
          </NavLink>
          <NavLink to="/communities" className={styles.tab}>
            <Icon name="users" size="sm" />
            Communities
          </NavLink>
        </nav>
        <Button startIcon="plus" onClick={() => setNewReportOpen(true)}>
          New report
        </Button>
      </div>
      <Outlet />
      <NewReportDialog open={newReportOpen} onClose={() => setNewReportOpen(false)} />
    </div>
  );
}
