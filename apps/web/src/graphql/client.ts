import { apiClient, getAuthToken } from '../lib/apiClient';
import type {
  ErrorCode,
  MutationErrorFieldsFragment,
  TypedDocumentString,
} from './generated/graphql';
import { GraphQLRequestError } from './requestError';

type GraphQLErrorBody = {
  message: string;
  extensions?: { code?: ErrorCode; requestId?: string | null };
};

type GraphQLResponseBody<TResult> = {
  data?: TResult | null;
  errors?: GraphQLErrorBody[];
};

export { GraphQLRequestError };

/** An expected mutation failure returned in the payload's typed `error` field. */
export class MutationFailure extends Error {
  readonly error: MutationErrorFieldsFragment;

  constructor(error: MutationErrorFieldsFragment) {
    super(error.message);
    this.name = 'MutationFailure';
    this.error = error;
  }

  get code(): ErrorCode {
    return this.error.code;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * True only when the server explicitly rejected the ID token for the whole request: every
 * GraphQL error and every non-null root result is `UNAUTHENTICATED`. The server checks
 * identity before any side effect, so in that case nothing ran. Any other outcome
 * (REAUTHENTICATION_REQUIRED, PERMANENT_ACCOUNT_REQUIRED, validation, a root that
 * succeeded) is not a token rejection and is never retried.
 */
function tokenRejected(body: GraphQLResponseBody<unknown>): boolean {
  const roots = isRecord(body.data) ? Object.values(body.data) : [];
  const codes = [
    ...(body.errors ?? []).map((error) => error.extensions?.code),
    ...roots
      .filter((root) => root != null)
      .map((root) => (isRecord(root) && isRecord(root.error) ? root.error.code : 'OK')),
  ];
  return codes.length > 0 && codes.every((code) => code === 'UNAUTHENTICATED');
}

/**
 * Execute a generated GraphQL operation through the single Axios client.
 * Throws {@link GraphQLRequestError} when the response carries `errors` or no data.
 *
 * An explicit token rejection is retried at most once, with a force-refreshed token and
 * the identical body, so a mutation keeps its original idempotency key. Transport errors
 * and every other failure are returned to the caller unretried.
 */
export async function graphqlRequest<TResult, TVariables>(
  document: TypedDocumentString<TResult, TVariables>,
  variables: TVariables,
  options: { signal?: AbortSignal } = {},
): Promise<TResult> {
  const payload = { query: document.toString(), variables };
  const send = async (token?: string) =>
    (
      await apiClient.post<GraphQLResponseBody<TResult>>('/graphql', payload, {
        signal: options.signal,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
    ).data;
  let body = await send();
  if (tokenRejected(body)) {
    const fresh = await getAuthToken({ forceRefresh: true }).catch(() => null);
    if (fresh) body = await send(fresh);
  }
  const first = body.errors?.[0];
  if (first) {
    throw new GraphQLRequestError(
      first.extensions?.code ?? 'INTERNAL',
      first.message,
      first.extensions?.requestId ?? null,
    );
  }
  if (body.data == null) {
    throw new GraphQLRequestError('INTERNAL', 'The server returned no data.', null);
  }
  return body.data;
}

/** Return the mutation's result, or throw its typed error as a {@link MutationFailure}. */
export function unwrapPayload<TPayload extends { error: MutationErrorFieldsFragment | null }>(
  payload: TPayload,
): Omit<TPayload, 'error'> {
  if (payload.error) throw new MutationFailure(payload.error);
  return payload;
}

export { newIdempotencyKey } from '../lib/idempotency';
