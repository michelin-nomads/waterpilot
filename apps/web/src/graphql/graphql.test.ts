import { QueryClient } from '@tanstack/react-query';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { apiClient, setAuthTokenProvider } from '../lib/apiClient';
import {
  GraphQLRequestError,
  MutationFailure,
  graphqlRequest,
  newIdempotencyKey,
  unwrapPayload,
} from './client';
import {
  CurrentPlanningSessionDocument,
  UpdatePlanningSessionDocument,
  type CreatePlanningSessionInput,
  type ErrorCode,
  type UpdatePlanningSessionInput,
} from './generated/graphql';
import { invalidateAfter, invalidations } from './invalidation';
import { createQueryClient, shouldRetryQuery } from './queryClient';
import { queryKeys } from './queryKeys';

let sent: InternalAxiosRequestConfig[] = [];
let reply: unknown = {};
const originalAdapter = apiClient.defaults.adapter;

const stubAdapter: AxiosAdapter = async (config) => {
  sent.push(config);
  return { data: reply, status: 200, statusText: 'OK', headers: {}, config };
};

beforeEach(() => {
  sent = [];
  apiClient.defaults.adapter = stubAdapter;
});

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
  setAuthTokenProvider(async () => null);
});

describe('graphqlRequest', () => {
  it('posts the generated document through the shared client with the bearer token', async () => {
    setAuthTokenProvider(async () => 'id-token');
    reply = { data: { currentPlanningSession: null } };
    const data = await graphqlRequest(CurrentPlanningSessionDocument, {});
    expect(data.currentPlanningSession).toBeNull();
    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe('/graphql');
    expect(sent[0].headers.get('Authorization')).toBe('Bearer id-token');
    const body = JSON.parse(String(sent[0].data)) as { query: string; variables: object };
    expect(body.query).toContain('query CurrentPlanningSession');
    expect(body.query).toContain('fragment PlanningSessionFields');
    expect(body.variables).toEqual({});
  });

  it('sends no Authorization header when signed out and never sends a user id', async () => {
    reply = { data: { currentPlanningSession: null } };
    await graphqlRequest(CurrentPlanningSessionDocument, {});
    expect(sent[0].headers.get('Authorization')).toBeFalsy();
    expect(String(sent[0].data)).not.toMatch(/ownerUid|"uid"/);
  });

  it('turns GraphQL errors into typed request errors', async () => {
    reply = {
      data: { planningSession: null },
      errors: [
        {
          message: 'planning session not found',
          extensions: { code: 'NOT_FOUND', requestId: 'r-1' },
        },
      ],
    };
    const error = await graphqlRequest(CurrentPlanningSessionDocument, {}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GraphQLRequestError);
    expect((error as GraphQLRequestError).code).toBe('NOT_FOUND');
    expect((error as GraphQLRequestError).requestId).toBe('r-1');
  });
});

describe('createQueryClient', () => {
  it('recovers the current session automatically and never auto-retries mutations', () => {
    const defaults = createQueryClient().getDefaultOptions();
    expect(defaults.queries?.refetchOnReconnect).toBe(true);
    expect(defaults.queries?.refetchOnWindowFocus).toBe(true);
    expect(defaults.mutations?.retry).toBe(false);
    expect(defaults.queries?.retry).toBe(shouldRetryQuery);
  });

  it('retries transient failures a bounded number of times, never definitive answers', () => {
    const error = (code: ErrorCode) => new GraphQLRequestError(code, 'x', null);
    expect(shouldRetryQuery(0, new Error('Network Error'))).toBe(true);
    expect(shouldRetryQuery(0, error('SERVICE_UNAVAILABLE'))).toBe(true);
    expect(shouldRetryQuery(2, error('INTERNAL'))).toBe(true);
    expect(shouldRetryQuery(3, new Error('Network Error'))).toBe(false);
    for (const code of [
      'NOT_FOUND',
      'FORBIDDEN',
      'VALIDATION_FAILED',
      'UNAUTHENTICATED',
    ] as const) {
      expect(shouldRetryQuery(0, error(code))).toBe(false);
    }
  });
});

describe('typed mutation errors', () => {
  it('unwrapPayload throws the payload error with its code and current version', () => {
    const failure = (() => {
      try {
        unwrapPayload({
          session: null,
          error: {
            code: 'VERSION_CONFLICT',
            message: 'changed',
            fieldErrors: [],
            currentVersion: 3,
            requestId: 'r-2',
          },
        });
      } catch (e) {
        return e;
      }
    })();
    expect(failure).toBeInstanceOf(MutationFailure);
    expect((failure as MutationFailure).code).toBe('VERSION_CONFLICT');
    expect((failure as MutationFailure).error.currentVersion).toBe(3);
  });

  it('returns the result when there is no error', () => {
    expect(unwrapPayload({ session: { id: 's' }, error: null }).session).toEqual({ id: 's' });
  });

  it('creates idempotency keys the server accepts', () => {
    const key = newIdempotencyKey();
    expect(key).toMatch(/^[A-Za-z0-9_-]{16,128}$/);
    expect(newIdempotencyKey()).not.toBe(key);
  });

  it('generated inputs require expectedVersion/idempotencyKey and reject a client owner', () => {
    // @ts-expect-error expectedVersion is required for versioned updates
    const missingVersion: UpdatePlanningSessionInput = { id: 'ses_1', patch: {} };
    // @ts-expect-error idempotencyKey is required for creates
    const missingKey: CreatePlanningSessionInput = { mode: 'AGENT' };
    const withOwner: CreatePlanningSessionInput = {
      mode: 'AGENT',
      idempotencyKey: newIdempotencyKey(),
      // @ts-expect-error identity comes from the verified token, never an input
      ownerUid: 'someone-else',
    };
    expect([missingVersion, missingKey, withOwner]).toHaveLength(3);
    expect(UpdatePlanningSessionDocument.toString()).toContain(
      '$input: UpdatePlanningSessionInput!',
    );
  });
});

describe('invalidation map', () => {
  it('covers every mutation in the schema', () => {
    expect(Object.keys(invalidations).sort()).toEqual(
      [
        'addProjectExpense',
        'archiveCommunity',
        'archiveReport',
        'beginAccountClaim',
        'cancelAccountClaim',
        'completeAccountClaim',
        'confirmLocation',
        'createCommunity',
        'createPlanningSession',
        'finalizeReport',
        'generateProposal',
        'joinCommunity',
        'leaveCommunity',
        'matchFunding',
        'recordManualInput',
        'recordObservation',
        'startImplementationProject',
        'updateMilestone',
        'updatePlanningSession',
        'updateProjectStatus',
      ].sort(),
    );
  });

  it('invalidates dependent queries by prefix and leaves unrelated ones fresh', async () => {
    const client = new QueryClient();
    const keys = {
      session: queryKeys.sessions.detail('ses_1'),
      options: queryKeys.sessions.planOptions('ses_1', 3, { first: 10 }),
      matches: queryKeys.sessions.fundingMatches('ses_1', 3, 'pln_1'),
      otherSession: queryKeys.sessions.detail('ses_2'),
      reports: queryKeys.reports.list({}, {}),
      communities: queryKeys.communities.list(),
    };
    for (const key of Object.values(keys)) client.setQueryData(key, { cached: true });

    await invalidateAfter(client, 'updatePlanningSession', { id: 'ses_1' });
    const stale = (key: readonly unknown[]) => client.getQueryState(key)?.isInvalidated;
    expect(stale(keys.session)).toBe(true);
    expect(stale(keys.options)).toBe(true);
    expect(stale(keys.matches)).toBe(true);
    expect(stale(keys.otherSession)).toBe(false);
    expect(stale(keys.reports)).toBe(false);

    await invalidateAfter(client, 'finalizeReport', { sessionId: 'ses_2' });
    expect(stale(keys.reports)).toBe(true);
    expect(stale(keys.otherSession)).toBe(true);
    expect(stale(keys.communities)).toBe(false);
  });

  it('scopes derived results by inputs revision so a new revision never reuses them', async () => {
    const client = new QueryClient();
    const before = queryKeys.sessions.planOptions('ses_1', 1);
    const after = queryKeys.sessions.planOptions('ses_1', 2);
    client.setQueryData(before, { cached: true });
    expect(client.getQueryData(after)).toBeUndefined();

    const matches = queryKeys.sessions.fundingMatches('ses_1', 1, 'pln_1');
    client.setQueryData(matches, { cached: true });
    await invalidateAfter(client, 'matchFunding', { sessionId: 'ses_1' });
    expect(client.getQueryState(matches)?.isInvalidated).toBe(true);
    expect(client.getQueryState(queryKeys.sessions.detail('ses_1'))).toBeUndefined();
  });
});
