import { lazy, Suspense } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../auth/authContext';
import { Badge } from '../components/Badge/Badge';
import { Logo } from '../components/Logo/Logo';
import { env } from '../config/env';
import { AccountMenu } from './AccountMenu';
import styles from './AppShell.module.scss';
const DisplayMenu = lazy(() =>
  import('./DisplayMenu').then((module) => ({ default: module.DisplayMenu })),
);
import { OfflineNotice } from './OfflineNotice';
import { RouteProgress } from './RouteStatus';
const PlanningModeToggle = lazy(() =>
  import('../features/planning/PlanningModeToggle').then((module) => ({
    default: module.PlanningModeToggle,
  })),
);
import { usePlanningMode } from '../features/planning/planningMode';
import { stageForPath } from './stages';
import { useRouteFocus } from './useRouteFocus';

const SIGN_IN_PATH = '/signin';

function navClass({ isActive }: { isActive: boolean }): string {
  return isActive ? `${styles.navLink} ${styles.active}` : styles.navLink;
}

export default function AppShell() {
  useRouteFocus();
  const { pathname } = useLocation();
  const [planningMode, setPlanningMode] = usePlanningMode();
  const auth = useAuth();
  const signedIn = auth.status === 'ready' && auth.user?.kind === 'permanent';
  const inPlanning = stageForPath(pathname) !== null;
  const welcomeFlow = (pathname === '/' || pathname === SIGN_IN_PATH) && !signedIn;
  // On the sign-in screen the page is the sign-in; inside the planner it is a dialog, so the
  // plan stays exactly as it is; anywhere else it opens the sign-in screen.
  const signInPresentation = pathname === SIGN_IN_PATH ? null : inPlanning ? 'dialog' : 'page';

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
          <div className={styles.start}>
            <Link to="/" className={styles.brand} aria-label="WaterPilot home">
              <Logo />
            </Link>
            <p className={styles.tagline}>Smarter Communities. More Water Secure.</p>
          </div>
          {signedIn && (
            <nav aria-label="Primary" className={styles.primaryNav}>
              {/* Only the reports list marks this destination current. */}
              <NavLink to="/reports" end className={navClass}>
                Reports
              </NavLink>
              <NavLink to="/communities" className={navClass}>
                Communities
              </NavLink>
            </nav>
          )}
          <div className={styles.end}>
            <p className={styles.strapline}>
              From insight to action for water-resilient communities
            </p>
            <div className={styles.tools}>
              {inPlanning && (
                <div className={styles.modeSlot}>
                  <Suspense fallback={null}>
                    <PlanningModeToggle mode={planningMode} onChange={setPlanningMode} />
                  </Suspense>
                </div>
              )}
              <DisplayMenu />
              <AccountMenu signIn={signInPresentation} showGuestLabel={pathname !== SIGN_IN_PATH} />
            </div>
          </div>
        </div>
      </header>
      <OfflineNotice />
      <main id="main" tabIndex={-1} className={styles.main}>
        <Outlet context={{ planningMode, setPlanningMode }} />
      </main>
      {env.appMode === 'local' && (
        <footer className={styles.footer}>
          <div className={styles.footerMeta}>
            <Badge tone="info">
              {env.maps.provider === 'google'
                ? 'Local backend · live Google Maps'
                : 'Local mode · emulators only'}
            </Badge>
            <Link to="/design-system">Design system (UI fixtures)</Link>
          </div>
        </footer>
      )}
    </div>
  );
}
