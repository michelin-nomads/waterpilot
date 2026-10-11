import { Notice } from '../../components/Notice/Notice';
import { usePlanningSession } from '../../session/sessionContext';
import styles from './PlanSummary.module.scss';

/**
 * The inputs this plan is built on, as the session holds them. Shown on every step so
 * Traditional and Agent mode, and every tab, show the same location, goal and choice.
 */
export function PlanSummary() {
  const { view, inputsPending } = usePlanningSession();
  if (!view) return null;
  const goal = view.goal ? view.goal.description || 'Goal set' : null;
  return (
    <>
      <dl className={styles.summary} aria-label="Your plan">
        <div>
          <dt>Location</dt>
          <dd>{view.areaId ? (view.areaName ?? 'Selected') : 'Not chosen yet'}</dd>
        </div>
        <div>
          <dt>Goal</dt>
          <dd>{goal ?? 'Not set yet'}</dd>
        </div>
        <div>
          <dt>Chosen plan</dt>
          <dd>{view.selectedPlanOptionId ? 'Chosen' : 'Not chosen yet'}</dd>
        </div>
      </dl>
      {inputsPending && (
        <Notice kind="stale">
          Your location, goal or what-if changes are not saved yet. Plan comparisons, funding
          matches and proposal previews will be worked out again for the new inputs once they are
          saved.
        </Notice>
      )}
    </>
  );
}
