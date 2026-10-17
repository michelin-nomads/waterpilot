import { Notice } from '../../components/Notice/Notice';
import { usePlanningSession } from '../../session/sessionContext';

/** Explain when changed inputs are waiting to update derived results. */
export function PlanInputNotice() {
  const { inputsPending } = usePlanningSession();
  return (
    <>
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
