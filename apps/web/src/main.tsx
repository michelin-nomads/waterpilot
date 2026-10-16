import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { AuthProvider } from './auth/AuthProvider';
import { env } from './config/env';
import { createQueryClient } from './graphql/queryClient';
import { installPageVisibilityAttribute } from './lib/pageVisibility';
import './styles/global.scss';
import { applyStoredDisplayPreferences } from './theme/displayPreferences';
import { DisplayPreferencesProvider } from './theme/DisplayPreferencesProvider';
import { ApplicationStartup } from './shell/ApplicationStartup';

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
          <ApplicationStartup />
        </AuthProvider>
      </QueryClientProvider>
    </DisplayPreferencesProvider>
  </StrictMode>,
);
