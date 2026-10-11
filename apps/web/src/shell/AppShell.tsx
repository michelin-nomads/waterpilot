import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';

import { Badge } from '../components/Badge/Badge';
import { Logo } from '../components/Logo/Logo';
import { env } from '../config/env';
import { AccountMenu } from './AccountMenu';
import styles from './AppShell.module.scss';
import { EarthBackground, WaterFlow } from './Decor';
import { DisplayMenu } from './DisplayMenu';
import { OfflineNotice } from './OfflineNotice';
import { RouteProgress } from './RouteStatus';
import { usePlanningSession } from '../session/sessionContext';
import { pathForSessionStage, PLANNING_STAGES } from './stages';
import { useRouteFocus } from './useRouteFocus';

function navClass({ isActive }: { isActive: boolean }): string {
  return isActive ? `${styles.navLink} ${styles.active}` : styles.navLink;
}

export default function AppShell() {
  useRouteFocus();
  const { pathname } = useLocation();
  const { view } = usePlanningSession();
  const inPlanning = PLANNING_STAGES.some((stage) => pathname.startsWith(stage.path));
  const planPath = pathForSessionStage(view?.stage);

  return (
    <div className={styles.shell}>
      <a className={styles.skip} href="#main">
        Skip to main content
      </a>
      <EarthBackground />
      <RouteProgress />
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to="/" className={styles.brand} aria-label="WaterLens home">
            <Logo />
          </Link>
          <p className={styles.tagline}>Smarter Communities. More Water Secure.</p>
          <nav aria-label="Primary" className={styles.primaryNav}>
            <Link
              to={planPath}
              className={inPlanning ? `${styles.navLink} ${styles.active}` : styles.navLink}
              aria-current={inPlanning ? 'true' : undefined}
            >
              Plan
            </Link>
            <NavLink to="/reports" className={navClass}>
              Reports
            </NavLink>
            <NavLink to="/communities" className={navClass}>
              Communities
            </NavLink>
          </nav>
          <p className={styles.strapline}>From insight to action for water-resilient communities</p>
          <div className={styles.tools}>
            <AccountMenu />
            <DisplayMenu />
          </div>
        </div>
        <WaterFlow />
      </header>
      <OfflineNotice />
      <main id="main" tabIndex={-1} className={styles.main}>
        <Outlet />
      </main>
      <footer className={styles.footer}>
        <p>
          Provisional visual design — approved brand assets were not supplied, so colours and the
          logo mark are placeholders.
        </p>
        <div className={styles.footerMeta}>
          {env.appMode === 'local' && (
            <>
              <Badge tone="info">Local mode · emulators only</Badge>
              <Link to="/design-system">Design system (UI fixtures)</Link>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}
