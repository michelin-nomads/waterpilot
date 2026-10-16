import { useSyncExternalStore } from 'react';
import { RouterProvider } from 'react-router-dom';

import { useAuth } from '../auth/authContext';
import { ToastProvider } from '../components/Toast/ToastProvider';
import { router } from '../router';
import { PlanningSessionProvider } from '../session/PlanningSessionProvider';
import { LaunchScreen } from './LaunchScreen';

const subscribeToRouter = (onChange: () => void) => router.subscribe(onChange);
const getRouterInitialized = () => router.state.initialized;

/** Keep one startup screen mounted until auth restoration and the first route both finish. */
export function ApplicationStartup() {
  const auth = useAuth();
  const routerInitialized = useSyncExternalStore(
    subscribeToRouter,
    getRouterInitialized,
    () => false,
  );

  if (auth.status === 'loading' || !routerInitialized) return <LaunchScreen />;

  return (
    <PlanningSessionProvider>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </PlanningSessionProvider>
  );
}
