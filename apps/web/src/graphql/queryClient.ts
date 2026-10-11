import { QueryClient } from '@tanstack/react-query';

import type { ErrorCode } from './generated/graphql';
import { GraphQLRequestError } from './requestError';

const MAX_QUERY_RETRIES = 3;
const TRANSIENT: ReadonlySet<ErrorCode> = new Set(['INTERNAL', 'SERVICE_UNAVAILABLE']);

/**
 * Retry transport failures and transient server errors; a definitive answer such as
 * NOT_FOUND, FORBIDDEN or VALIDATION_FAILED will not change on retry, so it shows at once.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof GraphQLRequestError && !TRANSIENT.has(error.code)) return false;
  return failureCount < MAX_QUERY_RETRIES;
}

/**
 * The app's single query cache. Current-session recovery is automatic (there is no
 * Resume control): after a reload Firebase restores the identity and queries load the
 * current session; after a dropped connection or a return to the tab, active queries
 * refetch. Mutations never retry on their own (see `useGraphQLMutation`).
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { refetchOnReconnect: true, refetchOnWindowFocus: true, retry: shouldRetryQuery },
      mutations: { retry: false },
    },
  });
}
