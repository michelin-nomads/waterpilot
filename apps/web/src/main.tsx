import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import { AuthProvider } from './auth/AuthProvider';
import { ToastProvider } from './components/Toast/ToastProvider';
import { env } from './config/env';
import { createQueryClient } from './graphql/queryClient';
import { installPageVisibilityAttribute } from './lib/pageVisibility';
import { router } from './router';
import { PlanningSessionProvider } from './session/PlanningSessionProvider';
import './styles/global.scss';
import { applyStoredDisplayPreferences } from './theme/displayPreferences';
import { DisplayPreferencesProvider } from './theme/DisplayPreferencesProvider';

// Validate configuration at startup; throws and fails closed on misconfiguration.
void env;

applyStoredDisplayPreferences();
installPageVisibilityAttribute();

const queryClient = createQueryClient();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <DisplayPreferencesProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <PlanningSessionProvider>
            <ToastProvider>
              <RouterProvider router={router} />
            </ToastProvider>
          </PlanningSessionProvider>
        </AuthProvider>
      </QueryClientProvider>
    </DisplayPreferencesProvider>
  </StrictMode>,
);
