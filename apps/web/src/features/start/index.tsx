import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../auth/authContext';
import { Button } from '../../components/Button/Button';
import { Dialog } from '../../components/Dialog/Dialog';
import { StepActions } from '../../components/StepActions/StepActions';
import { useOnlineStatus } from '../../lib/useOnlineStatus';
import { usePlanningSession } from '../../session/sessionContext';
import { PageHeader } from '../../shell/PageHeader';
import { getStage, pathForSessionStage, PLANNING_STAGES } from '../../shell/stages';
import { ModeChooser } from '../planning/ModeChooser';
import { toSessionMode, usePreferredPlanningMode } from '../planning/planningMode';
import styles from './Start.module.scss';

/**
 * S2 New report: choose a mode and start a fresh planning session. There is one current
 * session per person, so starting replaces it; finalized reports are never affected.
 */
export default function StartPage() {
  const auth = useAuth();
  const session = usePlanningSession();
  const online = useOnlineStatus();
  const navigate = useNavigate();
  const [mode, setMode] = usePreferredPlanningMode();
  const [confirming, setConfirming] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = session.state.status === 'ready' ? session.view : null;
  const currentStage = current
    ? PLANNING_STAGES.find((stage) => stage.sessionStage === current.stage)
    : undefined;

  const start = async () => {
    setConfirming(false);
    setStarting(true);
    setError(null);
    try {
      if (!auth.user) await auth.startGuest();
      const started = await session.newReport(toSessionMode(mode));
      navigate(pathForSessionStage(started.stage));
    } catch {
      setError('A new report could not be started. Check your connection and try again.');
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className={styles.page}>
      <PageHeader title="New report" subtitle="Start a new plan from the first step." />
      <ModeChooser value={mode} onChange={setMode} />
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <StepActions
        primary={
          <Button
            size="lg"
            endIcon="arrow-right"
            loading={starting || session.state.status === 'loading'}
            aria-disabled={!online || undefined}
            onClick={() => (current ? setConfirming(true) : void start())}
          >
            Start new report
          </Button>
        }
        secondary={
          current && (
            <Button
              variant="ghost"
              size="lg"
              onClick={() => navigate(pathForSessionStage(current.stage))}
            >
              Continue current plan
            </Button>
          )
        }
        note={!online ? 'You are offline. Starting needs a connection.' : undefined}
      />
      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Replace your current plan?"
        description={
          currentStage
            ? `Your current plan is at step ${getStage(currentStage.id).index + 1}, ${currentStage.label}.`
            : undefined
        }
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Keep current plan
            </Button>
            <Button onClick={() => void start()}>Start new report</Button>
          </>
        }
      >
        <p>
          You have one plan in progress at a time. Starting a new report closes the current plan;
          reports you have already finalized are not affected.
        </p>
      </Dialog>
    </div>
  );
}
