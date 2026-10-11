import { ButtonLink, Skeleton } from '../../components';
import { GoalAssessmentDocument } from '../../graphql/generated/graphql';
import { useGraphQLQuery } from '../../graphql/hooks';
import { queryKeys } from '../../graphql/queryKeys';
import { usePlanningSession } from '../../session/sessionContext';
import { GoalAssessmentView } from './GoalAssessmentView';
import styles from './Goals.module.scss';

/**
 * The saved goal's fit and conflicts in the agent pane: the same assessment the
 * `explain_goal_fit` tool returns, so Agent mode never explains a different result.
 */
export default function AgentGoalCheck() {
  const { state } = usePlanningSession();
  const server = state.server;
  const pending = 'goal' in state.pending;
  const query = useGraphQLQuery(
    queryKeys.sessions.goalAssessment(server?.id ?? '', server?.inputsRevision ?? 0),
    GoalAssessmentDocument,
    { sessionId: server?.id ?? '' },
    { enabled: Boolean(server?.goal) && !pending },
  );
  if (!server?.goal) return null;
  const assessment = query.data?.planningSession?.goalAssessment ?? null;
  return (
    <section className={styles.stack} aria-label="Goal check" data-agent-goal-check="">
      <p className={styles.muted}>
        No language model is connected. This is the deterministic goal check the agent&apos;s tools
        return, for your saved goal.
      </p>
      {assessment && !pending ? (
        <GoalAssessmentView assessment={assessment} headingLevel={3} compact />
      ) : query.isError ? (
        <p className={styles.error}>The goal check could not load. Open the Goals page to retry.</p>
      ) : (
        <Skeleton shape="block" />
      )}
      <ButtonLink to="/goals" variant="secondary" size="sm">
        Edit goal
      </ButtonLink>
    </section>
  );
}
