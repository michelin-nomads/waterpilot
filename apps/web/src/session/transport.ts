import { graphqlRequest } from '../graphql/client';
import {
  CreatePlanningSessionDocument,
  CurrentPlanningSessionDocument,
  PlanningSessionDocument,
  UpdatePlanningSessionDocument,
  type ErrorCode,
  type MutationErrorFieldsFragment,
  type PlanningMode,
  type PlanningSessionFieldsFragment,
  type PlanningSessionPatch,
} from '../graphql/generated/graphql';
import { fromFragment, patchFields, type SessionPatch, type SessionState } from './sessionState';

export interface SessionError {
  code: ErrorCode;
  message: string;
  field: string | null;
}

export type SessionResult = { session: SessionState } | { error: SessionError };

/**
 * Server calls the coordinator needs. Network and request-level failures are thrown;
 * typed mutation errors (VERSION_CONFLICT, validation, closed session) are returned.
 */
export interface SessionTransport {
  current(): Promise<SessionState | null>;
  get(id: string): Promise<SessionState>;
  update(id: string, expectedVersion: number, patch: SessionPatch): Promise<SessionResult>;
  create(mode: PlanningMode, idempotencyKey: string): Promise<SessionResult>;
}

function toResult(payload: {
  session?: PlanningSessionFieldsFragment | null;
  error: MutationErrorFieldsFragment | null;
}): SessionResult {
  if (payload.error) {
    return {
      error: {
        code: payload.error.code,
        message: payload.error.message,
        field: payload.error.fieldErrors[0]?.field ?? null,
      },
    };
  }
  if (!payload.session) throw new Error('The server returned no session.');
  return { session: fromFragment(payload.session) };
}

function toInput(patch: SessionPatch): PlanningSessionPatch {
  const input: PlanningSessionPatch = {};
  for (const field of patchFields(patch)) Object.assign(input, { [field]: patch[field] ?? null });
  return input;
}

export const graphqlSessionTransport: SessionTransport = {
  async current() {
    const data = await graphqlRequest(CurrentPlanningSessionDocument, {});
    return data.currentPlanningSession ? fromFragment(data.currentPlanningSession) : null;
  },
  async get(id) {
    const data = await graphqlRequest(PlanningSessionDocument, { id });
    if (!data.planningSession) throw new Error('The planning session no longer exists.');
    return fromFragment(data.planningSession);
  },
  async update(id, expectedVersion, patch) {
    const data = await graphqlRequest(UpdatePlanningSessionDocument, {
      input: { id, expectedVersion, patch: toInput(patch) },
    });
    return toResult(data.updatePlanningSession);
  },
  async create(mode, idempotencyKey) {
    const data = await graphqlRequest(CreatePlanningSessionDocument, {
      input: { mode, idempotencyKey },
    });
    return toResult(data.createPlanningSession);
  },
};
