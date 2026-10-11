import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/authContext';
import { Badge } from '../components/Badge/Badge';
import { Button } from '../components/Button/Button';
import { Dialog } from '../components/Dialog/Dialog';
import { usePlanningSession } from '../session/sessionContext';
import styles from './AccountMenu.module.scss';

/**
 * Header account control. Guests keep a visible "Guest" label and a Sign in action that
 * upgrades them; guests are never offered sign-out, which would abandon their session.
 */
export function AccountMenu() {
  const auth = useAuth();
  const session = usePlanningSession();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [unsaved, setUnsaved] = useState(false);

  if (auth.status === 'loading') {
    return (
      <Button variant="ghost" size="sm" loading>
        Account
      </Button>
    );
  }

  if (auth.status === 'error') {
    return (
      <Button variant="ghost" size="sm" startIcon="refresh" onClick={auth.reload}>
        Retry sign-in
      </Button>
    );
  }

  const { user } = auth;
  if (user?.kind === 'permanent') {
    const signOut = async (force: boolean) => {
      setUnsaved(false);
      setSigningOut(true);
      try {
        // Nothing of this account is kept on the device after sign-out, so save first.
        if (!force && !(await session.prepareSignOut())) {
          setUnsaved(true);
          return;
        }
        await auth.signOut();
        navigate('/');
      } finally {
        setSigningOut(false);
      }
    };
    return (
      <div className={styles.account}>
        <span className={styles.who} title={user.email ?? undefined}>
          {user.displayName ?? user.email ?? 'Signed in'}
        </span>
        <Button variant="ghost" size="sm" loading={signingOut} onClick={() => void signOut(false)}>
          Sign out
        </Button>
        <Dialog
          open={unsaved}
          onClose={() => setUnsaved(false)}
          title="Some changes are not saved"
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setUnsaved(false)}>
                Stay signed in
              </Button>
              <Button variant="danger" onClick={() => void signOut(true)}>
                Sign out and discard
              </Button>
            </>
          }
        >
          <p>
            Your latest plan changes have not reached the server yet. Signing out removes them from
            this device. Stay signed in and reconnect to save them.
          </p>
        </Dialog>
      </div>
    );
  }

  return (
    <div className={styles.account}>
      {user?.kind === 'guest' && <Badge tone="neutral">Guest</Badge>}
      <Button variant="ghost" size="sm" startIcon="user" onClick={() => void auth.openSignIn()}>
        Sign in
      </Button>
    </div>
  );
}
