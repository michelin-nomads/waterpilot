import { useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/authContext';
import { Badge } from '../components/Badge/Badge';
import { Button } from '../components/Button/Button';
import { Dialog } from '../components/Dialog/Dialog';
import { Icon } from '../components/Icon/Icon';
import { useToast } from '../components/Toast/toastContext';
import { useDismissable } from '../lib/useDismissable';
import { usePlanningSession } from '../session/sessionContext';
import styles from './AccountMenu.module.scss';

/** "Ravi Kumar" becomes RK; with no name, the first two letters of the email. */
function initialsFor(name: string | null, email: string | null): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length > 0) {
    return (
      words.length === 1 ? words[0]!.slice(0, 2) : words[0]![0]! + words.at(-1)![0]!
    ).toUpperCase();
  }
  return (email ?? '?').slice(0, 2).toUpperCase();
}

interface AccountMenuProps {
  /** Guests are offered Sign in outside the planner only; inside it, at the Review step. */
  guestSignIn?: boolean;
}

/**
 * Header account control. A signed-in person gets an avatar with their name, email and
 * Sign out. A guest keeps a visible "Guest" label (and, outside the planner, a Sign in
 * action that upgrades them); guests are never offered sign-out, which would abandon their
 * session. With no account the first screen is the sign-in, so the header shows nothing.
 */
export function AccountMenu({ guestSignIn = true }: AccountMenuProps) {
  const auth = useAuth();
  const toast = useToast();
  const session = usePlanningSession();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [confirmingPlanLoss, setConfirmingPlanLoss] = useState(false);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useDismissable(open, rootRef, (reason) => {
    setOpen(false);
    if (reason === 'escape') triggerRef.current?.focus();
  });

  const signIn = async () => {
    if (!(await auth.openSignIn())) {
      toast.show({ message: 'Sign-in was cancelled. You can still start planning as a guest.' });
    }
  };

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
    const signOut = async () => {
      setConfirmingPlanLoss(false);
      setOpen(false);
      setSigningOut(true);
      try {
        // Plans are not kept as drafts, and nothing of this account stays on the device.
        session.coordinator?.discard();
        await auth.signOut();
        navigate('/');
      } finally {
        setSigningOut(false);
      }
    };
    // Signing out ends a plan in progress, so ask first; with no plan there is nothing to lose.
    const requestSignOut = () => {
      setOpen(false);
      if (session.state.status === 'ready') setConfirmingPlanLoss(true);
      else void signOut();
    };
    const name = user.displayName ?? user.email ?? 'Signed in';
    return (
      <div className={styles.account} ref={rootRef}>
        <button
          ref={triggerRef}
          type="button"
          className={styles.avatarButton}
          aria-label={`Account menu for ${name}`}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
        >
          <span className={styles.avatar} aria-hidden="true">
            {initialsFor(user.displayName, user.email)}
          </span>
          <Icon name="chevron-down" size="sm" />
        </button>
        <div id={panelId} className={styles.panel} hidden={!open}>
          <p className={styles.who}>{name}</p>
          {user.displayName && user.email && <p className={styles.email}>{user.email}</p>}
          <Button variant="ghost" size="sm" fullWidth loading={signingOut} onClick={requestSignOut}>
            Sign out
          </Button>
        </div>
        <Dialog
          open={confirmingPlanLoss}
          onClose={() => setConfirmingPlanLoss(false)}
          title="Sign out and lose your plan?"
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmingPlanLoss(false)}>
                Stay signed in
              </Button>
              <Button variant="danger" onClick={() => void signOut()}>
                Sign out and lose plan
              </Button>
            </>
          }
        >
          <p>
            Your plan will be lost. WaterPilot does not keep unfinished plans. Finalized reports are
            not affected.
          </p>
        </Dialog>
      </div>
    );
  }

  if (user?.kind === 'guest') {
    return (
      <div className={styles.account}>
        <Badge tone="neutral">Guest</Badge>
        {guestSignIn && (
          <Button variant="ghost" size="sm" startIcon="user" onClick={() => void signIn()}>
            Sign in
          </Button>
        )}
      </div>
    );
  }

  return null;
}
