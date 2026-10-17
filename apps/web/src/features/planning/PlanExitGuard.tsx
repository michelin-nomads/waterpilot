import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';

import { Button } from '../../components/Button/Button';
import { Dialog } from '../../components/Dialog/Dialog';
import { usePlanningSession } from '../../session/sessionContext';
import { stageForPath } from '../../shell/stages';

/**
 * Plans are not stored as drafts, so leaving the planner (or closing the tab) ends the
 * plan. This asks first, and only when there is a plan to lose. Moving between planning
 * steps never asks, and neither does leaving after the plan was finalized or discarded.
 */
export function PlanExitGuard() {
  const { coordinator, state } = usePlanningSession();
  const planning = state.status === 'ready';

  // Read at navigation time, so a plan discarded a moment ago never prompts again.
  const blocker = useBlocker(
    ({ nextLocation }) =>
      coordinator?.getState().status === 'ready' && stageForPath(nextLocation.pathname) === null,
  );

  useEffect(() => {
    if (!planning) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [planning]);

  return (
    <Dialog
      open={blocker.state === 'blocked'}
      onClose={() => blocker.reset?.()}
      title="Leave this plan?"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => blocker.reset?.()}>
            Stay on this plan
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              coordinator?.discard();
              blocker.proceed?.();
            }}
          >
            Leave and lose plan
          </Button>
        </>
      }
    >
      <p>
        Your plan will be lost. WaterPilot does not keep unfinished plans, so you would need to
        start again. Finalized reports are not affected.
      </p>
    </Dialog>
  );
}
