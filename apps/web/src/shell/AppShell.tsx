import { lazy, Suspense } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../auth/authContext';
import { Badge } from '../components/Badge/Badge';
import { Logo } from '../components/Logo/Logo';
import { env } from '../config/env';
import { AccountMenu } from './AccountMenu';
import styles from './AppShell.module.scss';
import { DisplayMenu } from './DisplayMenu';
import { OfflineNotice } from './OfflineNotice';
import { RouteProgress } from './RouteStatus';
const PlanningModeToggle = lazy(() =>
  import('../features/planning/PlanningModeToggle').then((module) => ({
    default: module.PlanningModeToggle,
  })),
);
import { usePlanningMode } from '../features/planning/planningMode';
import { usePlanningSession } from '../session/sessionContext';
import { pathForSessionStage, stageForPath } from './stages';
import { useRouteFocus } from './useRouteFocus';

function navClass({ isActive }: { isActive: boolean }): string {
  return isActive ? `${styles.navLink} ${styles.active}` : styles.navLink;
}

export default function AppShell() {
  useRouteFocus();
  const { pathname } = useLocation();
  const { view } = usePlanningSession();
  const [planningMode, setPlanningMode] = usePlanningMode();
  const auth = useAuth();
  const signedIn = auth.status === 'ready' && auth.user?.kind === 'permanent';
  const inPlanning = stageForPath(pathname) !== null;
  const welcomeFlow = pathname === '/' && !signedIn;
  const planPath = pathForSessionStage(view?.stage);

  return (
    <div
      className={styles.shell}
      data-welcome-flow={welcomeFlow || undefined}
      data-planning={inPlanning || undefined}
    >
      <a className={styles.skip} href="#main">
        Skip to main content
      </a>
      <RouteProgress />
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to="/" className={styles.brand} aria-label="WaterPilot home">
            <Logo />
          </Link>
          <p className={styles.tagline}>Smarter Communities. More Water Secure.</p>
          {signedIn && (
            <nav aria-label="Primary" className={styles.primaryNav}>
              {inPlanning && (
                <Link
                  to={planPath}
                  className={`${styles.navLink} ${styles.active}`}
                  aria-current="true"
                >
                  Plan
                </Link>
              )}
              {/* Review lives under /reports; inside the planner only Plan is current. */}
              <NavLink to="/reports" end={inPlanning} className={navClass}>
                Reports
              </NavLink>
              <NavLink to="/communities" className={navClass}>
                Communities
              </NavLink>
            </nav>
          )}
          <p className={styles.strapline}>From insight to action for water-resilient communities</p>
          <div className={styles.tools}>
            {inPlanning && (
              <div className={styles.modeSlot}>
                <Suspense fallback={null}>
                  <PlanningModeToggle mode={planningMode} onChange={setPlanningMode} />
                </Suspense>
              </div>
            )}
            <DisplayMenu />
            <AccountMenu guestSignIn={!inPlanning} />
          </div>
        </div>
      </header>
      <OfflineNotice />
      <main id="main" tabIndex={-1} className={styles.main}>
        <Outlet context={{ planningMode, setPlanningMode }} />
      </main>
      <footer className={styles.footer}>
        <p>WaterPilot helps communities plan for a more water-secure future.</p>
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
