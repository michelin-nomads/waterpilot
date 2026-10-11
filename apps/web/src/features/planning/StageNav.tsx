import { useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

import { Icon } from '../../components/Icon/Icon';
import { usePrefersReducedMotion } from '../../lib/useMediaQuery';
import { PLANNING_STAGES } from '../../shell/stages';
import styles from './StageNav.module.scss';

/**
 * Five-stage stepper. The current stage carries aria-current="step". Completion markers
 * are not shown yet: they need the planning session (Phase 04/05), and the UI does not
 * guess progress.
 */
export function StageNav() {
  const { pathname } = useLocation();
  const listRef = useRef<HTMLOListElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const currentIndex = PLANNING_STAGES.findIndex((stage) => pathname.startsWith(stage.path));

  // On narrow screens the list scrolls horizontally; keep the current stage in view.
  useEffect(() => {
    const current = listRef.current?.querySelector<HTMLElement>('[aria-current="step"]');
    current?.scrollIntoView?.({
      block: 'nearest',
      inline: 'center',
      behavior: reducedMotion ? 'auto' : 'smooth',
    });
  }, [pathname, reducedMotion]);

  return (
    <nav aria-label="Planning stages" className={styles.nav}>
      {currentIndex >= 0 && (
        <p className={styles.position}>
          Step {currentIndex + 1} of {PLANNING_STAGES.length}
        </p>
      )}
      <ol ref={listRef} className={styles.list}>
        {PLANNING_STAGES.map((stage, index) => (
          <li key={stage.id} className={styles.item}>
            <NavLink to={stage.path} aria-current="step" className={styles.link}>
              <span className={styles.number} aria-hidden="true">
                {index + 1}
              </span>
              <span className={styles.label}>{stage.label}</span>
            </NavLink>
            {index < PLANNING_STAGES.length - 1 && (
              <span className={styles.separator} aria-hidden="true">
                <Icon name="chevron-right" size="sm" />
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
