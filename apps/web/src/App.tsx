import { Link, Outlet } from 'react-router-dom';

import styles from './App.module.scss';

/**
 * Provisional application shell for Phase 02 wiring only. The real AppShell, six-stage
 * navigation, theming and design system are implemented in Phase 03 from the approved
 * assets and the eight reference screens.
 */
const STAGES = [
  { path: '/area', label: 'Understand Your Area' },
  { path: '/scenarios', label: 'Test a Future Scenario' },
  { path: '/goals', label: 'Set Your Goal' },
  { path: '/plans', label: 'Compare Plans' },
  { path: '/funding', label: 'Make It Happen' },
  { path: '/tracking', label: 'Take Action & Track' },
] as const;

export default function App() {
  return (
    <div className={styles.shell}>
      <header>
        <nav className={styles.nav} aria-label="Primary">
          {STAGES.map((stage) => (
            <Link key={stage.path} to={stage.path}>
              {stage.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
