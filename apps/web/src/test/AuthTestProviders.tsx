import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMemo, useState, type ReactNode } from 'react';

import type { ClaimApi } from '../auth/accountUpgrade';
import { AuthProvider } from '../auth/AuthProvider';
import { PlanningSessionProvider } from '../session/PlanningSessionProvider';
import { MemoryRecoveryStore, type RecoveryStore } from '../session/recoveryStore';
import { FakeClaimApi, type FakeAuthBackend } from './fakeAuth';
import { FakeSessionServer } from './fakeSession';

export function AuthTestProviders({
  backend,
  claimApi = new FakeClaimApi(),
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  sessions = new FakeSessionServer(),
  recovery = new MemoryRecoveryStore(),
  online = () => true,
  children,
}: {
  backend: FakeAuthBackend;
  claimApi?: ClaimApi;
  queryClient?: QueryClient;
  sessions?: FakeSessionServer;
  recovery?: RecoveryStore;
  online?: () => boolean;
  children: ReactNode;
}) {
  const [client] = useState(() => queryClient);
  const [claims] = useState(() => claimApi);
  const [transport] = useState(() => sessions.transport(() => backend.currentUser()?.uid ?? null));
  const [store] = useState(() => recovery);
  const loadBackend = useMemo(() => async () => backend, [backend]);
  return (
    <QueryClientProvider client={client}>
      <AuthProvider loadBackend={loadBackend} claimApi={claims}>
        <PlanningSessionProvider transport={transport} recovery={store} online={online}>
          {children}
        </PlanningSessionProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
