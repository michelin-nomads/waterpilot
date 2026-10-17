import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { invalidateAfter } from '../graphql/invalidation';
import { setAuthTokenProvider } from '../lib/authToken';
import {
  completeClaim,
  upgradeGuest,
  type ClaimApi,
  type PendingClaim,
  type UpgradeResult,
} from './accountUpgrade';
import { AuthContext, type AuthContextValue, type AuthStatus } from './authContext';
import { SignInDialog } from './SignInDialog';
import type { AuthBackend, AuthMethod, AuthUser } from './types';

const loadFirebaseBackend = (): Promise<AuthBackend> =>
  import('./firebaseClient').then((module) => module.getFirebaseAuthBackend());

// Generated GraphQL documents cannot be tree-shaken, so keep them out of the entry chunk.
const loadClaimApi = () => import('./graphqlClaimApi').then((module) => module.graphqlClaimApi);
const lazyClaimApi: ClaimApi = {
  begin: async () => (await loadClaimApi()).begin(),
  complete: async (...args) => (await loadClaimApi()).complete(...args),
  cancel: async (...args) => (await loadClaimApi()).cancel(...args),
};

interface AuthProviderProps {
  children: ReactNode;
  /** Injected in tests; the browser loads the Firebase chunk lazily. */
  loadBackend?: () => Promise<AuthBackend>;
  claimApi?: ClaimApi;
}

function sameUser(a: AuthUser | null, b: AuthUser | null): boolean {
  return a?.uid === b?.uid && a?.kind === b?.kind && a?.email === b?.email;
}

export function AuthProvider({
  children,
  loadBackend = loadFirebaseBackend,
  claimApi = lazyClaimApi,
}: AuthProviderProps) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [pendingClaim, setPendingClaim] = useState<PendingClaim | null>(null);
  const [dialog, setDialog] = useState<{ reason: string | undefined } | null>(null);
  const dialogWaiters = useRef<Array<(permanent: boolean) => void>>([]);
  const backendRef = useRef<Promise<AuthBackend> | null>(null);
  const userRef = useRef<AuthUser | null>(null);

  // Cached data belongs to one identity. Dropping it here, before the new user renders,
  // means no screen can show the previous identity's data even for one frame.
  const identityRef = useRef<string | undefined>(undefined);

  // Actions apply their result at once; onIdTokenChanged may report it a tick later.
  const applyUser = useCallback(
    (next: AuthUser | null) => {
      const identity = next ? `${next.uid}:${next.kind}` : '';
      if (identityRef.current !== undefined && identityRef.current !== identity) {
        queryClient.clear();
      }
      identityRef.current = identity;
      userRef.current = next;
      setUser((previous) => (sameUser(previous, next) ? previous : next));
    },
    [queryClient],
  );

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    setStatus('loading');
    const ready = loadBackend().then(async (backend) => {
      await backend.ready();
      return backend;
    });
    backendRef.current = ready;
    ready.then(
      (backend) => {
        if (!active) return;
        applyUser(backend.currentUser());
        unsubscribe = backend.onUserChanged(applyUser);
        setStatus('ready');
      },
      () => {
        if (active) setStatus('error');
      },
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [loadBackend, loadAttempt, applyUser]);

  useEffect(() => {
    setAuthTokenProvider(async ({ forceRefresh = false } = {}) => {
      const backend = await backendRef.current?.catch(() => null);
      return backend ? backend.getIdToken(forceRefresh) : null;
    });
    return () => setAuthTokenProvider(async () => null);
  }, []);

  const backend = useCallback(async (): Promise<AuthBackend> => {
    if (!backendRef.current) throw new Error('Auth is not initialised');
    return backendRef.current;
  }, []);

  const afterClaim = useCallback(
    () => invalidateAfter(queryClient, 'completeAccountClaim', {}),
    [queryClient],
  );

  const startGuest = useCallback(async () => {
    const auth = await backend();
    const guest = auth.currentUser() ?? (await auth.signInAsGuest());
    applyUser(guest);
    return guest;
  }, [backend, applyUser]);

  const authenticate = useCallback(
    async (method: AuthMethod): Promise<UpgradeResult> => {
      const auth = await backend();
      const current = auth.currentUser();
      if (current?.kind === 'permanent') return { user: current, pendingClaim: null };
      if (current?.kind !== 'guest') {
        const signedIn = await auth.signIn(method);
        applyUser(signedIn);
        return { user: signedIn, pendingClaim: null };
      }
      const result = await upgradeGuest(auth, claimApi, method);
      applyUser(result.user);
      setPendingClaim(result.pendingClaim);
      if (!result.pendingClaim) await afterClaim();
      return result;
    },
    [backend, claimApi, afterClaim, applyUser],
  );

  const retryPendingClaim = useCallback(async () => {
    if (!pendingClaim) return;
    await completeClaim(claimApi, pendingClaim);
    setPendingClaim(null);
    await afterClaim();
  }, [claimApi, pendingClaim, afterClaim]);

  const openSignIn = useCallback(
    (reason?: string) =>
      new Promise<boolean>((resolve) => {
        dialogWaiters.current.push(resolve);
        setDialog((open) => open ?? { reason });
      }),
    [],
  );

  const ensurePermanent = useCallback(
    async (reason?: string) => {
      await backend().catch(() => undefined);
      return userRef.current?.kind === 'permanent' ? true : openSignIn(reason);
    },
    [backend, openSignIn],
  );

  const closeDialog = useCallback(() => {
    const permanent = userRef.current?.kind === 'permanent';
    const waiters = dialogWaiters.current;
    dialogWaiters.current = [];
    waiters.forEach((resolve) => resolve(permanent));
    setDialog(null);
  }, []);

  const sendPasswordReset = useCallback(
    async (email: string) => (await backend()).sendPasswordReset(email),
    [backend],
  );

  const signOut = useCallback(async () => {
    setPendingClaim(null);
    await (await backend()).signOut();
    applyUser(null);
  }, [backend, applyUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      reload: () => setLoadAttempt((n) => n + 1),
      startGuest,
      authenticate,
      pendingClaim,
      retryPendingClaim,
      discardPendingClaim: () => setPendingClaim(null),
      openSignIn,
      ensurePermanent,
      sendPasswordReset,
      signOut,
    }),
    [
      status,
      user,
      startGuest,
      authenticate,
      pendingClaim,
      retryPendingClaim,
      openSignIn,
      ensurePermanent,
      sendPasswordReset,
      signOut,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <SignInDialog open={dialog !== null} reason={dialog?.reason} onClose={closeDialog} />
    </AuthContext.Provider>
  );
}
