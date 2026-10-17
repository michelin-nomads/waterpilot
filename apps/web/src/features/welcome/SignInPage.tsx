import { Navigate, useNavigate } from 'react-router-dom';

import { useAuth } from '../../auth/authContext';
import { LoadingRegion, Skeleton } from '../../components/Skeleton/Skeleton';
import { ErrorState } from '../../components/StatePanel/StatePanel';
import { SignInScreen } from './SignInScreen';

/**
 * The sign-in screen (`/signin`). Signing in leads to the main screen; "Continue as guest"
 * goes there without an account. A guest's plan-in-progress comes along when they sign in
 * (the form upgrades the guest), so a pending transfer is finished here before leaving.
 */
export default function SignInPage() {
  const auth = useAuth();
  const navigate = useNavigate();

  if (auth.status === 'loading') {
    return (
      <LoadingRegion label="Loading WaterPilot">
        <Skeleton shape="block" />
      </LoadingRegion>
    );
  }
  if (auth.status === 'error') {
    return (
      <ErrorState title="Sign-in could not load" onRetry={auth.reload} headingLevel={2}>
        WaterPilot could not load its sign-in service, so you cannot sign in yet. Check your
        connection and try again.
      </ErrorState>
    );
  }
  if (auth.user?.kind === 'permanent' && !auth.pendingClaim) return <Navigate to="/" replace />;

  return <SignInScreen onSignedIn={() => navigate('/')} />;
}
