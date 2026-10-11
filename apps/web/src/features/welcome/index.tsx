import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { AuthFailure, toAuthFailure } from '../../auth/authErrors';
import { useAuth } from '../../auth/authContext';
import { Button, ButtonLink } from '../../components/Button/Button';
import { Icon, type IconName } from '../../components/Icon/Icon';
import { Notice } from '../../components/Notice/Notice';
import { ErrorState } from '../../components/StatePanel/StatePanel';
import { StepActions } from '../../components/StepActions/StepActions';
import { useOnlineStatus } from '../../lib/useOnlineStatus';
import { usePlanningSession } from '../../session/sessionContext';
import { PageHeader } from '../../shell/PageHeader';
import { pathForSessionStage } from '../../shell/stages';
import { ModeChooser } from '../planning/ModeChooser';
import { toSessionMode, usePreferredPlanningMode } from '../planning/planningMode';
import styles from './Welcome.module.scss';

const BENEFITS: ReadonlyArray<{ icon: IconName; title: string; text: string }> = [
  {
    icon: 'map',
    title: 'Understand your area',
    text: 'See what is known about water where you live, and what is not.',
  },
  {
    icon: 'layers',
    title: 'Compare plans',
    text: 'Weigh options side by side, with the assumptions behind every figure.',
  },
  {
    icon: 'chart',
    title: 'Track results',
    text: 'Record what happens once work starts, against the goal you set.',
  },
];

const GUEST_PAUSED = 'New guest sessions are paused right now. Try again later or sign in.';
const START_FAILED = 'Your plan could not be started. Check your connection and try again.';

/**
 * S1 Welcome: choose how to plan, then start as a guest (an anonymous account) or sign in.
 * Signed-in accounts land on their dashboard; a guest with a plan continues it.
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
  const [signInCancelled, setSignInCancelled] = useState(false);

  if (auth.status === 'ready' && auth.user?.kind === 'permanent') {
    return <Navigate to="/dashboard" replace />;
  }

  const start = async () => {
    setStarting(true);
    setFailure(null);
    setStartError(null);
    setSignInCancelled(false);
    try {
      try {
        await auth.startGuest();
      } catch (error) {
        setFailure(toAuthFailure(error));
        return;
      }
      try {
        const started = await session.startPlanning(toSessionMode(mode));
        navigate(pathForSessionStage(started.stage));
      } catch {
        setStartError(START_FAILED);
      }
    } finally {
      setStarting(false);
    }
  };

  const signIn = async () => {
    setFailure(null);
    setSignInCancelled(!(await auth.openSignIn()));
  };

  const sessionLoading = auth.user !== null && session.state.status === 'loading';
  const current = session.state.status === 'ready' ? session.view : null;
  const offlineNoteId = 'welcome-offline-note';
  const guestPaused = failure?.kind === 'method-disabled' || failure?.kind === 'rate-limited';
  const failed = (failure && !guestPaused) || startError;

  return (
    <div className={styles.page}>
      <PageHeader
        title="Plan for water security, together"
        subtitle="WaterLens helps you understand your area's water, compare practical plans and track what changes."
      />

      <section aria-labelledby="welcome-benefits" className={styles.benefits}>
        <h2 id="welcome-benefits" className={styles.sectionTitle}>
          What you get
        </h2>
        <ul className={styles.list}>
          {BENEFITS.map((benefit) => (
            <li key={benefit.title} className={styles.item}>
              <Icon name={benefit.icon} />
              <div>
                <p className={styles.itemTitle}>{benefit.title}</p>
                <p className={styles.itemText}>{benefit.text}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className={styles.coverage}>
          Coverage varies by location; we show what is known and what is not.
        </p>
      </section>

      {auth.status === 'error' ? (
        <ErrorState title="Sign-in could not load" onRetry={auth.reload} headingLevel={2}>
          WaterLens could not load its sign-in service, so planning cannot start yet. Check your
          connection and try again.
        </ErrorState>
      ) : (
        <>
          {!current && !sessionLoading && <ModeChooser value={mode} onChange={setMode} />}
          {guestPaused && <Notice kind="budget">{GUEST_PAUSED}</Notice>}
          {failed && (
            <div role="alert" className={styles.error}>
              {startError ?? failure?.message}
            </div>
          )}
          {signInCancelled && (
            <Notice kind="auth-cancelled">
              Sign-in was cancelled. You can still start planning as a guest.
            </Notice>
          )}
          <StepActions
            primary={
              current ? (
                <Button
                  size="lg"
                  endIcon="arrow-right"
                  onClick={() => navigate(pathForSessionStage(current.stage))}
                >
                  Continue planning
                </Button>
              ) : (
                <Button
                  size="lg"
                  endIcon="arrow-right"
                  loading={starting || auth.status === 'loading' || sessionLoading}
                  aria-disabled={!online || undefined}
                  aria-describedby={!online ? offlineNoteId : undefined}
                  onClick={() => void start()}
                >
                  {failed ? 'Try again' : 'Start planning'}
                </Button>
              )
            }
            secondary={
              current ? (
                <ButtonLink to="/start" variant="ghost" size="lg">
                  New report
                </ButtonLink>
              ) : (
                <Button
                  variant="ghost"
                  size="lg"
                  aria-disabled={auth.status === 'loading' || undefined}
                  onClick={() => void signIn()}
                >
                  Sign in to your account
                </Button>
              )
            }
            note={
              !online ? (
                <span id={offlineNoteId}>You are offline. Starting needs a connection.</span>
              ) : auth.user?.kind === 'guest' ? (
                'You are planning as a guest. Sign in before finalizing a report.'
              ) : (
                'No account needed to plan. You will be asked to sign in before finalizing a report.'
              )
            }
          />
        </>
      )}
    </div>
  );
}
