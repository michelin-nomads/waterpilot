import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { PLANNING_STAGES, stageForPath } from '../../shell/stages';
import styles from './StageNav.module.scss';
import { usePlanningSession } from '../../session/sessionContext';
import { canOpenStage } from './stageAccess';

/** Only stages unlocked by saved completion are links. */
export function StageNav() {
  const { pathname } = useLocation();
  const navRef = useRef<HTMLElement>(null);
  const { state } = usePlanningSession();
  const currentIndex = PLANNING_STAGES.findIndex(
    (stage) => stage.id === stageForPath(pathname)?.id,
  );

  useEffect(() => {
    navRef.current?.querySelector<HTMLElement>('[aria-current="step"]')?.scrollIntoView?.({
      block: 'nearest',
      inline: 'nearest',
    });
  }, [currentIndex]);

  return (
    <nav ref={navRef} aria-label="Planning stages" className={styles.nav}>
      {currentIndex >= 0 && (
        <p className={styles.position}>
          Step {currentIndex + 1} of {PLANNING_STAGES.length}
        </p>
      )}
      <ol className={styles.list}>
        {PLANNING_STAGES.map((stage, index) => (
          <li key={stage.id} className={styles.item}>
            {canOpenStage(stage, state.server) ? (
              <Link
                to={stage.path}
                aria-current={currentIndex === index ? 'step' : undefined}
                className={styles.link}
              >
                <span className={styles.number} aria-hidden="true">
                  {index + 1}
                </span>
                <span className={styles.label}>{stage.label}</span>
              </Link>
            ) : (
              <span
                className={styles.link}
                aria-disabled="true"
                title="Complete the previous step first"
              >
                <span className={styles.number} aria-hidden="true">
                  {index + 1}
                </span>
                <span className={styles.label}>{stage.label}</span>
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
