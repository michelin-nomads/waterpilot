import { Link } from 'react-router-dom';

import { ButtonLink, ErrorState, LoadingRegion, Notice, Skeleton } from '../../components';
import { PlanComparisonDocument } from '../../graphql/generated/graphql';
import { useGraphQLQuery } from '../../graphql/hooks';
import { queryKeys } from '../../graphql/queryKeys';
import { usePlanningSession } from '../../session/sessionContext';
import type { SessionState } from '../../session/sessionState';
import { usePlanningMode } from '../planning/planningMode';
import { StagePage } from '../planning/StagePage';
import { PlanComparisonView } from './PlanComparisonView';
import styles from './Plans.module.scss';
import { ScenarioResult } from './ScenarioResult';

function PlansWorkspace({ session }: { session: SessionState }) {
  const { coordinator, state } = usePlanningSession();
  const [mode, setMode] = usePlanningMode();
  const revision = state.server?.inputsRevision ?? session.inputsRevision;
  const upstreamPending =
    'goal' in state.pending || 'scenario' in state.pending || 'areaId' in state.pending;
  const choosing = 'selectedPlanOptionId' in state.pending;

  const query = useGraphQLQuery(
    queryKeys.sessions.planComparison(session.id, revision),
    PlanComparisonDocument,
    { id: session.id },
    { enabled: !upstreamPending && session.goal !== null },
  );
  const found = query.data?.planningSession ?? null;

  if (!session.goal) {
    return (
      <Notice kind="info" title="Set a goal first">
        Plans are compared against your goal. <Link to="/goals">Set your goal and estimates</Link>.
      </Notice>
    );
  }

  return (
    <div className={styles.page}>
      <section className={styles.panel} aria-labelledby="plans-title">
        <h2 id="plans-title" className={styles.title}>
          Plans for your goal
        </h2>
        {upstreamPending ? (
          <Notice kind="stale">Saving your change; plans will be recalculated.</Notice>
        ) : found ? (
          <PlanComparisonView
            comparison={found.planComparison}
            selectedId={session.selectedPlanOptionId}
            busy={choosing || !coordinator}
            onChoose={(optionId) => coordinator?.selectPlanOption(optionId)}
          />
        ) : query.isError ? (
          <ErrorState
            title="Plans could not be compared"
            headingLevel={3}
            onRetry={() => void query.refetch()}
            retrying={query.isFetching}
          >
            Your goal and what-if are saved. Check your connection and try again.
          </ErrorState>
        ) : (
          <LoadingRegion label="Comparing plans">
            <Skeleton shape="block" />
          </LoadingRegion>
        )}
      </section>
      {found && !upstreamPending && (
        <ScenarioResult
          saved={found.scenarioComparison}
          scenario={session.scenario}
          agentMode={mode === 'agent'}
          onOpenAgent={() => setMode('agent')}
        />
      )}
      {session.selectedPlanOptionId && !upstreamPending && (
        <div className={styles.actions}>
          <ButtonLink to="/funding" endIcon="arrow-right">
            Continue to funding
          </ButtonLink>
        </div>
      )}
    </div>
  );
}

function Body() {
  const { state, view, coordinator } = usePlanningSession();
  if (state.status === 'loading') {
    return (
      <LoadingRegion label="Loading your planning session">
        <Skeleton shape="block" />
      </LoadingRegion>
    );
  }
  if (!view || !coordinator || state.status !== 'ready') {
    return (
      <Notice kind="info">Start a plan to compare options; it is saved with your plan.</Notice>
    );
  }
  return <PlansWorkspace key={`${view.id}:${state.server?.inputsRevision ?? 0}`} session={view} />;
}

export default function PlansPage() {
  return (
    <StagePage stageId="plans">
      <Body />
    </StagePage>
  );
}
