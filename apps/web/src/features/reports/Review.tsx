import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  Button,
  ButtonLink,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingRegion,
  Notice,
  Skeleton,
} from '../../components';
import { PlanComparisonDocument, type SelectedPlanStatus } from '../../graphql/generated/graphql';
import { useGraphQLQuery } from '../../graphql/hooks';
import { queryKeys } from '../../graphql/queryKeys';
import { usePlanningSession } from '../../session/sessionContext';
import { PageHeader } from '../../shell/PageHeader';
import {
  formatDays,
  formatMetric,
  formatMoneyRange,
  formatRange,
  TIMING_LABEL,
} from '../plans/plansFormat';
import { useFinalizeReport } from './useFinalizeReport';
import styles from './Reports.module.scss';

export default function ReviewPage() {
  const session = usePlanningSession();
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
  const [message, setMessage] = useState<string | null>(null);

  const found = comparisonQuery.data?.planningSession ?? null;
  const selected = found?.planComparison.options.find(
    (option) => option.id === current?.selectedPlanOptionId,
  );
  const selectionStatus: SelectedPlanStatus | null = found?.selectedPlanStatus ?? null;
  const selectionCurrent = Boolean(
    selected && selectionStatus === 'CURRENT' && !session.inputsPending,
  );

  if (session.state.status === 'loading') {
    return (
      <div className={styles.reviewPage}>
        <PageHeader title="Review your plan" />
        <LoadingRegion label="Loading your current plan">
          <Skeleton shape="block" />
        </LoadingRegion>
      </div>
    );
  }

  if (!current) {
    return (
      <div className={styles.reviewPage}>
        <PageHeader title="Review your plan" />
        <EmptyReview />
      </div>
    );
  }

  const missing = !current.areaId || !current.goal || !current.selectedPlanOptionId;
  const submit = async () => {
    if (!selectionCurrent) return;
    setMessage(null);
    try {
      const result = await finalize({ sessionId: current.id, title: title.trim() });
      if (result.status === 'finalized') navigate(`/reports/${result.report.id}?created=1`);
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
        title="Review your plan"
        subtitle="Check the location, goal, selected plan and assumptions before saving a read-only report."
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
          <section className={styles.reviewSection} aria-labelledby="review-location-title">
            <div className={styles.reviewSectionHead}>
              <div>
                <p className={styles.meta}>Location</p>
                <h2 id="review-location-title">{current.areaName ?? 'Selected area'}</h2>
              </div>
              <ButtonLink to="/area" variant="secondary">
                Edit location
              </ButtonLink>
            </div>
            <p className={styles.meta}>
              {current.areaExtent === 'REVIEWED_BOUNDARY'
                ? 'Calculations use the confirmed catalogue boundary. A map is not shown in this review.'
                : current.areaExtent === 'USER_RADIUS'
                  ? `Calculations use your declared ${current.areaRadiusMeters ?? 'unknown'} m radius. This is your planning assumption, not a surveyed society or catchment boundary.`
                  : current.areaExtent === 'REFERENCE_POINT'
                    ? 'Calculations use a reference point only. No area boundary has been established.'
                    : 'This is the confirmed planning location. Review Location for its authoritative boundary details.'}
            </p>
          </section>

          <section className={styles.reviewSection} aria-labelledby="review-goal-title">
            <div className={styles.reviewSectionHead}>
              <div>
                <p className={styles.meta}>Community goal</p>
                <h2 id="review-goal-title">
                  {current.goal?.description ||
                    current.goal?.kind.replaceAll('_', ' ').toLowerCase()}
                </h2>
              </div>
              <ButtonLink to="/goals" variant="secondary">
                Edit goal
              </ButtonLink>
            </div>
          </section>

          <section className={styles.reviewSection} aria-labelledby="review-plan-title">
            <div className={styles.reviewSectionHead}>
              <div>
                <p className={styles.meta}>Selected plan</p>
                <h2 id="review-plan-title">{selected.name}</h2>
              </div>
              <ButtonLink to="/plans" variant="secondary">
                Change plan
              </ButtonLink>
            </div>
            <dl className={styles.reviewFacts}>
              <div>
                <dt>Expected outcome with your estimates</dt>
                <dd>
                  {formatRange(
                    selected.pessimistic,
                    selected.optimistic,
                    found!.planComparison.unit ?? 'RATIO',
                  )}
                </dd>
              </div>
              <div>
                <dt>Cost (your estimates)</dt>
                <dd>{formatMoneyRange(selected.cost)}</dd>
              </div>
              <div>
                <dt>Build time</dt>
                <dd>{formatDays(selected.buildDays)}</dd>
              </div>
              <div>
                <dt>First benefit</dt>
                <dd>{TIMING_LABEL[selected.firstBenefit]}</dd>
              </div>
              <div>
                <dt>Water saved or added</dt>
                <dd>
                  {selected.waterLow && selected.waterHigh
                    ? formatRange(selected.waterLow, selected.waterHigh, 'LITRES_PER_DAY')
                    : 'Not known'}
                </dd>
              </div>
              <div>
                <dt>Baseline to target</dt>
                <dd>
                  {found!.planComparison.metric
                    ? `${formatMetric(found!.planComparison.baselineValue, found!.planComparison.unit ?? 'RATIO')} → ${formatMetric(found!.planComparison.targetLevel, found!.planComparison.unit ?? 'RATIO')}`
                    : 'Not available'}
                </dd>
              </div>
            </dl>
          </section>

          <section className={styles.reviewSection} aria-labelledby="review-assumptions-title">
            <div className={styles.reviewSectionHead}>
              <div>
                <p className={styles.meta}>Before you save</p>
                <h2 id="review-assumptions-title">Key assumptions and limitations</h2>
              </div>
              <ButtonLink to="/baseline/overview" variant="secondary">
                Edit baseline
              </ButtonLink>
            </div>
            {found!.planComparison.assumptions.length > 0 ? (
              <ul className={styles.assumptions}>
                {found!.planComparison.assumptions.map((assumption) => (
                  <li key={assumption}>{assumption}</li>
                ))}
                {selected.uncertainty.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className={styles.meta}>No additional comparison assumptions were returned.</p>
            )}
            <Notice kind="info" title="The server checks that this plan is still current">
              Saving creates an immutable report snapshot. If inputs or wider-impact evidence
              changed, return to Compare and choose again.
            </Notice>
          </section>

          <section className={styles.review} aria-labelledby="save-report-title">
            <h2 id="save-report-title">Save report</h2>
            <Field id="report-title" label="Report title" required>
              {(props) => (
                <Input
                  {...props}
                  maxLength={200}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              )}
            </Field>
            {(message || error) && (
              <p className={styles.error} role="alert">
                {message ?? 'Finalization failed. Please try again.'}
              </p>
            )}
            <div className={styles.actions}>
              <Button
                loading={isPending}
                disabled={!title.trim() || session.inputsPending || !selectionCurrent}
                onClick={() => void submit()}
              >
                Save report
              </Button>
              <ButtonLink to="/plans" variant="secondary">
                Back to plans
              </ButtonLink>
            </div>
          </section>
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
