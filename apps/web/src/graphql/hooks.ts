import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { graphqlRequest } from './client';
import type { TypedDocumentString } from './generated/graphql';
import { invalidateAfter, type MutationName } from './invalidation';

/** A cached GraphQL query. The key must come from `queryKeys`. */
export function useGraphQLQuery<TResult, TVariables>(
  queryKey: QueryKey,
  document: TypedDocumentString<TResult, TVariables>,
  variables: TVariables,
  options: { enabled?: boolean } = {},
): UseQueryResult<TResult> {
  return useQuery({
    queryKey,
    queryFn: ({ signal }) => graphqlRequest(document, variables, { signal }),
    enabled: options.enabled,
  });
}

/**
 * A GraphQL mutation that invalidates its documented dependencies whenever the
 * server answered, including typed payload errors (a VERSION_CONFLICT needs the
 * fresh record). Mutations are never retried automatically; a retry reuses the
 * caller's idempotency key so the server returns the original result.
 */
export function useGraphQLMutation<TResult, TInput extends Record<string, unknown>>(
  name: MutationName,
  document: TypedDocumentString<TResult, { input: TInput }>,
): UseMutationResult<TResult, Error, TInput> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: TInput) => graphqlRequest(document, { input }),
    retry: false,
    onSuccess: (_data, input) => invalidateAfter(client, name, input),
  });
}
