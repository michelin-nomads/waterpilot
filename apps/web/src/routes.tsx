import type { ComponentType } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';

import { env } from './config/env';
import AppShell from './shell/AppShell';
import { LaunchScreen } from './shell/LaunchScreen';
import { NotFoundPage, RouteError } from './shell/RouteStatus';
import { RequireAccount } from './shell/RequireAccount';

const lazyPage = (load: () => Promise<{ default: ComponentType }>) => async () => ({
  Component: (await load()).default,
});

/**
 * Feature routes are lazy so each feature ships in its own chunk. The planning stages share
 * PlanningLayout (stepper, Traditional/Agent mode, agent + workspace panes).
 */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    HydrateFallback: LaunchScreen,
    errorElement: <RouteError />,
    children: [
      {
        // Pathless boundary so route errors render inside the shell.
        errorElement: <RouteError />,
        children: [
          // The start: Welcome for everyone else, the workspace for signed-in accounts.
          { index: true, lazy: lazyPage(() => import('./features/welcome')) },
          {
            // The planner is open to guests; it needs a plan, which Welcome or New report starts.
            lazy: lazyPage(() => import('./features/planning/PlanningLayout')),
            children: [
              { path: 'area', lazy: lazyPage(() => import('./features/area')) },
              {
                path: 'baseline/:section?',
                lazy: lazyPage(() => import('./features/area/BaselinePage')),
              },
              { path: 'reports/review', lazy: lazyPage(() => import('./features/reports/Review')) },
              { path: 'goals', lazy: lazyPage(() => import('./features/goals')) },
              { path: 'plans', lazy: lazyPage(() => import('./features/plans')) },
            ],
          },
          // What-if is a workspace panel now (ADR 0002); keep old links working.
          { path: 'scenarios', element: <Navigate to="/plans" replace /> },
          // Everything below belongs to a signed-in account; guests can only plan.
          {
            element: <RequireAccount />,
            children: [
              {
                lazy: lazyPage(() => import('./features/workspace/WorkspaceLayout')),
                children: [
                  {
                    path: 'reports',
                    lazy: lazyPage(() => import('./features/workspace/ReportsTab')),
                  },
                  {
                    path: 'communities',
                    lazy: lazyPage(() => import('./features/workspace/CommunitiesTab')),
                  },
                ],
              },
              { path: 'dashboard', element: <Navigate to="/reports" replace /> },
              // Optional branches retain their existing public URLs, outside the planner.
              { path: 'make-it-happen', lazy: lazyPage(() => import('./features/funding')) },
              { path: 'tracking', lazy: lazyPage(() => import('./features/tracking')) },
              { path: 'tracking/:projectId', lazy: lazyPage(() => import('./features/tracking')) },
              { path: 'funding', element: <Navigate to="/make-it-happen" replace /> },
              {
                path: 'admin/funding',
                lazy: lazyPage(() => import('./features/funding/AdminCatalogue')),
              },
              { path: 'proposals', lazy: lazyPage(() => import('./features/proposals')) },
              { path: 'proposals/new', lazy: lazyPage(() => import('./features/proposals')) },
              {
                path: 'reports/:reportId',
                lazy: lazyPage(() => import('./features/reports/ReportDetail')),
              },
              {
                path: 'communities/new',
                lazy: lazyPage(() => import('./features/communities/Create')),
              },
              {
                path: 'communities/:communityId',
                lazy: lazyPage(() => import('./features/communities/Detail')),
              },
              { path: 'jobs/:jobId', lazy: lazyPage(() => import('./features/jobs')) },
            ],
          },
          ...(env.appMode === 'local'
            ? [{ path: 'design-system', lazy: lazyPage(() => import('./features/design-system')) }]
            : []),
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];
