import { Navigate, Outlet } from 'react-router-dom';

import { useAuth } from '../auth/authContext';
import { LoadingRegion, Skeleton } from '../components/Skeleton/Skeleton';

/**
 * Route guard for the signed-in workspace (reports, communities, projects, funding).
 * Without a signed-in account these screens do not exist: people planning as a guest can
 * reach the planner only, and are sent back to the start.
 */
export function RequireAccount() {
  const auth = useAuth();

  if (auth.status === 'loading') {
    return (
      <LoadingRegion label="Checking your account">
        <Skeleton shape="block" />
      </LoadingRegion>
    );
  }
  if (auth.user?.kind !== 'permanent') return <Navigate to="/" replace />;
  return <Outlet />;
}
