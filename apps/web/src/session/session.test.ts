import 'fake-indexeddb/auto';

import { FakeSessionServer } from '../test/fakeSession';
import { SessionCoordinator, type CoordinatorDeps } from './coordinator';
import {
  IndexedDbRecoveryStore,
  MemoryRecoveryStore,
  RECOVERY_TTL_MS,
  TolerantRecoveryStore,
  type RecoveryRecord,
  type RecoveryStore,
} from './recoveryStore';
import { applyPatch, mergeEdits, type SessionState } from './sessionState';

const GOAL_A = { kind: 'REDUCE_SHORTAGE', description: 'Cut demand by a fifth' } as const;
const GOAL_B = { kind: 'REDUCE_SHORTAGE', description: 'Cut demand by a third' } as const;

function setup(overrides: Partial<CoordinatorDeps> = {}) {
  const server = new FakeSessionServer();
  const recovery = overrides.recovery ?? new MemoryRecoveryStore();
  let uid = overrides.uid ?? 'user-1';
  let online = true;
  const saved: Array<{ id: string; inputsChanged: boolean }> = [];
  const transport = server.transport(() => uid);
  const make = (extra: Partial<CoordinatorDeps> = {}) =>
    new SessionCoordinator({
      uid,
      accountKind: 'permanent',
      tabId: 'tab-1',
      transport,
      recovery,
      online: () => online,
      onSaved: (session, inputsChanged) => saved.push({ id: session.id, inputsChanged }),
      ...overrides,
      ...extra,
    });
  return {
    server,
    recovery,
    saved,
    make,
    setOnline: (value: boolean) => {
      online = value;
    },
    setUid: (value: string) => {
      uid = value;
    },
  };
}

async function ready(env: ReturnType<typeof setup>, seed: Partial<SessionState> = {}) {
  const session = env.server.seed('user-1', seed);
  const coordinator = env.make();
  await coordinator.start();
  return { session, coordinator };
}

describe('mergeEdits', () => {
  const base = { ...new FakeSessionServer().seed('u') };

  it('drops edits the server already holds, rebases untouched fields, flags real conflicts', () => {
    const latest: SessionState = { ...base, version: 3, areaId: 'area-2', goal: GOAL_B };
    const result = mergeEdits(base, latest, {
      areaId: 'area-2',
      goal: GOAL_A,
      scenario: { adjustments: [], confirmed: true },
    });
    expect(result.dropped).toEqual(['areaId']);
    expect(result.conflicts).toEqual(['goal']);
    expect(Object.keys(result.pending).sort()).toEqual(['goal', 'scenario']);
  });

  it('keeps financial edits and clears a plan chosen before a tariff change', () => {
    const goal = {
      ...GOAL_A,
      waterTariff: {
        price: { minorUnits: '90000', currency: 'INR' },
        volume: { value: '10000', unit: 'LITRE' as const },
        note: 'Synthetic quote',
      },
      contingencyRatio: '0.1',
      funding: [
        {
          label: 'Grant',
          amount: { minorUnits: '10000', currency: 'USD' },
          status: 'EXPECTED' as const,
          note: 'Unapproved',
        },
      ],
    };
    const changed = applyPatch({ ...base, goal: GOAL_A, selectedPlanOptionId: 'pln_1' }, { goal });
    expect(changed.goal).toMatchObject(goal);
    expect(changed.selectedPlanOptionId).toBeNull();
    expect(
      applyPatch({ ...base, areaExtent: 'USER_RADIUS', areaRadiusMeters: 1000 }, { areaId: 'new' })
        .areaRadiusMeters,
    ).toBeNull();
  });

  it('lets the latest mode and step win without a conflict', () => {
    const latest: SessionState = { ...base, version: 2, stage: 'COMPARE', mode: 'AGENT' };
    const result = mergeEdits(base, latest, { stage: 'GOAL', mode: 'TRADITIONAL' });
    expect(result.conflicts).toEqual([]);
    expect(result.pending).toEqual({ stage: 'GOAL', mode: 'TRADITIONAL' });
  });

  it('drops a plan choice made for inputs that changed elsewhere', () => {
    const latest: SessionState = { ...base, version: 2, goal: GOAL_B, inputsRevision: 1 };
    const result = mergeEdits(base, latest, { selectedPlanOptionId: 'pln_1' });
    expect(result.selectionStale).toBe(true);
    expect(result.pending).toEqual({});
  });

  it('applies the server dependency rules to the local view', () => {
    const chosen: SessionState = {
      ...base,
      goal: GOAL_A,
      scenario: { adjustments: [], interpretedFrom: null, confirmed: true },
      selectedPlanOptionId: 'pln_1',
    };
    const moved = applyPatch(chosen, { areaId: 'area-9' });
    expect(moved.scenario).toBeNull();
    expect(moved.selectedPlanOptionId).toBeNull();
    expect(applyPatch(chosen, { goal: GOAL_B }).selectedPlanOptionId).toBeNull();
    expect(applyPatch(chosen, { goal: GOAL_A })).toEqual(chosen);
    const wetter = {
      adjustments: [
        {
          parameter: 'rainfall',
          change: 'INCREASE_BY' as const,
          quantity: { value: '0.1', unit: 'RATIO' as const },
        },
      ],
      interpretedFrom: null,
      confirmed: true,
    };
    expect(applyPatch(chosen, { scenario: wetter }).selectedPlanOptionId).toBeNull();
    expect(applyPatch(chosen, { scenario: chosen.scenario })).toEqual(chosen);
  });
});

describe('SessionCoordinator saving', () => {
  it('reports "saved" only after the server acknowledges the write', async () => {
    const env = setup();
    const { coordinator } = await ready(env);
    let release!: () => void;
    env.server.hold = new Promise((resolve) => (release = resolve));

    coordinator.setGoal(GOAL_A);
    expect(coordinator.view()?.goal?.description).toBe(GOAL_A.description);
    await vi.waitFor(() => expect(env.server.applied).toHaveLength(1));
    expect(coordinator.getState().save).toBe('saving');

    release();
    await vi.waitFor(() => expect(coordinator.getState().save).toBe('saved'));
    expect(coordinator.getState().server?.version).toBe(2);
    expect(coordinator.getState().pending).toEqual({});
  });

  it('sends edits made during a save in the next write, with the new expected version', async () => {
    const env = setup();
    const { session, coordinator } = await ready(env);
    let release!: () => void;
    env.server.hold = new Promise((resolve) => (release = resolve));
    coordinator.setGoal(GOAL_A);
    await vi.waitFor(() => expect(env.server.applied).toHaveLength(1));
    coordinator.setStage('GOAL');
    const saving = coordinator.flush();
    env.server.hold = null;
    release();
    await saving;
    expect(coordinator.getState().save).toBe('saved');
    expect(coordinator.getState().pending).toEqual({});
    expect(env.server.calls.filter((c) => c.startsWith('update'))).toEqual([
      `update:${session.id}:1:goal`,
      `update:${session.id}:2:stage`,
    ]);
  });

  it('never applies a write twice when the response is lost and the save is retried', async () => {
    const env = setup();
    const { coordinator } = await ready(env);
    env.server.dropResponses = 1;
    coordinator.setGoal(GOAL_A);
    await vi.waitFor(() => expect(coordinator.getState().save).toBe('failed'));
    expect(coordinator.view()?.goal?.description).toBe(GOAL_A.description);

    await coordinator.retry();
    expect(coordinator.getState().save).toBe('saved');
    expect(env.server.applied).toHaveLength(1);
    expect(coordinator.getState().server?.version).toBe(2);
  });

  it('keeps offline edits on the device and saves them once on reconnect', async () => {
    const env = setup();
    const { coordinator } = await ready(env);
    env.setOnline(false);
    env.server.offline = true;
    coordinator.setArea('area-1');
    coordinator.setGoal(GOAL_A);
    await coordinator.flush();
    expect(coordinator.getState().save).toBe('offline');
    expect(env.server.calls.some((c) => c.startsWith('update'))).toBe(false);
    await coordinator.settled();
    const [record] = await env.recovery.forUid('user-1');
    expect(record?.pending).toMatchObject({ areaId: 'area-1', goal: GOAL_A });

    env.setOnline(true);
    env.server.offline = false;
    await coordinator.refresh();
    expect(coordinator.getState().save).toBe('saved');
    expect(env.server.applied).toHaveLength(1);
    expect(env.server.applied[0]?.patch).toMatchObject({ areaId: 'area-1', goal: GOAL_A });
  });

  it('marks derived results stale only when location, goal or scenario change', async () => {
    const env = setup();
    const { coordinator } = await ready(env);
    coordinator.setStage('GOAL');
    await vi.waitFor(() => expect(env.saved).toHaveLength(1));
    coordinator.setArea('area-1');
    await vi.waitFor(() => expect(env.saved).toHaveLength(2));
    expect(env.saved.map((s) => s.inputsChanged)).toEqual([false, true]);
    expect(coordinator.getState().server?.inputsRevision).toBe(1);
  });

  it('drops a rejected plan choice and keeps the rest of the session', async () => {
    const env = setup();
    const { session, coordinator } = await ready(env, { goal: GOAL_A });
    const option = env.server.seedOption(session.id);
    env.server.externalEdit(session.id, { goal: GOAL_B });
    // This tab has not heard about the goal change yet and chooses the old option.
    coordinator.selectPlanOption(option);
    await vi.waitFor(() => expect(coordinator.getState().save).not.toBe('saving'));
    expect(coordinator.view()?.selectedPlanOptionId).toBeNull();
    expect(coordinator.view()?.goal?.description).toBe(GOAL_B.description);
    expect(coordinator.getState().message).toMatch(/plan choice was cleared/i);
  });

  it('re-affirms an unchanged plan choice only when forced, to refresh a stale assessment', async () => {
    const env = setup();
    const option = 'pln_chosen';
    const { session, coordinator } = await ready(env, {
      goal: GOAL_A,
      selectedPlanOptionId: option,
      inputsRevision: 0,
    });
    env.server.options.set(option, 0); // still one of the current options, just reassessed
    // Choosing the same, already-selected plan is a no-op: nothing is sent.
    coordinator.selectPlanOption(option);
    await vi.waitFor(() => expect(coordinator.getState().save).not.toBe('saving'));
    expect(env.server.applied).toHaveLength(0);
    // Forcing it re-sends the choice so the server re-stores the current assessment.
    coordinator.reselectPlanOption(option);
    await vi.waitFor(() => expect(env.server.applied).toHaveLength(1));
    expect(env.server.applied[0]).toEqual({
      id: session.id,
      patch: { selectedPlanOptionId: option },
    });
  });

  it('stops saving into a session replaced elsewhere and offers the current one', async () => {
    const env = setup();
    const { coordinator } = await ready(env);
    const replacement = env.server.seed('user-1');
    coordinator.setGoal(GOAL_A);
    await vi.waitFor(() => expect(coordinator.getState().status).toBe('closed'));
    await coordinator.reload();
    expect(coordinator.getState().server?.id).toBe(replacement.id);
    expect(coordinator.getState().pending).toEqual({});
  });

  it('reuses one idempotency key when creating a session is retried', async () => {
    const env = setup();
    const coordinator = env.make();
    await coordinator.start();
    expect(coordinator.getState().status).toBe('none');
    env.server.dropResponses = 1;
    await expect(coordinator.create('TRADITIONAL')).rejects.toThrow();
    const created = await coordinator.create('TRADITIONAL');
    expect([...env.server.sessions.values()].filter((s) => s.owner === 'user-1')).toHaveLength(1);
    expect(coordinator.getState().server?.id).toBe(created.id);
  });
});

describe('SessionCoordinator conflicts', () => {
  it('rebases edits to other fields silently', async () => {
    const env = setup();
    const { session, coordinator } = await ready(env);
    env.server.externalEdit(session.id, { areaId: 'area-7' });
    coordinator.setGoal(GOAL_A);
    await vi.waitFor(() => expect(coordinator.getState().save).toBe('saved'));
    const stored = env.server.sessions.get(session.id);
    expect(stored?.areaId).toBe('area-7');
    expect(stored?.goal?.description).toBe(GOAL_A.description);
  });

  it('asks which version to keep when the same input changed in two places', async () => {
    const env = setup();
    const { session, coordinator } = await ready(env);
    env.server.externalEdit(session.id, { goal: GOAL_B });
    coordinator.setGoal(GOAL_A);
    coordinator.setStage('GOAL');
    await vi.waitFor(() => expect(coordinator.getState().save).toBe('conflict'));
    expect(coordinator.getState().conflict?.fields).toEqual(['goal']);
    expect(env.server.sessions.get(session.id)?.goal?.description).toBe(GOAL_B.description);

    coordinator.resolveConflict('mine');
    await vi.waitFor(() => expect(coordinator.getState().save).toBe('saved'));
    const stored = env.server.sessions.get(session.id);
    expect(stored?.goal?.description).toBe(GOAL_A.description);
    expect(stored?.stage).toBe('GOAL');
  });

  it('can take the saved version instead and discard only the conflicting edit', async () => {
    const env = setup();
    const { session, coordinator } = await ready(env);
    env.server.externalEdit(session.id, { goal: GOAL_B });
    coordinator.setGoal(GOAL_A);
    await vi.waitFor(() => expect(coordinator.getState().save).toBe('conflict'));
    const writes = env.server.applied.length;
    coordinator.resolveConflict('theirs');
    await coordinator.flush();
    expect(coordinator.view()?.goal?.description).toBe(GOAL_B.description);
    expect(coordinator.getState().pending).toEqual({});
    expect(env.server.applied).toHaveLength(writes);
  });

  it('a second tab picks up the first tab’s save on refresh', async () => {
    const env = setup();
    const { coordinator: first } = await ready(env);
    const second = env.make({ tabId: 'tab-2' });
    await second.start();
    first.setArea('area-3');
    await vi.waitFor(() => expect(first.getState().save).toBe('saved'));
    await second.refresh();
    expect(second.view()?.areaId).toBe('area-3');
    expect(second.getState().server?.version).toBe(2);
  });
});

describe('SessionCoordinator recovery', () => {
  it('restores unsaved edits after a reload and saves them once', async () => {
    const env = setup();
    const { session, coordinator } = await ready(env);
    env.setOnline(false);
    coordinator.setGoal(GOAL_A);
    await coordinator.flush();
    await coordinator.settled();
    coordinator.dispose();

    env.setOnline(true);
    const reloaded = env.make();
    await reloaded.start();
    await vi.waitFor(() => expect(reloaded.getState().save).toBe('saved'));
    expect(reloaded.getState().restoredFrom).not.toBeNull();
    expect(env.server.sessions.get(session.id)?.goal?.description).toBe(GOAL_A.description);
    expect(env.server.applied).toHaveLength(1);
  });

  it('opens the device copy when the server cannot be reached', async () => {
    const env = setup();
    const { coordinator } = await ready(env, { areaId: 'area-5' });
    await coordinator.settled();
    coordinator.dispose();
    env.server.offline = true;
    env.setOnline(false);
    const reloaded = env.make();
    await reloaded.start();
    expect(reloaded.getState()).toMatchObject({ status: 'ready', offlineCopy: true });
    expect(reloaded.view()?.areaId).toBe('area-5');
  });

  it('does not apply recovered edits to a session that was replaced meanwhile', async () => {
    const env = setup();
    const { coordinator } = await ready(env);
    env.setOnline(false);
    coordinator.setGoal(GOAL_A);
    await coordinator.flush();
    await coordinator.settled();
    coordinator.dispose();
    const replacement = env.server.seed('user-1');
    env.setOnline(true);
    const reloaded = env.make();
    await reloaded.start();
    expect(reloaded.getState().server?.id).toBe(replacement.id);
    expect(reloaded.view()?.goal).toBeNull();
    expect(env.server.applied).toHaveLength(0);
  });

  it('carries a guest’s unsaved edits into the account the plan moved to', async () => {
    const env = setup({ uid: 'guest-1' });
    const session = env.server.seed('guest-1');
    const asGuest = env.make({ accountKind: 'guest' });
    await asGuest.start();
    env.setOnline(false);
    asGuest.setGoal(GOAL_A);
    await asGuest.flush();
    await asGuest.settled();
    asGuest.dispose();

    // The claim moved the session to the permanent account, keeping its id.
    const moved = env.server.sessions.get(session.id);
    if (moved) moved.owner = 'user-1';
    env.setUid('user-1');
    env.setOnline(true);
    const asUser = env.make({ uid: 'user-1', adoptFrom: 'guest-1', tabId: 'tab-1' });
    await asUser.start();
    await vi.waitFor(() => expect(asUser.getState().save).toBe('saved'));
    expect(env.server.sessions.get(session.id)?.goal?.description).toBe(GOAL_A.description);
    await vi.waitFor(async () => expect(await env.recovery.forUid('guest-1')).toEqual([]));
  });
});

function record(overrides: Partial<RecoveryRecord>): RecoveryRecord {
  const base = new FakeSessionServer().seed('u');
  return {
    key: 'u:t',
    uid: 'u',
    accountKind: 'guest',
    sessionId: base.id,
    base,
    pending: {},
    editedAt: null,
    writtenAt: 0,
    expiresAt: RECOVERY_TTL_MS,
    ...overrides,
  };
}

describe.each<[string, () => RecoveryStore]>([
  ['memory', () => new MemoryRecoveryStore()],
  ['IndexedDB', () => new IndexedDbRecoveryStore(new IDBFactory())],
])('%s recovery store', (_name, create) => {
  it('keeps records per owner and removes them by owner or expiry', async () => {
    const store = create();
    await store.put(record({ key: 'a:1', uid: 'a', expiresAt: 100 }));
    await store.put(record({ key: 'a:2', uid: 'a', expiresAt: 900 }));
    await store.put(record({ key: 'b:1', uid: 'b', expiresAt: 900 }));
    expect((await store.forUid('a')).map((r) => r.key).sort()).toEqual(['a:1', 'a:2']);

    expect(await store.deleteExpired(500)).toBe(1);
    expect((await store.forUid('a')).map((r) => r.key)).toEqual(['a:2']);
    await store.deleteUid('a');
    expect(await store.forUid('a')).toEqual([]);
    expect(await store.forUid('b')).toHaveLength(1);
    await store.delete('b:1');
    expect(await store.forUid('b')).toEqual([]);
  });

  it('holds only session inputs, never tokens', async () => {
    const store = create();
    await store.put(record({ pending: { goal: GOAL_A } }));
    const [stored] = await store.forUid('u');
    expect(JSON.stringify(stored)).not.toMatch(/token|password|secret/i);
  });
});

it('falls back to memory when IndexedDB fails', async () => {
  const broken: RecoveryStore = {
    put: () => Promise.reject(new Error('quota')),
    forUid: () => Promise.reject(new Error('quota')),
    delete: () => Promise.reject(new Error('quota')),
    deleteUid: () => Promise.reject(new Error('quota')),
    deleteExpired: () => Promise.reject(new Error('quota')),
  };
  const store = new TolerantRecoveryStore(broken);
  await store.put(record({}));
  expect(await store.forUid('u')).toHaveLength(1);
});

describe('plans that are not kept', () => {
  it('does not pick up a plan from an earlier visit when restore is off', async () => {
    const env = setup();
    env.server.seed('user-1', { goal: GOAL_A });
    const coordinator = env.make({ restore: false });
    await coordinator.start();
    expect(coordinator.getState().status).toBe('none');
    expect(coordinator.getState().server).toBeNull();
  });

  it('discard ends the plan, saves nothing more, and a later create starts a new one', async () => {
    const env = setup();
    const { session, coordinator } = await ready(env, { stage: 'GOAL' });
    coordinator.setGoal(GOAL_A);
    coordinator.discard();
    expect(coordinator.getState().status).toBe('none');
    expect(coordinator.getState().pending).toEqual({});
    await coordinator.start();
    expect(coordinator.getState().status).toBe('none');
    await coordinator.settled();
    expect(await env.recovery.forUid('user-1')).toEqual([]);

    const created = await coordinator.create('TRADITIONAL');
    expect(created.id).not.toBe(session.id);
    expect(coordinator.getState().status).toBe('ready');
  });
});
