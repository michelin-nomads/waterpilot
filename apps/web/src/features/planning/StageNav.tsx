import { NavLink, useLocation } from 'react-router-dom';

import { PLANNING_STAGES, stageForPath } from '../../shell/stages';
import styles from './StageNav.module.scss';

/**
 * Five-stage stepper. The current stage carries aria-current="step". Completion markers
 * are not shown yet: they need the planning session (Phase 04/05), and the UI does not
 * guess progress.
 */
export function StageNav() {
  const { pathname } = useLocation();
  const currentIndex = PLANNING_STAGES.findIndex(
    (stage) => stage.id === stageForPath(pathname)?.id,
  );

  return (
    <nav aria-label="Planning stages" className={styles.nav}>
      {currentIndex >= 0 && (
        <p className={styles.position}>
          Step {currentIndex + 1} of {PLANNING_STAGES.length}
        </p>
      )}
      <ol className={styles.list}>
        {PLANNING_STAGES.map((stage, index) => (
          <li key={stage.id} className={styles.item}>
            <NavLink to={stage.path} aria-current="step" className={styles.link}>
              <span className={styles.number} aria-hidden="true">
                {index + 1}
              </span>
              <span className={styles.label}>{stage.label}</span>
            </NavLink>
          </li>
        ))}
      </ol>
    </nav>
  );
}
