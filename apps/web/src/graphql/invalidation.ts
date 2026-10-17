import type { QueryClient, QueryKey } from '@tanstack/react-query';

import type { Mutation } from './generated/schema';
import { queryKeys } from './queryKeys';

export type MutationName = Exclude<keyof Mutation, '__typename'>;

/** Variables every mutation receives: one `input` object. */
type Input = Record<string, unknown>;

const str = (input: Input, key: string): string => String(input[key] ?? '');

/**
 * Query-key prefixes each mutation invalidates after it succeeds (documented in
 * docs/api/graphql.md#invalidation). Typed against the generated `Mutation` type, so
 * adding a backend mutation without an entry here fails `tsc`.
 */
export const invalidations: Record<MutationName, (input: Input) => QueryKey[]> = {
  createPlanningSession: () => [queryKeys.sessions.current(), ['session']],
  updatePlanningSession: (i) => [
    queryKeys.readiness.all(),
    queryKeys.baseline.all(),
    queryKeys.sessions.derived(str(i, 'id')),
    queryKeys.sessions.detail(str(i, 'id')),
    queryKeys.sessions.current(),
  ],
  matchFunding: (i) => [queryKeys.sessions.derived(str(i, 'sessionId'))],
  finalizeReport: (i) => [queryKeys.reports.all(), queryKeys.sessions.detail(str(i, 'sessionId'))],
  archiveReport: (i) => [queryKeys.reports.all(), queryKeys.reports.detail(str(i, 'id'))],
  generateProposal: (i) => [queryKeys.reports.detail(str(i, 'reportId'))],
  createCommunity: () => [queryKeys.communities.all()],
  joinCommunity: (i) => [
    queryKeys.communities.detail(str(i, 'communityId')),
    ['communities', 'list'],
    ['communities', 'nearby'],
    ['communities', 'mine'],
  ],
  leaveCommunity: (i) => [
    queryKeys.communities.detail(str(i, 'communityId')),
    ['communities', 'list'],
    ['communities', 'nearby'],
    ['communities', 'mine'],
    queryKeys.reports.all(),
    queryKeys.projects.all(),
  ],
  archiveCommunity: (i) => [
    queryKeys.communities.all(),
    queryKeys.communities.detail(str(i, 'id')),
  ],
  startImplementationProject: () => [queryKeys.projects.all()],
  updateMilestone: () => [queryKeys.projects.all()],
  addProjectExpense: () => [queryKeys.projects.all()],
  updateProjectStatus: () => [queryKeys.projects.all()],
  recordObservation: (i) => [['projects', str(i, 'projectId'), 'observations']],
  // A typed-in value changes the baseline, and with it the goal checks that use it.
  recordManualInput: (i) => [
    queryKeys.readiness.all(),
    queryKeys.baseline.all(),
    queryKeys.sessions.derived(str(i, 'sessionId')),
  ],
  // Confirming creates (or reuses) an area; the session is pointed at it separately.
  confirmLocation: () => [['areas']],
  // The claim itself is never cached; completing it moves the guest's session.
  beginAccountClaim: () => [],
  cancelAccountClaim: () => [],
  completeAccountClaim: () => [queryKeys.viewer(), ['session']],
};

export async function invalidateAfter(
  client: QueryClient,
  mutation: MutationName,
  input: Input,
): Promise<void> {
  await Promise.all(
    invalidations[mutation](input).map(async (queryKey) => {
      // invalidateQueries joins a first load that is still in flight instead of restarting
      // it, so a response computed before this mutation would land as current. Cancelling
      // first discards that response and makes the refetch start fresh.
      await client.cancelQueries({ queryKey });
      await client.invalidateQueries({ queryKey });
    }),
  );
  if (mutation === 'recordManualInput') {
    window.dispatchEvent(
      new CustomEvent('waterpilot:workspace-edit', {
        detail: { sessionId: str(input, 'sessionId') },
      }),
    );
  }
}
