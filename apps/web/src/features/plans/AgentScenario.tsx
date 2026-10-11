import { Skeleton } from '../../components';
import { SessionScenarioDocument } from '../../graphql/generated/graphql';
import { useGraphQLQuery } from '../../graphql/hooks';
import { queryKeys } from '../../graphql/queryKeys';
import { usePlanningSession } from '../../session/sessionContext';
import styles from './Plans.module.scss';
import { WhatIfPanel } from './WhatIfPanel';

/**
 * Scenario exploration in Agent mode: the `preview_scenario` tool over the same session.
 * Shown in the agent pane once the session has a location to compare against.
 */
export default function AgentScenario() {
  const { state, view, coordinator } = usePlanningSession();
  const server = state.server;
  const revision = server?.inputsRevision ?? 0;
  const pending = 'scenario' in state.pending;
  const upstream = 'areaId' in state.pending || 'goal' in state.pending;
  const query = useGraphQLQuery(
    queryKeys.sessions.scenarioComparison(server?.id ?? '', revision),
    SessionScenarioDocument,
    { id: server?.id ?? '' },
    { enabled: Boolean(server?.areaId) && !pending && !upstream },
  );
  if (!server?.areaId || !view) return null;
  const saved = query.data?.planningSession?.scenarioComparison ?? null;
  return (
    <div className={styles.stack} data-agent-scenario="">
      {saved ? (
        <WhatIfPanel
          key={`${server.id}:${revision}`}
          sessionId={server.id}
          revision={revision}
          scenario={view.scenario}
          saved={saved}
          pending={pending}
          onSave={(scenario) => coordinator?.setScenario(scenario)}
        />
      ) : query.isError ? (
        <p className={styles.muted}>The what-if tool could not load. Reload to try again.</p>
      ) : (
        <Skeleton shape="block" />
      )}
    </div>
  );
}
