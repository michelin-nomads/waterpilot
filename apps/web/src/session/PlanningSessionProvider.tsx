import { useQueryClient } from '@tanstack/react-query';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import { useAuth } from '../auth/authContext';
import type { AuthUser } from '../auth/types';
import type { PlanningMode } from '../graphql/generated/graphql';
import { queryKeys } from '../graphql/queryKeys';
import { SessionCoordinator, type CoordinatorState } from './coordinator';
import { browserRecoveryStore, type RecoveryStore } from './recoveryStore';
import { PlanningSessionContext, type PlanningSessionContextValue } from './sessionContext';
import type { SessionState } from './sessionState';
import { tabId } from './tabHints';
import type { SessionTransport } from './transport';

// Generated GraphQL documents cannot be tree-shaken, so keep them out of the entry chunk.
const loadTransport = () => import('./transport').then((module) => module.graphqlSessionTransport);
const lazyTransport: SessionTransport = {
  current: async () => (await loadTransport()).current(),
  get: async (...args) => (await loadTransport()).get(...args),
  update: async (...args) => (await loadTransport()).update(...args),
  create: async (...args) => (await loadTransport()).create(...args),
};

const CHANNEL = 'waterpilot.session.v1';

interface SavedMessage {
  uid: string;
  sessionId: string;
  version: number;
}

const IDLE: CoordinatorState = {
  status: 'none',
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
const LOADING: CoordinatorState = { ...IDLE, status: 'loading' };
const noSubscribe = () => () => {};

function identityOf(user: AuthUser | null): string | null {
  return user ? `${user.uid}:${user.kind}` : null;
}

interface PlanningSessionProviderProps {
  children: ReactNode;
  /** Injected in tests; the browser uses GraphQL and IndexedDB. */
  transport?: SessionTransport;
  recovery?: RecoveryStore;
  online?: () => boolean;
  /**
   * Pick up a plan that already exists when the visit starts. The app leaves this off:
   * plans are not kept between visits, so a fresh visit starts without one. It exists to
   * exercise the screens against a plan that is already in progress.
   */
  resumeExisting?: boolean;
}

/**
 * Owns the current user's planning session for every screen and both planning modes.
 * One coordinator per identity: a new uid or account kind gets a fresh coordinator in the
 * same render, so nothing from the previous identity is ever shown.
 */
export function PlanningSessionProvider({
  children,
  transport = lazyTransport,
  recovery: recoveryProp,
  online,
  resumeExisting = false,
}: PlanningSessionProviderProps) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [recovery] = useState(() => recoveryProp ?? browserRecoveryStore());
  const registry = useRef(new Map<string, SessionCoordinator>());
  const previousUser = useRef<AuthUser | null>(null);
  const channel = useRef<BroadcastChannel | null>(null);

  const onSaved = useCallback(
    (session: SessionState, inputsChanged: boolean, uid: string) => {
      if (inputsChanged) {
        queryClient.removeQueries({ queryKey: queryKeys.sessions.derived(session.id) });
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions.detail(session.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions.current() });
      const message: SavedMessage = { uid, sessionId: session.id, version: session.version };
      channel.current?.postMessage(message);
    },
    [queryClient],
  );

  const coordinatorFor = useCallback(
    (user: AuthUser): SessionCoordinator => {
      const identity = identityOf(user) as string;
      let coordinator = registry.current.get(identity);
      if (!coordinator) {
        const previous = previousUser.current;
        // A plan is handed over only when the previous identity of this visit was holding
        // one (a guest signing in); otherwise the visit starts without a plan.
        const handedOver = [...registry.current.values()].some(
          (other) => other.getState().status === 'ready',
        );
        coordinator = new SessionCoordinator({
          uid: user.uid,
          accountKind: user.kind,
          tabId: tabId(),
          restore: handedOver || (resumeExisting && registry.current.size === 0),
          transport,
          recovery,
          online,
          adoptFrom: previous?.kind === 'guest' && previous.uid !== user.uid ? previous.uid : null,
          onSaved: (session, inputsChanged) => onSaved(session, inputsChanged, user.uid),
        });
        registry.current.set(identity, coordinator);
      }
      return coordinator;
    },
    [transport, recovery, online, onSaved, resumeExisting],
  );

  const ready = auth.status === 'ready';
  const user = ready ? auth.user : null;
  const identity = identityOf(user);
  const coordinator = useMemo(
    () => (user && identity ? coordinatorFor(user) : null),
    // The coordinator belongs to the identity, not to the user object's other fields.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [identity, coordinatorFor],
  );

  const state = useSyncExternalStore(
    coordinator?.subscribe ?? noSubscribe,
    coordinator?.getState ?? (() => (ready ? IDLE : LOADING)),
  );

  // Start the identity's coordinator; retire the previous identity and its device copy.
  useEffect(() => {
    if (!ready) return;
    const previous = previousUser.current;
    previousUser.current = user;
    for (const [key, other] of registry.current) {
      if (key === identity) continue;
      other.dispose();
      registry.current.delete(key);
    }
    // A permanent account signing out (or switching) leaves nothing of theirs behind.
    // A guest who upgrades keeps their copy until the new account adopts it.
    if (previous && previous.uid !== user?.uid && previous.kind === 'permanent') {
      void recovery.deleteUid(previous.uid);
    }
    void coordinator?.start();
  }, [ready, identity, user, coordinator, recovery]);

  // A guest's plan lands in this account once a pending claim completes.
  useEffect(() => {
    if (!auth.pendingClaim) void coordinator?.refresh();
  }, [auth.pendingClaim, coordinator]);

  useEffect(() => {
    void recovery.deleteExpired(Date.now());
  }, [recovery]);

  // Reconcile with saves made elsewhere: other tabs, reconnecting and returning to the tab.
  useEffect(() => {
    if (!coordinator) return;
    const refresh = () => void coordinator.refresh();
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', onVisible);
    const bc = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL);
    channel.current = bc;
    if (bc) {
      bc.onmessage = (event: MessageEvent<SavedMessage>) => {
        const server = coordinator.getState().server;
        if (event.data.uid !== coordinator.uid) return;
        if (server && event.data.sessionId === server.id && event.data.version <= server.version) {
          return;
        }
        refresh();
      };
    }
    return () => {
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', onVisible);
      bc?.close();
      if (channel.current === bc) channel.current = null;
    };
  }, [coordinator]);

  const newReport = useCallback(
    async (mode: PlanningMode) => {
      const current = auth.user ?? (await auth.startGuest());
      return coordinatorFor(current).create(mode);
    },
    [auth, coordinatorFor],
  );

  const value = useMemo<PlanningSessionContextValue>(
    () => ({
      coordinator,
      state,
      view: coordinator && state.server ? coordinator.view() : null,
      inputsPending: coordinator ? coordinator.inputsPending() : false,
      newReport,
    }),
    [coordinator, state, newReport],
  );

  return (
    <PlanningSessionContext.Provider value={value}>{children}</PlanningSessionContext.Provider>
  );
}
