import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  Button,
  ButtonLink,
  Drawer,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingRegion,
  Notice,
  Skeleton,
} from '../../components';
import { useAuth } from '../../auth/authContext';
import { PlanComparisonDocument, type SelectedPlanStatus } from '../../graphql/generated/graphql';
import { useGraphQLQuery } from '../../graphql/hooks';
import { queryKeys } from '../../graphql/queryKeys';
import { usePlanningSession } from '../../session/sessionContext';
import { PageHeader } from '../../shell/PageHeader';
import { getStage, PLANNING_STAGES } from '../../shell/stages';
import { ReviewWorkspace } from './ReviewWorkspace';
import { FINALIZE_SIGN_IN_REASON, useFinalizeReport } from './useFinalizeReport';
import styles from './Reports.module.scss';

export default function ReviewPage() {
  const session = usePlanningSession();
  const auth = useAuth();
  const signedIn = auth.user?.kind === 'permanent';
  const { finalize, isPending, error } = useFinalizeReport();
  const navigate = useNavigate();
  const current = session.state.status === 'ready' ? session.view : null;
  const revision = session.state.server?.inputsRevision ?? current?.inputsRevision ?? 0;
  const comparisonQuery = useGraphQLQuery(
    queryKeys.sessions.planComparison(current?.id ?? '', revision),
    PlanComparisonDocument,
    { id: current?.id ?? '' },
    {
      enabled: Boolean(
        current?.id &&
        current.selectedPlanOptionId &&
        current.goal &&
        current.areaId &&
        !session.inputsPending,
      ),
    },
  );
  const [title, setTitle] = useState('Water plan');
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // The report replaces the plan: show a neutral state while its page opens.
  const [finalized, setFinalized] = useState(false);

  const found = comparisonQuery.data?.planningSession ?? null;
  const selected = found?.planComparison.options.find(
    (option) => option.id === current?.selectedPlanOptionId,
  );
  const selectionStatus: SelectedPlanStatus | null = found?.selectedPlanStatus ?? null;
  const selectionCurrent = Boolean(
    selected && selectionStatus === 'CURRENT' && !session.inputsPending,
  );

  if (finalized) {
    return (
      <div className={styles.reviewPage}>
        <PageHeader
          eyebrow={`Step ${getStage('review').index + 1} of ${PLANNING_STAGES.length}`}
          title="Take Action"
        />
        <LoadingRegion label="Opening your report">
          <Skeleton shape="block" />
        </LoadingRegion>
      </div>
    );
  }

  if (session.state.status === 'loading') {
    return (
      <div className={styles.reviewPage}>
        <PageHeader
          eyebrow={`Step ${getStage('review').index + 1} of ${PLANNING_STAGES.length}`}
          title="Take Action"
        />
        <LoadingRegion label="Loading your current plan">
          <Skeleton shape="block" />
        </LoadingRegion>
      </div>
    );
  }

  if (!current) {
    return (
      <div className={styles.reviewPage}>
        <PageHeader
          eyebrow={`Step ${getStage('review').index + 1} of ${PLANNING_STAGES.length}`}
          title="Take Action"
        />
        <EmptyReview />
      </div>
    );
  }

  const missing = !current.areaId || !current.goal || !current.selectedPlanOptionId;
  const submit = async () => {
    if (!selectionCurrent || !signedIn || !title.trim() || isPending) return;
    setMessage(null);
    try {
      const result = await finalize({ sessionId: current.id, title: title.trim() });
      if (result.status === 'finalized') {
        // The finalized report replaces the plan, which is not kept as a draft.
        setFinalized(true);
        session.coordinator?.discard();
        navigate(`/reports/${result.report.id}?created=1`);
      }
      if (result.status === 'cancelled')
        setMessage('Sign-in was cancelled. Nothing was finalized.');
      if (result.status === 'busy') setMessage('Finalization is already in progress.');
    } catch {
      setMessage('The plan could not be finalized. Review any recent edits and try again.');
    }
  };

  return (
    <div className={styles.reviewPage}>
      <PageHeader
        eyebrow={`Step ${getStage('review').index + 1} of ${PLANNING_STAGES.length}`}
        title="Take Action"
        subtitle="Review the full picture, then create your community’s final plan."
      />
      {missing ? (
        <EmptyReview current={current} />
      ) : session.inputsPending ? (
        <Notice kind="stale" title="Saving your recent planning edits">
          Review will refresh against those inputs once they are saved. Keep this session open; the
          selected plan will be checked again before finalization.
        </Notice>
      ) : comparisonQuery.isPending ? (
        <LoadingRegion label="Loading the current plan for review">
          <Skeleton shape="block" />
        </LoadingRegion>
      ) : comparisonQuery.isError ? (
        <ErrorState
          title="The current plan could not load"
          onRetry={() => void comparisonQuery.refetch()}
          retrying={comparisonQuery.isFetching}
        >
          Your planning session is safe. Retry before saving the report.
        </ErrorState>
      ) : !selectionCurrent ? (
        <Notice
          kind="stale"
          title="Review the current comparison before saving"
          action={<ButtonLink to="/plans">Return to Compare plans</ButtonLink>}
        >
          This selected option is missing or its wider-impact assessment changed. Choose a current
          option before saving. Nothing has been finalized.
        </Notice>
      ) : selected ? (
        <>
          <ReviewWorkspace
            current={current}
            comparison={found!.planComparison}
            selected={selected}
            signedIn={signedIn}
            onSignIn={() => void auth.openSignIn(FINALIZE_SIGN_IN_REASON)}
            onFinalize={() => setFinalizeOpen(true)}
          />
          <Drawer
            open={finalizeOpen}
            onClose={() => {
              if (!isPending) setFinalizeOpen(false);
            }}
            title="Finalize report"
            description="Create a read-only snapshot of the details you reviewed."
            footer={
              <>
                <Button
                  variant="secondary"
                  disabled={isPending}
                  onClick={() => setFinalizeOpen(false)}
                >
                  Keep reviewing
                </Button>
                <Button
                  loading={isPending}
                  disabled={
                    !signedIn || !title.trim() || session.inputsPending || !selectionCurrent
                  }
                  onClick={() => void submit()}
                >
                  Finalize & save report
                </Button>
              </>
            }
          >
            <div className={styles.review}>
              <Field id="report-title" label="Report title" required>
                {(props) => (
                  <Input
                    {...props}
                    placeholder="Name your community water plan"
                    maxLength={200}
                    value={title}
                    disabled={isPending}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                )}
              </Field>
              <h3>What your report includes</h3>
              <p>
                Saved area context, goal, selected plan and estimates, available evidence,
                assumptions and recorded funding details.
              </p>
              <Notice kind="info" title="A report is a planning record" announce={false}>
                Finalization preserves the available evidence and limitations. It does not approve a
                project, submit a funding application or start construction.
              </Notice>
              {(message || error) && (
                <p className={styles.error} role="alert">
                  {message ?? 'Finalization failed. Please try again.'}
                </p>
              )}
            </div>
          </Drawer>
        </>
      ) : null}
    </div>
  );
}

function EmptyReview({ current }: { current?: ReturnType<typeof usePlanningSession>['view'] }) {
  const destination = !current?.areaId ? '/area' : !current.goal ? '/goals' : '/plans';
  return (
    <EmptyState icon="file" title="A complete plan is needed before review">
      Choose a location, set a goal and select a current plan first.
      <p>
        <ButtonLink to={destination}>Complete the missing step</ButtonLink>
      </p>
    </EmptyState>
  );
}
