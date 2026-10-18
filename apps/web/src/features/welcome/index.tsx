import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { AuthFailure } from '../../auth/authErrors';
import { useAuth } from '../../auth/authContext';
import { Button } from '../../components/Button/Button';
import { LoadingRegion, Skeleton } from '../../components/Skeleton/Skeleton';
import { ErrorState } from '../../components/StatePanel/StatePanel';
import { useOnlineStatus } from '../../lib/useOnlineStatus';
import { usePlanningSession } from '../../session/sessionContext';
import { pathForSessionStage } from '../../shell/stages';
import {
  toSessionMode,
  usePreferredPlanningMode,
  type PlanningMode,
} from '../planning/planningMode';
import { WaterPlanPreview } from './WaterPlanPreview';
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
  const [startingMode, setStartingMode] = useState<PlanningMode | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  const start = async (selectedMode = mode) => {
    setMode(selectedMode);
    setStartingMode(selectedMode);
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
      setStartingMode(null);
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
      <div className={styles.heroGrid}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>Water planning for your community</p>
          <h1 className={styles.title}>
            Understand your water.
            <br /> <em>Plan a better future.</em>
          </h1>
          <p className={styles.subtitle}>
            Gemini Understands. The engine calculates. <strong>You decide</strong>
          </p>
          <p className={styles.principle}>
            WaterPilot helps communities understand local water challenges, compare practical
            solutions, and turn them into a plan of action.
          </p>
          {auth.status === 'error' ? (
            <ErrorState title="Sign-in could not load" onRetry={auth.reload} headingLevel={2}>
              WaterPilot could not load its sign-in service, so planning cannot start yet. Check
              your connection and try again.
            </ErrorState>
          ) : (
            <>
              <div className={styles.actions} aria-label="Choose how to plan">
                <Button
                  size="lg"
                  endIcon="arrow-right"
                  loading={startingMode === 'agent'}
                  disabled={startingMode !== null && startingMode !== 'agent'}
                  aria-disabled={!online || undefined}
                  aria-describedby={!online ? offlineNoteId : undefined}
                  onClick={() => void start('agent')}
                >
                  {failed && mode === 'agent' ? 'Try again' : 'Start with Agent'}
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  loading={startingMode === 'traditional'}
                  disabled={startingMode !== null && startingMode !== 'traditional'}
                  aria-disabled={!online || undefined}
                  aria-describedby={!online ? offlineNoteId : undefined}
                  onClick={() => void start('traditional')}
                >
                  {failed && mode === 'traditional' ? 'Try again' : 'Explore on my own'}
                </Button>
              </div>
              <p className={styles.note}>
                <span aria-hidden="true">✓</span> Start with guided help. No account needed to
                explore.
              </p>
              {failed && (
                <div role="alert" className={styles.error}>
                  {startError}
                </div>
              )}
              {!online && (
                <p id={offlineNoteId} className={styles.coverage}>
                  You are offline. Starting needs a connection.
                </p>
              )}
            </>
          )}
        </header>
        <WaterPlanPreview />
      </div>
      <section className={styles.how} aria-label="How WaterPilot works">
        <p className={styles.sectionLabel}>From water questions to a way forward</p>
        <ol className={styles.steps}>
          <li>
            <h2>
              <span>1</span>Understand your area
            </h2>
            <p>Choose your location and build a picture of your community’s water situation.</p>
          </li>
          <li>
            <h2>
              <span>2</span>Compare what could help
            </h2>
            <p>Explore options such as rainwater harvesting and water reuse against your goals.</p>
          </li>
          <li>
            <h2>
              <span>3</span>Put a plan into motion
            </h2>
            <p>Create a report to share, explore funding eligibility, and track next steps.</p>
          </li>
        </ol>
      </section>
      <footer className={styles.footer}>
        <p>Made for communities planning a more water-resilient future.</p>
        <p>Sign in when you’re ready to save your report.</p>
      </footer>
    </div>
  );
}
