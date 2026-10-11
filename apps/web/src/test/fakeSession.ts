import type { PlanningMode } from '../graphql/generated/graphql';
import {
  applyPatch,
  changesUpstream,
  patchFields,
  type SessionPatch,
  type SessionState,
} from '../session/sessionState';
import type { SessionResult, SessionTransport } from '../session/transport';

/**
 * In-memory planning-session server with the backend's rules: one active session per
 * owner, compare-and-set on `expectedVersion`, `inputsRevision` bumps on real input
 * changes, dependent fields cleared, plan choices checked against the revision, and
 * idempotent creation. Scriptable: offline, lost responses, held responses.
 */
export class FakeSessionServer {
  readonly sessions = new Map<string, SessionState & { owner: string }>();
  /** Plan option id → the inputs revision it was computed for. */
  readonly options = new Map<string, number>();
  /** Every update the server applied (not ones it rejected). */
  readonly applied: Array<{ id: string; patch: SessionPatch }> = [];
  readonly calls: string[] = [];
  offline = false;
  /** Apply the next N updates, then fail as if the response was lost. */
  dropResponses = 0;
  /** While set, updates wait for it before replying. */
  hold: Promise<void> | null = null;
  private readonly creates = new Map<string, string>();
  private next = 1;

  private reachable(): void {
    if (this.offline) throw new TypeError('Failed to fetch');
  }

  active(owner: string): (SessionState & { owner: string }) | null {
    return (
      [...this.sessions.values()].find((s) => s.owner === owner && s.status === 'ACTIVE') ?? null
    );
  }

  seed(owner: string, overrides: Partial<SessionState> = {}): SessionState {
    for (const s of this.sessions.values()) if (s.owner === owner) s.status = 'CLOSED';
    const id = overrides.id ?? `ses_${this.next++}`;
    const session = {
      id,
      version: 1,
      status: 'ACTIVE' as const,
      mode: 'TRADITIONAL' as const,
      stage: 'UNDERSTAND' as const,
      areaId: null,
      areaName: null,
      communityId: null,
      goal: null,
      scenario: null,
      selectedPlanOptionId: null,
      inputsRevision: 0,
      updatedAt: new Date(0).toISOString(),
      ...overrides,
      owner,
    };
    this.sessions.set(id, session);
    return strip(session);
  }

  /** A plan option computed for the session's current inputs. */
  seedOption(sessionId: string): string {
    const id = `pln_${this.next++}`;
    this.options.set(id, (this.sessions.get(sessionId) as SessionState).inputsRevision);
    return id;
  }

  /** An edit made by another tab or device, straight on the server. */
  externalEdit(sessionId: string, patch: SessionPatch): SessionState {
    const result = this.apply(sessionId, null, patch);
    if ('error' in result) throw new Error(result.error.message);
    return result.session;
  }

  private apply(id: string, expectedVersion: number | null, patch: SessionPatch): SessionResult {
    const session = this.sessions.get(id);
    if (!session) return error('NOT_FOUND', 'Planning session not found.');
    if (session.status !== 'ACTIVE') {
      return error('PRECONDITION_FAILED', 'This planning session is closed.');
    }
    if (expectedVersion !== null && expectedVersion !== session.version) {
      return error('VERSION_CONFLICT', 'The session changed since you loaded it.');
    }
    const next = applyPatch(session, patch);
    const inputsRevision = session.inputsRevision + (changesUpstream(session, patch) ? 1 : 0);
    if ('selectedPlanOptionId' in patch && next.selectedPlanOptionId !== null) {
      const revision = this.options.get(next.selectedPlanOptionId);
      if (revision !== inputsRevision) {
        return error(
          'PRECONDITION_FAILED',
          'That plan was compared for different inputs.',
          'selectedPlanOptionId',
        );
      }
    }
    const updated = {
      ...session,
      ...next,
      areaName: next.areaId ? `Area ${next.areaId}` : null,
      inputsRevision,
      version: session.version + 1,
      updatedAt: new Date(session.version * 1000).toISOString(),
    };
    this.sessions.set(id, updated);
    this.applied.push({ id, patch });
    return { session: strip(updated) };
  }

  transport(uid: () => string | null): SessionTransport {
    const owner = () => {
      const current = uid();
      if (!current) throw new Error('UNAUTHENTICATED');
      return current;
    };
    return {
      current: async () => {
        this.calls.push('current');
        this.reachable();
        const session = this.active(owner());
        return session ? strip(session) : null;
      },
      get: async (id) => {
        this.calls.push(`get:${id}`);
        this.reachable();
        const session = this.sessions.get(id);
        if (!session || session.owner !== owner()) throw new Error('not found');
        return strip(session);
      },
      update: async (id, expectedVersion, patch) => {
        this.calls.push(`update:${id}:${expectedVersion}:${patchFields(patch).join(',')}`);
        this.reachable();
        const session = this.sessions.get(id);
        if (!session || session.owner !== owner()) {
          return error('NOT_FOUND', 'Planning session not found.');
        }
        const result = this.apply(id, expectedVersion, patch);
        if (this.hold) await this.hold;
        if (this.dropResponses > 0 && 'session' in result) {
          this.dropResponses -= 1;
          throw new TypeError('Network connection lost');
        }
        return result;
      },
      create: async (mode: PlanningMode, key: string) => {
        this.calls.push(`create:${mode}`);
        this.reachable();
        const existing = this.creates.get(key);
        if (existing) return { session: strip(this.sessions.get(existing) as SessionState) };
        const session = this.seed(owner(), { mode });
        this.creates.set(key, session.id);
        if (this.dropResponses > 0) {
          this.dropResponses -= 1;
          throw new TypeError('Network connection lost');
        }
        return { session };
      },
    };
  }
}

function strip(session: SessionState & { owner?: string }): SessionState {
  const copy = structuredClone(session);
  delete copy.owner;
  return copy;
}

function error(
  code: 'NOT_FOUND' | 'PRECONDITION_FAILED' | 'VERSION_CONFLICT',
  message: string,
  field: string | null = null,
): SessionResult {
  return { error: { code, message, field } };
}
