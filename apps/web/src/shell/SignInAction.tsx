import { useAuth } from '../auth/authContext';
import { Button, ButtonLink } from '../components/Button/Button';
import { useToast } from '../components/Toast/toastContext';

/**
 * How the header's Sign in works. On the main screen it opens the sign-in screen. Inside
 * the planner it opens a dialog instead, so the plan and the screen stay exactly as they
 * are and the person is still there when sign-in is done.
 */
export type SignInPresentation = 'page' | 'dialog';

export function SignInAction({ presentation }: { presentation: SignInPresentation }) {
  const auth = useAuth();
  const toast = useToast();

  if (presentation === 'page') {
    return (
      <ButtonLink to="/signin" variant="ghost" size="sm" startIcon="user">
        Sign in
      </ButtonLink>
    );
  }

  const openDialog = async () => {
    if (!(await auth.openSignIn())) {
      toast.show({ message: 'Sign-in was cancelled. Your plan is as you left it.' });
    }
  };
  return (
    <Button variant="ghost" size="sm" startIcon="user" onClick={() => void openDialog()}>
      Sign in
    </Button>
  );
}
