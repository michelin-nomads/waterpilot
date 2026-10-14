import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button, ButtonLink } from '../../components/Button/Button';
import { Notice } from '../../components/Notice/Notice';
import { EmptyState } from '../../components/StatePanel/StatePanel';
import { usePlanningSession } from '../../session/sessionContext';
import { PageHeader } from '../../shell/PageHeader';
import { useFinalizeReport } from './useFinalizeReport';
import styles from './Reports.module.scss';

export default function ReviewPage() {
  const session = usePlanningSession();
  const { finalize, isPending, error } = useFinalizeReport();
  const navigate = useNavigate();
  const current = session.state.status === 'ready' ? session.view : null;
  const [title, setTitle] = useState('Water plan');
  const [message, setMessage] = useState<string | null>(null);

  if (!current || !current.selectedPlanOptionId || !current.goal || !current.areaId) {
    return (
      <main className={styles.page}>
        <PageHeader title="Review plan" />
        <EmptyState icon="file" title="A complete plan is needed before review">
          Choose a location, set a goal and select a current plan first.
          <p>
            <ButtonLink to="/start">New report</ButtonLink>
          </p>
        </EmptyState>
      </main>
    );
  }

  const submit = async () => {
    setMessage(null);
    try {
      const result = await finalize({ sessionId: current.id, title: title.trim() });
      if (result.status === 'finalized') navigate(`/reports/${result.report.id}`);
      if (result.status === 'cancelled')
        setMessage('Sign-in was cancelled. Nothing was finalized.');
      if (result.status === 'busy') setMessage('Finalization is already in progress.');
    } catch {
      setMessage('The plan could not be finalized. Review any recent edits and try again.');
    }
  };

  return (
    <main className={styles.page}>
      <PageHeader
        title="Review your plan"
        subtitle="Finalization saves a read-only snapshot. Later planning changes do not alter it."
      />
      <section className={styles.review} aria-labelledby="review-summary">
        <h2 id="review-summary">Snapshot summary</h2>
        <dl>
          <div>
            <dt>Location</dt>
            <dd>{current.areaName ?? current.areaId}</dd>
          </div>
          <div>
            <dt>Goal</dt>
            <dd>
              {current.goal.description || current.goal.kind.replaceAll('_', ' ').toLowerCase()}
            </dd>
          </div>
          <div>
            <dt>Selected plan</dt>
            <dd>{current.selectedPlanOptionId}</dd>
          </div>
          <div>
            <dt>Planning mode</dt>
            <dd>{current.mode === 'AGENT' ? 'Agent' : 'Traditional'}</dd>
          </div>
        </dl>
        <Notice kind="info" title="The server checks that the plan is current">
          If its inputs or wider-impact assessment changed, finalization will ask you to review and
          choose again.
        </Notice>
        <label className={styles.label} htmlFor="report-title">
          Report title
        </label>
        <input
          id="report-title"
          className={styles.input}
          maxLength={200}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        {(message || error) && (
          <p className={styles.error} role="alert">
            {message ?? 'Finalization failed. Please try again.'}
          </p>
        )}
        <div className={styles.actions}>
          <Button
            loading={isPending}
            disabled={!title.trim() || session.inputsPending}
            onClick={() => void submit()}
          >
            Finalize report
          </Button>
          <ButtonLink to="/plans" variant="secondary">
            Back to plans
          </ButtonLink>
        </div>
      </section>
    </main>
  );
}
