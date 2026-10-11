import { lazy, Suspense } from 'react';

import { Badge } from '../../components/Badge/Badge';
import { Button } from '../../components/Button/Button';
import { Icon } from '../../components/Icon/Icon';
import { EmptyState } from '../../components/StatePanel/StatePanel';
import styles from './AgentPanel.module.scss';

const AgentGoalCheck = lazy(() => import('../goals/AgentGoalCheck'));
const AgentScenario = lazy(() => import('../plans/AgentScenario'));

/**
 * Agent pane. The agent is not connected in this build, and the pane says so instead of
 * imitating a conversation. When connected it will act on the same planning session as
 * the workspace through the same application services.
 */
export function AgentPanel({ onUseTraditional }: { onUseTraditional: () => void }) {
  return (
    <div className={styles.agent}>
      <div className={styles.header}>
        <Icon name="sparkle" />
        <h2 className={styles.title}>Conversation</h2>
        <Badge tone="neutral">Not connected</Badge>
      </div>
      <EmptyState
        icon="sparkle"
        title="The agent is not available in this build"
        headingLevel={3}
        actions={
          <Button variant="secondary" startIcon="list" onClick={onUseTraditional}>
            Use Traditional mode
          </Button>
        }
      >
        <p>
          In Agent mode the assistant works on the same planning session as the workspace. It can
          suggest the next step and run the same calculations, and every number it shows comes from
          those deterministic calculations, not from the language model.
        </p>
        <p>
          It needs server-side Gemini on Vertex AI (Phase 10) and the bounded ADK planning tools
          (Phase 13). Until then, use the workspace.
        </p>
      </EmptyState>
      <Suspense fallback={null}>
        <AgentGoalCheck />
      </Suspense>
      <Suspense fallback={null}>
        <AgentScenario />
      </Suspense>
    </div>
  );
}
