import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { AuthFailure, toAuthFailure } from '../../auth/authErrors';
import { useAuth } from '../../auth/authContext';
import { Button, ButtonLink } from '../../components/Button/Button';
import { Icon, type IconName } from '../../components/Icon/Icon';
import { Notice } from '../../components/Notice/Notice';
import { ErrorState } from '../../components/StatePanel/StatePanel';
import { env } from '../../config/env';
import { useOnlineStatus } from '../../lib/useOnlineStatus';
import { usePlanningSession } from '../../session/sessionContext';
import { pathForSessionStage } from '../../shell/stages';
import { toSessionMode, usePreferredPlanningMode } from '../planning/planningMode';
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
 * S1 Welcome: start immediately in Explorer or Copilot as a guest, or sign in from the header.
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

  if (auth.status === 'ready' && auth.user?.kind === 'permanent') {
    return <Navigate to="/dashboard" replace />;
  }

  const start = async (selectedMode = mode) => {
    setMode(selectedMode);
    setStarting(true);
    setFailure(null);
    setStartError(null);
    try {
      try {
        await auth.startGuest();
      } catch (error) {
        setFailure(toAuthFailure(error));
        return;
      }
      try {
        const started = await session.startPlanning(toSessionMode(selectedMode));
        navigate(pathForSessionStage(started.stage));
      } catch {
        setStartError(START_FAILED);
      }
    } finally {
      setStarting(false);
    }
  };

  const sessionLoading = auth.user !== null && session.state.status === 'loading';
  const current = session.state.status === 'ready' ? session.view : null;
  const offlineNoteId = 'welcome-offline-note';
  const guestPaused = failure?.kind === 'method-disabled' || failure?.kind === 'rate-limited';
  const failed = (failure && !guestPaused) || startError;

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
          WaterLens could not load its sign-in service, so planning cannot start yet. Check your
          connection and try again.
        </ErrorState>
      ) : (
        <>
          {!current && !sessionLoading && (
            <section className={styles.choices} aria-label="Choose how to plan">
              <article className={styles.choice}>
                <span className={styles.choiceIcon}>
                  <Icon name="sparkle" size="lg" />
                </span>
                <h2 className={styles.choiceTitle}>Guide me with WaterLensAgent</h2>
                <p className={styles.choiceText}>
                  Tell us what you need. Your agent will guide you while the workspace updates
                  beside it.
                </p>
                <Button
                  className={styles.choiceButton}
                  size="lg"
                  endIcon="arrow-right"
                  loading={starting || auth.status === 'loading' || sessionLoading}
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
                  loading={starting || auth.status === 'loading' || sessionLoading}
                  aria-disabled={!online || undefined}
                  aria-describedby={!online ? offlineNoteId : undefined}
                  onClick={() => void start('traditional')}
                >
                  {failed && mode === 'traditional' ? 'Try again' : 'Start exploring'}
                </Button>
              </article>
            </section>
          )}
          {guestPaused && <Notice kind="budget">{GUEST_PAUSED}</Notice>}
          {failed && (
            <div role="alert" className={styles.error}>
              {startError ?? failure?.message}
            </div>
          )}
          {current && (
            <section className={styles.continue} aria-label="Continue your plan">
              <p>You already have a plan in progress.</p>
              <div className={styles.actions}>
                <Button
                  size="lg"
                  endIcon="arrow-right"
                  onClick={() => navigate(pathForSessionStage(current.stage))}
                >
                  Continue planning
                </Button>
                <ButtonLink to="/start" variant="ghost" size="lg">
                  New report
                </ButtonLink>
              </div>
            </section>
          )}
          {!current && !sessionLoading && (
            <>
              <details className={styles.howItWorks}>
                <summary>How WaterLens works</summary>
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
              {env.appMode === 'local' && (
                <details className={styles.previewPages}>
                  <summary>Browse other screens</summary>
                  <nav aria-label="WaterLens screen previews" className={styles.previewLinks}>
                    <Link to="/area">Understand your area</Link>
                    <Link to="/goals">Set a goal</Link>
                    <Link to="/plans">Compare plans</Link>
                    <Link to="/make-it-happen">Funding</Link>
                    <Link to="/start">New report</Link>
                    <Link to="/reports">Reports</Link>
                    <Link to="/proposals">Proposals</Link>
                    <Link to="/communities">Communities</Link>
                    <Link to="/tracking">Implementation projects</Link>
                    <Link to="/dashboard">Dashboard</Link>
                  </nav>
                  <p className={styles.coverage}>
                    Previewing a page does not start a plan. Some screens need a plan, saved report,
                    or signed-in account to show populated data.
                  </p>
                </details>
              )}
              {!online && (
                <span id={offlineNoteId} className={styles.coverage}>
                  You are offline. Starting needs a connection.
                </span>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
