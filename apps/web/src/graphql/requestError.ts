import type { ErrorCode } from './generated/graphql';

/**
 * A request-level failure: transport errors and GraphQL `errors` (queries). Kept apart
 * from `client.ts` so the eagerly loaded query client can recognise it without pulling
 * Axios into the initial bundle.
 */
export class GraphQLRequestError extends Error {
  readonly code: ErrorCode;
  readonly requestId: string | null;

  constructor(code: ErrorCode, message: string, requestId: string | null) {
    super(message);
    this.name = 'GraphQLRequestError';
    this.code = code;
    this.requestId = requestId;
  }
}
