import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ErrorState, LoadingRegion, Notice, Skeleton } from '../../components';
import { SessionScenarioDocument } from '../../graphql/generated/graphql';
import { useGraphQLQuery } from '../../graphql/hooks';
import { queryKeys } from '../../graphql/queryKeys';
import { usePlanningSession } from '../../session/sessionContext';
import type { SessionState } from '../../session/sessionState';
import { StagePage } from '../planning/StagePage';
import { ModernScenarioPanel } from './ModernScenarioPanel';
export default function ScenarioPage() {
  const { state, view, coordinator, inputsPending } = usePlanningSession();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const revision = state.server?.inputsRevision ?? 0;
  const query = useGraphQLQuery(
    queryKeys.sessions.scenarioComparison(view?.id ?? '', revision),
    SessionScenarioDocument,
    { id: view?.id ?? '' },
    { enabled: Boolean(view?.areaId) && !inputsPending },
  );
  const saved = query.data?.planningSession?.scenarioComparison;
  async function save(scenario: SessionState['scenario'], continueToGoal = false) {
    if (!coordinator) return;
    setSaving(true);
    setFailed(false);
    try {
      coordinator.setScenario(scenario);
      await coordinator.flush();
      const latest = coordinator.getState();
      if (latest.message || latest.conflict || Object.keys(latest.pending).length)
        throw new Error('Save incomplete');
      if (continueToGoal) navigate('/goals');
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }
  return (
    <StagePage
      stageId="scenario"
      titleSuffix="(Optional)"
      subtitle="Explore how rainfall, water supply and demand changes affect your goals."
    >
      {failed && (
        <Notice kind="caution">
          The scenario could not be saved. Your entries are kept; try again.
        </Notice>
      )}
      {saved && view ? (
        <ModernScenarioPanel
          key={`${view.id}:${revision}`}
          sessionId={view.id}
          revision={revision}
          scenario={view.scenario}
          saved={saved}
          pending={saving || inputsPending}
          onSave={(scenario) => void save(scenario, false)}
          onAnalyse={(scenario) => void save(scenario, true)}
        />
      ) : query.isError ? (
        <ErrorState title="Scenario data could not load" onRetry={() => void query.refetch()}>
          Check the connection and try again.
        </ErrorState>
      ) : (
        <LoadingRegion label="Loading scenario">
          <Skeleton shape="block" />
        </LoadingRegion>
      )}
    </StagePage>
  );
}
