import { useEffect, useState, useSyncExternalStore } from 'react';
import { RouterProvider } from 'react-router-dom';

import { useAuth } from '../auth/authContext';
import { ToastProvider } from '../components/Toast/ToastProvider';
import { router } from '../router';
import { PlanningSessionProvider } from '../session/PlanningSessionProvider';
import { LaunchScreen } from './LaunchScreen';

const subscribeToRouter = (onChange: () => void) => router.subscribe(onChange);
const getRouterInitialized = () => router.state.initialized;

// Enough time to register the illustration without making a returning visit feel slow.
const SPLASH_DURATION_MS = 2000;

/** Show one timed splash while auth and the initial route load in parallel. */
export function ApplicationStartup() {
  const auth = useAuth();
  const [introComplete, setIntroComplete] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setIntroComplete(true), SPLASH_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, []);
  const routerInitialized = useSyncExternalStore(
    subscribeToRouter,
    getRouterInitialized,
    () => false,
  );

  if (!introComplete || auth.status === 'loading' || !routerInitialized) return <LaunchScreen />;

  return (
    <PlanningSessionProvider>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </PlanningSessionProvider>
  );
}
