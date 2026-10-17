import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { AuthFailure, toAuthFailure } from '../../auth/authErrors';
import { useAuth } from '../../auth/authContext';
import { Button } from '../../components/Button/Button';
import { Icon, type IconName } from '../../components/Icon/Icon';
import { Notice } from '../../components/Notice/Notice';
import { LoadingRegion, Skeleton } from '../../components/Skeleton/Skeleton';
import { ErrorState } from '../../components/StatePanel/StatePanel';
import { useOnlineStatus } from '../../lib/useOnlineStatus';
import { usePlanningSession } from '../../session/sessionContext';
import { pathForSessionStage } from '../../shell/stages';
import { toSessionMode, usePreferredPlanningMode } from '../planning/planningMode';
import { SignInScreen } from './SignInScreen';
import styles from './Welcome.module.scss';

const BENEFITS: ReadonlyArray<{ icon: IconName; text: string }> = [
  {
    icon: 'map',
    text: 'Understand what is known about water where you live, and what is not.',
  },
  {
    icon: 'layers',
    text: 'Compare practical plans with the assumptions behind every figure.',
  },
  {
    icon: 'chart',
    text: 'Track results against the goal you set when work starts.',
  },
];

const GUEST_PAUSED = 'New guest sessions are paused right now. Try again later or sign in.';
const START_FAILED = 'Your plan could not be started. Check your connection and try again.';

/**
 * S1 Welcome. Without an account the first screen is sign-in, with "Continue as guest";
 * signed-in accounts go to their workspace; a guest chooses Explorer or Copilot here.
 * Plans are not kept as drafts, so there is never a plan to continue.
 */
export default function WelcomePage() {
  const auth = useAuth();
  const session = usePlanningSession();
  const online = useOnlineStatus();
  const navigate = useNavigate();
  const [mode, setMode] = usePreferredPlanningMode();
  const [starting, setStarting] = useState(false);
  const [failure, setFailure] = useState<AuthFailure | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  if (auth.status === 'ready' && auth.user?.kind === 'permanent') {
    return <Navigate to="/reports" replace />;
  }

  const continueAsGuest = async () => {
    if (!online) return;
    setStarting(true);
    setFailure(null);
    try {
      await auth.startGuest();
    } catch (error) {
      setFailure(toAuthFailure(error));
    } finally {
      setStarting(false);
    }
  };

  const start = async (selectedMode = mode) => {
    setMode(selectedMode);
    setStarting(true);
    setStartError(null);
    try {
      const started = await session.newReport(toSessionMode(selectedMode));
      navigate(pathForSessionStage(started.stage));
    } catch {
      setStartError(START_FAILED);
    } finally {
      setStarting(false);
    }
  };

  const offlineNoteId = 'welcome-offline-note';
  const guestPaused = failure?.kind === 'method-disabled' || failure?.kind === 'rate-limited';
  const failed = startError;

  if (auth.status === 'loading') {
    return (
      <LoadingRegion label="Loading WaterPilot">
        <Skeleton shape="block" />
      </LoadingRegion>
    );
  }

  if (auth.status === 'ready' && !auth.user) {
    return (
      <SignInScreen
        onContinueAsGuest={() => void continueAsGuest()}
        starting={starting}
        offline={!online}
        notice={
          guestPaused ? (
            <Notice kind="budget">{GUEST_PAUSED}</Notice>
          ) : failure ? (
            <div role="alert" className={styles.error}>
              {failure.message}
            </div>
          ) : null
        }
      />
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
            <details className={styles.howItWorks}>
              <summary>How WaterPilot works</summary>
              <ul className={styles.benefits}>
                {BENEFITS.map((benefit) => (
                  <li key={benefit.text} className={styles.benefit}>
                    <Icon name={benefit.icon} className={styles.benefitIcon} />
                    <span className={styles.benefitText}>{benefit.text}</span>
                  </li>
                ))}
              </ul>
            </details>
            <p className={styles.coverage}>
              Coverage varies by location. We show what is known and what is not. No account is
              needed to plan; sign in is required only to save your first report.
            </p>
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
