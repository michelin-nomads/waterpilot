import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { AuthFailure } from '../../auth/authErrors';
import { useAuth } from '../../auth/authContext';
import { Button } from '../../components/Button/Button';
import { Icon } from '../../components/Icon/Icon';
import { LoadingRegion, Skeleton } from '../../components/Skeleton/Skeleton';
import { ErrorState } from '../../components/StatePanel/StatePanel';
import { useOnlineStatus } from '../../lib/useOnlineStatus';
import { usePlanningSession } from '../../session/sessionContext';
import { pathForSessionStage } from '../../shell/stages';
import { toSessionMode, usePreferredPlanningMode } from '../planning/planningMode';
import { PlanningGuide } from './PlanningGuide';
import styles from './Welcome.module.scss';

const GUEST_PAUSED = 'New guest sessions are paused right now. Try again later or sign in.';
const START_FAILED = 'Your plan could not be started. Check your connection and try again.';

/**
 * The main screen (`/`), for everyone: choose Explorer or Copilot. Nobody has to sign in to
 * plan; starting without an account begins a guest session. Plans are not kept as drafts, so
 * there is never a plan to continue. Signing in is its own screen (`/signin`).
 */
export default function WelcomePage() {
  const auth = useAuth();
  const session = usePlanningSession();
  const online = useOnlineStatus();
  const navigate = useNavigate();
  const [mode, setMode] = usePreferredPlanningMode();
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const start = async (selectedMode = mode) => {
    setMode(selectedMode);
    setStarting(true);
    setStartError(null);
    try {
      const started = await session.newReport(toSessionMode(selectedMode));
      navigate(pathForSessionStage(started.stage));
    } catch (error) {
      const paused =
        error instanceof AuthFailure &&
        (error.kind === 'method-disabled' || error.kind === 'rate-limited');
      setStartError(paused ? GUEST_PAUSED : START_FAILED);
    } finally {
      setStarting(false);
    }
  };

  const offlineNoteId = 'welcome-offline-note';
  const failed = startError;

  if (auth.status === 'loading') {
    return (
      <LoadingRegion label="Loading WaterPilot">
        <Skeleton shape="block" />
      </LoadingRegion>
    );
  }
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>Water planning for your community</p>
        <h1 className={styles.title}>A better water plan starts here.</h1>
        <p className={styles.subtitle}>
          Understand your situation and explore practical improvements for your community.
        </p>
      </header>

      {auth.status === 'error' ? (
        <ErrorState title="Sign-in could not load" onRetry={auth.reload} headingLevel={2}>
          WaterPilot could not load its sign-in service, so planning cannot start yet. Check your
          connection and try again.
        </ErrorState>
      ) : (
        <>
          <section className={styles.choices} aria-label="Choose how to plan">
            <article className={styles.choice}>
              <span className={styles.choiceIcon}>
                <Icon name="sparkle" size="lg" />
              </span>
              <h2 className={styles.choiceTitle}>Guide me with WaterPilotAgent</h2>
              <p className={styles.choiceText}>
                Tell us what you need. Your agent will guide you while the workspace updates beside
                it.
              </p>
              <Button
                className={styles.choiceButton}
                size="lg"
                endIcon="arrow-right"
                loading={starting}
                aria-disabled={!online || undefined}
                aria-describedby={!online ? offlineNoteId : undefined}
                onClick={() => void start('agent')}
              >
                {failed && mode === 'agent' ? 'Try again' : 'Start with agent'}
              </Button>
            </article>
            <article className={styles.choice}>
              <span className={styles.choiceIcon}>
                <Icon name="chart" size="lg" />
              </span>
              <h2 className={styles.choiceTitle}>Explore on my own</h2>
              <p className={styles.choiceText}>
                Use the same tools at your own pace, with help available whenever you need it.
              </p>
              <Button
                className={styles.choiceButton}
                variant="secondary"
                size="lg"
                endIcon="arrow-right"
                loading={starting}
                aria-disabled={!online || undefined}
                aria-describedby={!online ? offlineNoteId : undefined}
                onClick={() => void start('traditional')}
              >
                {failed && mode === 'traditional' ? 'Try again' : 'Start exploring'}
              </Button>
            </article>
          </section>
          {failed && (
            <div role="alert" className={styles.error}>
              {startError}
            </div>
          )}
          <>
            <PlanningGuide />
            {!online && (
              <span id={offlineNoteId} className={styles.coverage}>
                You are offline. Starting needs a connection.
              </span>
            )}
          </>
        </>
      )}
    </div>
  );
}
