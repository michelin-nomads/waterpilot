import type { PlanningMode } from '../graphql/generated/graphql';
import { newIdempotencyKey } from '../lib/idempotency';
import { RECOVERY_TTL_MS, type RecoveryRecord, type RecoveryStore } from './recoveryStore';
import {
  applyPatch,
  changesUpstream,
  isEmptyPatch,
  mergeEdits,
  patchFields,
  sameValue,
  type SessionField,
  type SessionPatch,
  type SessionState,
} from './sessionState';
import type { SessionError, SessionResult, SessionTransport } from './transport';

export type SessionStatus = 'loading' | 'ready' | 'none' | 'closed' | 'error';
export type SavePhase = 'idle' | 'saving' | 'saved' | 'offline' | 'failed' | 'conflict';

export interface SessionConflict {
  fields: SessionField[];
  /** The newer server copy the edits collided with. */
  theirs: SessionState;
}

export interface CoordinatorState {
  status: SessionStatus;
  /** Last copy acknowledged by the server (or the device copy while `offlineCopy`). */
  server: SessionState | null;
  /** Edits not yet acknowledged, newest values; includes the request in flight. */
  pending: SessionPatch;
  save: SavePhase;
  /** When the server last acknowledged a save in this tab. */
  savedAt: number | null;
  conflict: SessionConflict | null;
  /** A save problem in user terms, shown next to the save status. */
  message: string | null;
  /** When the unsent edits recovered from this device were made. */
  restoredFrom: number | null;
  /** The server copy is the device's recovery copy because the API was unreachable. */
  offlineCopy: boolean;
  error: string | null;
}

export interface CoordinatorDeps {
  uid: string;
  accountKind: 'guest' | 'permanent';
  tabId: string;
  transport: SessionTransport;
  recovery: RecoveryStore;
  now?: () => number;
  online?: () => boolean;
  /** A previous guest uid whose unsent edits this account may adopt (account claim). */
  adoptFrom?: string | null;
  /**
   * Whether a plan that already exists (on the server or as this device's unsent edits) is
   * picked up when the coordinator starts. Plans are not kept between visits, so only a
   * hand-over inside one visit (a guest signing in) sets this; a fresh visit starts empty.
   * Defaults to true.
   */
  restore?: boolean;
  /** In-memory state handed over by this visit's guest after authentication. */
  handover?: CoordinatorState;
  /** Called after the server acknowledges a change; `inputsChanged` when derived data is stale. */
  onSaved?: (session: SessionState, inputsChanged: boolean) => void;
}

const INITIAL: CoordinatorState = {
  status: 'loading',
  server: null,
  pending: {},
  save: 'idle',
  savedAt: null,
  conflict: null,
  message: null,
  restoredFrom: null,
  offlineCopy: false,
  error: null,
};

const CLOSED_ELSEWHERE =
  'This plan was replaced by a newer one started in another tab or on another device.';

/** Words for a failed save; the session itself is never shown as saved. */
function describe(error: SessionError): string {
  return `Not saved: ${error.message}`;
}

function without(patch: SessionPatch, fields: Iterable<SessionField>): SessionPatch {
  const next = { ...patch };
  for (const field of fields) delete next[field];
  return next;
}

/**
 * Owns one user's current planning session in this tab: the authoritative server copy,
 * pending edits on top of it, saving with `expectedVersion`, recovery from IndexedDB and
 * reconciliation with edits made in other tabs or devices.
 *
 * Writes are compare-and-set, so a request repeated after a lost response cannot apply
 * twice: it conflicts, the merge finds the server already holds the value, and drops it.
 */
export class SessionCoordinator {
  private state: CoordinatorState = INITIAL;
  private readonly listeners = new Set<() => void>();
  private readonly now: () => number;
  private readonly online: () => boolean;
  private inflight: Promise<void> | null = null;
  private starting: Promise<void> | null = null;
  private createKey: string | null = null;
  private editedAt: number | null = null;
  private persistChain: Promise<void> = Promise.resolve();
  private disposed = false;
  private restorable: boolean;
  private handover: CoordinatorState | undefined;

  constructor(private readonly deps: CoordinatorDeps) {
    this.restorable = deps.restore ?? true;
    this.handover = deps.handover;
    this.now = deps.now ?? Date.now;
    this.online = deps.online ?? (() => navigator.onLine);
    if (deps.handover?.status === 'ready') {
      this.state = { ...deps.handover };
      this.editedAt = isEmptyPatch(this.state.pending) ? null : this.now();
    }
  }

  get uid(): string {
    return this.deps.uid;
  }

  private get recordKey(): string {
    return `${this.deps.uid}:${this.deps.tabId}`;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getState = (): CoordinatorState => this.state;

  /** What the user sees: the server copy with pending edits applied. */
  view(): SessionState | null {
    const { server, pending } = this.state;
    return server ? applyPatch(server, pending) : null;
  }

  /** True while a pending edit changes location, goal or scenario. */
  inputsPending(): boolean {
    const { server, pending } = this.state;
    return server ? changesUpstream(server, pending) : false;
  }

  private set(update: Partial<CoordinatorState>): void {
    if (this.disposed) return;
    this.state = { ...this.state, ...update };
    this.listeners.forEach((listener) => listener());
    this.persist();
  }

  dispose(): void {
    this.disposed = true;
    this.listeners.clear();
  }

  // --- loading and recovery ------------------------------------------------------------

  start(): Promise<void> {
    this.starting ??= this.load();
    return this.starting;
  }

  /** Start over from the server (after "Open current plan" or a load error). */
  reload(): Promise<void> {
    this.starting = null;
    this.state = { ...INITIAL };
    this.editedAt = null;
    this.listeners.forEach((listener) => listener());
    return this.start();
  }

  private async recoveryRecord(): Promise<RecoveryRecord | null> {
    const { recovery, uid, adoptFrom } = this.deps;
    const own = await recovery.forUid(uid).catch(() => []);
    const mine = own.find((r) => r.key === this.recordKey);
    if (mine) return mine;
    const candidates = [...own];
    if (adoptFrom) candidates.push(...(await recovery.forUid(adoptFrom).catch(() => [])));
    const withEdits = candidates
      .filter((r) => r.editedAt !== null)
      .sort((a, b) => b.writtenAt - a.writtenAt);
    return withEdits[0] ?? null;
  }

  private async load(): Promise<void> {
    if (!this.restorable) {
      // A plan from an earlier visit is not resumed and nothing of it stays on this device;
      // the next plan started replaces it on the server.
      const { recovery, uid, adoptFrom } = this.deps;
      await Promise.all([uid, adoptFrom].map((owner) => owner && recovery.deleteUid(owner))).catch(
        () => undefined,
      );
      this.set({ status: 'none' });
      return;
    }
    // Prefer the live handoff over IndexedDB: its last write may still be queued.
    const handover = this.handover;
    this.handover = undefined;
    const record =
      handover?.status === 'ready' && handover.server
        ? {
            key: this.recordKey,
            uid: this.deps.uid,
            accountKind: this.deps.accountKind,
            sessionId: handover.server.id,
            base: handover.server,
            pending: handover.pending,
            editedAt: isEmptyPatch(handover.pending) ? null : this.now(),
            writtenAt: this.now(),
            expiresAt: this.now() + RECOVERY_TTL_MS,
          }
        : await this.recoveryRecord();
    let current: SessionState | null;
    try {
      current = await this.deps.transport.current();
    } catch {
      if (record && record.uid === this.deps.uid) {
        // API unreachable: carry on from this device's copy; saving resumes on reconnect.
        this.editedAt = record.editedAt;
        this.set({
          status: 'ready',
          server: record.base,
          pending: record.pending,
          offlineCopy: true,
          restoredFrom: isEmptyPatch(record.pending) ? null : record.editedAt,
          save: isEmptyPatch(record.pending) ? 'idle' : this.online() ? 'failed' : 'offline',
          message: isEmptyPatch(record.pending)
            ? null
            : 'Your changes are kept on this device and will be saved when the connection returns.',
        });
        return;
      }
      this.set({ status: 'error', error: 'Your plan could not be loaded. Check your connection.' });
      return;
    }
    if (!current) {
      // A guest's plan may still be moving to this account; keep its edits until it lands.
      const ownRecord = record?.uid === this.deps.uid ? record : null;
      if (ownRecord) void this.deps.recovery.delete(ownRecord.key);
      this.set({
        ...INITIAL,
        status: 'none',
        message:
          ownRecord && ownRecord.editedAt !== null
            ? 'Changes kept on this device belonged to a plan that has since been closed, so they were not applied.'
            : null,
      });
      return;
    }
    if (record && record.key !== this.recordKey) void this.deps.recovery.delete(record.key);
    const { adoptFrom, uid } = this.deps;
    if (adoptFrom && adoptFrom !== uid) void this.deps.recovery.deleteUid(adoptFrom);

    const recovered =
      record && record.sessionId === current.id && record.editedAt !== null ? record : null;
    if (!recovered) {
      this.set({ ...INITIAL, status: 'ready', server: current });
      return;
    }
    this.editedAt = recovered.editedAt;
    this.state = {
      ...this.state,
      status: 'ready',
      server: recovered.base,
      pending: recovered.pending,
      restoredFrom: recovered.editedAt,
    };
    this.adopt(current);
    void this.flush();
  }

  // --- edits ---------------------------------------------------------------------------

  /**
   * Apply a structured edit locally and save it. Fields not in `patch` are untouched.
   * `force` re-sends a field even when its value equals the server's: used to re-affirm a
   * plan choice so the server re-stores the current wider-impact assessment (ADR 0013),
   * which is the only way to clear a stale (reassessed) selection.
   */
  edit(patch: SessionPatch, options: { force?: boolean } = {}): void {
    const { server, status } = this.state;
    if (!server || status !== 'ready' || isEmptyPatch(patch)) return;
    const pending = { ...this.state.pending };
    for (const field of patchFields(patch)) {
      if (!options.force && sameValue(field, server[field], patch[field]) && !this.inflight) {
        delete pending[field];
      } else {
        Object.assign(pending, { [field]: patch[field] ?? null });
      }
    }
    this.editedAt ??= this.now();
    if (isEmptyPatch(pending)) this.editedAt = null;
    this.set({ pending, message: null, save: isEmptyPatch(pending) ? this.state.save : 'saving' });
    void this.flush();
  }

  setCommunityBaseline = (
    communityBaseline: SessionState['communityBaseline'],
    siteProfile?: SessionState['siteProfile'],
  ) => this.edit({ communityBaseline, ...(siteProfile !== undefined ? { siteProfile } : {}) });
  setSiteProfile = (siteProfile: SessionState['siteProfile']) => this.edit({ siteProfile });
  setMode = (mode: PlanningMode) => this.edit({ mode });
  markBaselineReviewed = () => this.edit({ baselineReviewed: true });

  setStage = (stage: SessionState['stage']) => this.edit({ stage });
  setArea = (areaId: string | null) => this.edit({ areaId });
  setGoal = (goal: SessionState['goal']) => this.edit({ goal });
  setScenario = (scenario: SessionState['scenario']) => this.edit({ scenario });
  selectPlanOption = (selectedPlanOptionId: string | null) => this.edit({ selectedPlanOptionId });
  /** Re-affirm the already-chosen plan to refresh a stale wider-impact assessment. */
  reselectPlanOption = (selectedPlanOptionId: string) =>
    this.edit({ selectedPlanOptionId }, { force: true });

  // --- saving --------------------------------------------------------------------------

  /** Send pending edits. Safe to call at any time; one request is in flight at most. */
  flush(): Promise<void> {
    if (this.inflight) return this.inflight;
    if (isEmptyPatch(this.state.pending)) return Promise.resolve();
    const drain = async () => {
      do {
        await this.saveOnce();
      } while (
        this.state.status === 'ready' &&
        !this.state.conflict &&
        !isEmptyPatch(this.state.pending) &&
        this.state.save === 'saving'
      );
    };
    this.inflight = drain().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  private async saveOnce(): Promise<void> {
    const { server, status, conflict } = this.state;
    if (!server || status !== 'ready' || conflict || isEmptyPatch(this.state.pending)) return;
    if (!this.online()) {
      this.set({ save: 'offline' });
      return;
    }
    if (this.state.offlineCopy) {
      // The device copy may be behind: compare with the server before writing on it.
      await this.syncWithServer();
      if (this.state.status !== 'ready' || this.state.conflict || this.state.offlineCopy) return;
      if (isEmptyPatch(this.state.pending)) return;
    }
    const base = this.state.server as SessionState;
    const sent = { ...this.state.pending };
    this.set({ save: 'saving' });
    let result: SessionResult;
    try {
      result = await this.deps.transport.update(base.id, base.version, sent);
    } catch {
      this.set({
        save: this.online() ? 'failed' : 'offline',
        message: this.online()
          ? 'Not saved: the server could not be reached. Your changes are kept on this device.'
          : null,
      });
      return;
    }
    if ('session' in result) {
      this.acknowledge(sent, result.session);
      return;
    }
    await this.handleError(result.error, sent);
  }

  private acknowledge(sent: SessionPatch, session: SessionState): void {
    // A save that finishes after the plan was discarded must not bring it back.
    if (this.state.status !== 'ready') return;
    const previous = this.state.server;
    let pending = { ...this.state.pending };
    for (const field of patchFields(sent)) {
      if (sameValue(field, pending[field], sent[field])) delete pending[field];
    }
    // The server applied its dependency rules; edits that it already reflects are done.
    pending = without(
      pending,
      patchFields(pending).filter((field) => sameValue(field, session[field], pending[field])),
    );
    if (isEmptyPatch(pending)) this.editedAt = null;
    this.set({
      server: session,
      pending,
      offlineCopy: false,
      savedAt: this.now(),
      save: isEmptyPatch(pending) ? 'saved' : 'saving',
      message: null,
    });
    this.deps.onSaved?.(session, previous?.inputsRevision !== session.inputsRevision);
  }

  private async handleError(error: SessionError, sent: SessionPatch): Promise<void> {
    switch (error.code) {
      case 'VERSION_CONFLICT':
        await this.syncWithServer();
        if (this.state.status === 'ready' && !this.state.conflict) {
          this.set({ save: isEmptyPatch(this.state.pending) ? 'saved' : 'saving' });
        }
        return;
      case 'PRECONDITION_FAILED':
        if (error.field === 'selectedPlanOptionId') {
          this.set({
            pending: without(this.state.pending, ['selectedPlanOptionId']),
            save: 'failed',
            message: describe(error),
          });
          return;
        }
        this.set({ status: 'closed', save: 'idle', message: CLOSED_ELSEWHERE });
        return;
      case 'VALIDATION_FAILED': {
        // Invalid input is not kept for retry; everything else still saves.
        const invalid = patchFields(sent).filter((field) =>
          sameValue(field, this.state.pending[field], sent[field]),
        );
        this.set({
          pending: without(this.state.pending, invalid),
          save: 'failed',
          message: describe(error),
        });
        return;
      }
      case 'NOT_FOUND':
      case 'UNAUTHENTICATED':
      case 'FORBIDDEN':
        this.set({ status: 'error', save: 'idle', error: error.message });
        return;
      default:
        this.set({ save: 'failed', message: describe(error) });
    }
  }

  /** Fetch the latest server copy and merge pending edits onto it. */
  private async syncWithServer(): Promise<void> {
    const server = this.state.server;
    if (!server) return;
    let latest: SessionState | null;
    try {
      latest = await this.deps.transport.current();
    } catch {
      this.set({ save: this.online() ? 'failed' : 'offline' });
      return;
    }
    if (!latest || latest.id !== server.id) {
      this.set({ status: 'closed', save: 'idle', message: CLOSED_ELSEWHERE });
      return;
    }
    this.adopt(latest);
  }

  /** Take a newer server copy, rebasing pending edits; conflicting fields wait for the user. */
  private adopt(latest: SessionState): void {
    const { server, pending } = this.state;
    if (!server || latest.id !== server.id) {
      this.set({ server: latest, pending: {}, conflict: null, offlineCopy: false });
      return;
    }
    if (latest.version < server.version) return;
    if (isEmptyPatch(pending)) {
      this.set({ server: latest, offlineCopy: false, conflict: null });
      if (latest.inputsRevision !== server.inputsRevision) this.deps.onSaved?.(latest, true);
      return;
    }
    const merged = mergeEdits(server, latest, pending);
    if (isEmptyPatch(merged.pending)) this.editedAt = null;
    this.set({
      server: latest,
      pending: merged.pending,
      offlineCopy: false,
      conflict: merged.conflicts.length ? { fields: merged.conflicts, theirs: latest } : null,
      save: merged.conflicts.length ? 'conflict' : this.state.save,
      message: merged.selectionStale
        ? 'Your plan choice was cleared because the location or goal changed elsewhere.'
        : this.state.message,
    });
    if (latest.inputsRevision !== server.inputsRevision) this.deps.onSaved?.(latest, true);
  }

  /** Resolve a conflict: keep this tab's values, or take the saved ones. */
  resolveConflict(choice: 'mine' | 'theirs'): void {
    const conflict = this.state.conflict;
    if (!conflict) return;
    const pending =
      choice === 'mine' ? this.state.pending : without(this.state.pending, conflict.fields);
    if (isEmptyPatch(pending)) this.editedAt = null;
    this.set({
      conflict: null,
      pending,
      save: isEmptyPatch(pending) ? 'idle' : 'saving',
      message: null,
    });
    void this.flush();
  }

  /** Re-check the server: after reconnecting, regaining focus or a save in another tab. */
  async refresh(): Promise<void> {
    if (this.inflight || this.disposed) return;
    const { status } = this.state;
    if (status === 'loading') return;
    if (status === 'error' || status === 'none') {
      await this.reload();
      return;
    }
    if (status !== 'ready') return;
    await this.syncWithServer();
    if (!isEmptyPatch(this.state.pending)) await this.flush();
  }

  /** Explicit "Try again" after a failed save. */
  retry(): Promise<void> {
    if (this.state.save === 'failed' || this.state.save === 'offline') {
      this.set({ save: 'saving', message: null });
    }
    return this.flush();
  }

  // --- starting a session --------------------------------------------------------------

  /**
   * Start a new planning session (closing the current one on the server). One idempotency
   * key covers retries of the same intent, so a lost response never creates two sessions.
   */
  async create(mode: PlanningMode): Promise<SessionState> {
    this.createKey ??= newIdempotencyKey();
    const result = await this.deps.transport.create(mode, this.createKey);
    if ('error' in result) throw new Error(result.error.message);
    this.createKey = null;
    this.editedAt = null;
    this.restorable = true;
    this.starting = Promise.resolve();
    this.set({
      ...INITIAL,
      status: 'ready',
      server: result.session,
    });
    this.deps.onSaved?.(result.session, true);
    return result.session;
  }

  /**
   * End the plan here: nothing is saved, restored or shown again. Used when the person
   * leaves a plan on purpose and when a finalized report has taken its place. The plan is
   * not resumed later in this visit either, only replaced by `create`.
   */
  discard(): void {
    this.restorable = false;
    this.editedAt = null;
    this.createKey = null;
    this.starting = Promise.resolve();
    this.set({ ...INITIAL, status: 'none' });
  }

  // --- recovery persistence ------------------------------------------------------------

  private persist(): void {
    const { server, pending, status } = this.state;
    const { recovery, uid, accountKind } = this.deps;
    const key = this.recordKey;
    const now = this.now();
    const editedAt = isEmptyPatch(pending) ? null : (this.editedAt ?? now);
    const write =
      server && (status === 'ready' || status === 'loading')
        ? () =>
            recovery.put({
              key,
              uid,
              accountKind,
              sessionId: server.id,
              base: server,
              pending,
              editedAt,
              writtenAt: now,
              expiresAt: now + RECOVERY_TTL_MS,
            })
        : status === 'none' || status === 'closed'
          ? () => recovery.delete(key)
          : null;
    if (!write) return;
    this.persistChain = this.persistChain.then(write).catch(() => undefined);
  }

  /** Resolves once recovery writes queued so far have finished (tests, sign-out). */
  settled(): Promise<void> {
    return this.persistChain;
  }
}
