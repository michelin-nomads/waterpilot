import { createBrowserRouter, Navigate } from 'react-router-dom';

import App from './App';

/**
 * Feature routes are lazy-loaded so each feature module ships in its own chunk
 * (bundle discipline per the HLD). Screens are implemented from Phase 03 onward.
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Navigate to="/area" replace /> },
      {
        path: 'area',
        lazy: async () => ({ Component: (await import('./features/area')).default }),
      },
      {
        path: 'scenarios',
        lazy: async () => ({ Component: (await import('./features/scenarios')).default }),
      },
      {
        path: 'goals',
        lazy: async () => ({ Component: (await import('./features/goals')).default }),
      },
      {
        path: 'plans',
        lazy: async () => ({ Component: (await import('./features/plans')).default }),
      },
      {
        path: 'funding',
        lazy: async () => ({ Component: (await import('./features/funding')).default }),
      },
      {
        path: 'proposals',
        lazy: async () => ({ Component: (await import('./features/proposals')).default }),
      },
      {
        path: 'tracking',
        lazy: async () => ({ Component: (await import('./features/tracking')).default }),
      },
    ],
  },
]);
