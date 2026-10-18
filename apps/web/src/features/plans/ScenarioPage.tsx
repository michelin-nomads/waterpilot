import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button, ButtonLink, ErrorState, LoadingRegion, Notice, Skeleton } from '../../components';
import { SessionScenarioDocument } from '../../graphql/generated/graphql';
import { useGraphQLQuery } from '../../graphql/hooks';
import { queryKeys } from '../../graphql/queryKeys';
import { usePlanningSession } from '../../session/sessionContext';
import type { SessionState } from '../../session/sessionState';
import { SHOW_COMMUNITY_BASELINE } from '../planning/visibility';
import { StagePage } from '../planning/StagePage';
import { ModernScenarioPanel } from './ModernScenarioPanel';
import { ScenicHeaderIllustration } from './ScenicHeaderIllustration';
import styles from './Plans.module.scss';

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
      actions={<ScenicHeaderIllustration className={styles.headerIllustration} />}
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
          onSave={(scenario) => void save(scenario)}
          onContinueToGoal={() => navigate('/goals')}
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
      <div className={styles.actions}>
        <ButtonLink
          to={SHOW_COMMUNITY_BASELINE ? '/baseline/overview' : '/area'}
          variant="secondary"
        >
          Back to your area
        </ButtonLink>
        <Button
          variant="secondary"
          disabled={!coordinator || inputsPending || saving}
          onClick={() =>
            void save({ adjustments: [], interpretedFrom: null, confirmed: true }, true)
          }
        >
          Continue with current baseline
        </Button>
        {state.server?.scenario?.confirmed && (
          <Button
            disabled={saving || inputsPending}
            onClick={() => navigate('/goals')}
            endIcon="arrow-right"
          >
            Continue with saved scenario
          </Button>
        )}
      </div>
    </StagePage>
  );
}
