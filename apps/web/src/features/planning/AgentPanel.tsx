import { lazy, Suspense, useState } from 'react';

import { Badge } from '../../components/Badge/Badge';
import { Button } from '../../components/Button/Button';
import { Icon } from '../../components/Icon/Icon';
import { EmptyState } from '../../components/StatePanel/StatePanel';
import { AiStatusDocument, type AiStatusQuery } from '../../graphql/generated/graphql';
import { useGraphQLQuery } from '../../graphql/hooks';
import { queryKeys } from '../../graphql/queryKeys';
import styles from './AgentPanel.module.scss';
import { env } from '../../config/env';
import { usePlanningSession } from '../../session/sessionContext';

const AgentGoalCheck = lazy(() => import('../goals/AgentGoalCheck'));
const AgentScenario = lazy(() => import('../plans/AgentScenario'));
const AgentConversation = lazy(() => import('./AgentConversation'));

type AiStatusValue = AiStatusQuery['aiStatus'];

type PanelContent = {
  /** A short, stable key for the panel's state, also used as a test hook. */
  state: string;
  badge: string;
  badgeTone: 'neutral' | 'success';
  title: string;
  body: string;
};

/**
 * Turn the advisory `aiStatus` into what the pane should say. While the query is loading
 * or failed, `status` is undefined and the pane treats AI as unavailable: it never blocks
 * the workspace, which works whether or not AI is available.
 */
function panelContent(status: AiStatusValue | undefined): PanelContent {
  if (status?.available) {
    return {
      state: 'available',
      badge: 'Available',
      badgeTone: 'success',
      title: 'AI help is available',
      body:
        `The assistant works on the same planning session as the workspace, and every number ` +
        `it shows comes from the deterministic calculations, not the language model. It uses ` +
        `${status.modelId}; ${status.requestsRemaining} of ${status.dailyRequestLimit} requests ` +
        `remain today.`,
    };
  }
  const reason = status?.reason ?? null;
  switch (reason) {
    case 'NOT_INVITED':
      return {
        state: 'NOT_INVITED',
        badge: 'Invite only',
        badgeTone: 'neutral',
        title: 'AI help is limited to invited testers',
        body: 'Ask the project owner for access. The workspace works without it.',
      };
    case 'BUDGET_EXHAUSTED':
      return {
        state: 'BUDGET_EXHAUSTED',
        badge: 'Paused',
        badgeTone: 'neutral',
        title: "Today's AI allowance is used up",
        body: 'AI help will be offered again tomorrow. The workspace is unaffected.',
      };
    case 'NO_BUDGET_CONFIGURED':
      return {
        state: 'NO_BUDGET_CONFIGURED',
        badge: 'Not configured',
        badgeTone: 'neutral',
        title: 'AI help has no budget set',
        body:
          `AI help stays off until the owner sets a daily budget (suggested ` +
          `$${status?.suggestedDailyBudgetUsd ?? '5'}). The workspace works without it.`,
      };
    default:
      return {
        state: 'DISABLED',
        badge: 'Not connected',
        badgeTone: 'neutral',
        title: 'AI help is turned off in this build',
        body:
          'When enabled, the assistant works on the same planning session as the workspace and ' +
          'runs the same deterministic calculations. Until then, use the workspace.',
      };
  }
}

/**
 * Agent pane. The pane reads the advisory `aiStatus` and explains whether AI help could be
 * offered and, if not, why
 * (disabled, invite-only, no budget, or the daily allowance used up). It never blocks the
 * workspace. The deterministic goal and scenario checks below are the same results the
 * agent's tools return, so Agent mode never shows a different number.
 */
export function AgentPanel({
  onUseTraditional,
  onFocusWorkspace,
  showScenario = true,
}: {
  onUseTraditional: () => void;
  onFocusWorkspace?: () => void;
  showScenario?: boolean;
}) {
  const query = useGraphQLQuery(queryKeys.ai.status(), AiStatusDocument, {});
  const { view } = usePlanningSession();
  const [enabledSession, setEnabledSession] = useState<string | null>(null);
  if (query.data?.aiStatus.available && view?.id && enabledSession !== view.id)
    setEnabledSession(view.id);
  const keepConversation = query.data?.aiStatus.available || (view && enabledSession === view.id);
  const content = panelContent(query.data?.aiStatus);
  return (
    <div className={styles.agent} data-ai-status={content.state}>
      <div className={styles.header}>
        <Icon name="sparkle" />
        <h2 className={styles.title}>WaterPilot Agent</h2>
        <Badge tone={content.badgeTone}>{content.badge}</Badge>
      </div>
      {keepConversation && env.appMode === 'local' ? (
        <>
          <h3>{content.title}</h3>
          <p>{content.body}</p>
          <p className={styles.guidance}>You can also use the workspace directly.</p>
          <Suspense fallback={<p role="status">Opening conversation…</p>}>
            <AgentConversation
              onUseTraditional={onUseTraditional}
              onFocusWorkspace={onFocusWorkspace}
            />
          </Suspense>
        </>
      ) : (
        <EmptyState
          icon="sparkle"
          title={content.title}
          headingLevel={3}
          actions={
            <Button variant="secondary" startIcon="list" onClick={onUseTraditional}>
              Use Traditional mode
            </Button>
          }
        >
          <p>{content.body}</p>
        </EmptyState>
      )}
      <Suspense fallback={null}>
        <AgentGoalCheck />
      </Suspense>
      {showScenario && (
        <Suspense fallback={null}>
          <AgentScenario />
        </Suspense>
      )}
    </div>
  );
}
