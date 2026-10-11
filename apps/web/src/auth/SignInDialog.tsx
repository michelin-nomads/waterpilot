import { useRef, useState, type FormEvent } from 'react';

import { Button } from '../components/Button/Button';
import { Dialog } from '../components/Dialog/Dialog';
import { ErrorSummary, type FieldError } from '../components/ErrorSummary/ErrorSummary';
import { Field, Input } from '../components/Field/Field';
import { Notice } from '../components/Notice/Notice';
import { env } from '../config/env';
import { useOnlineStatus } from '../lib/useOnlineStatus';
import { AuthFailure, toAuthFailure } from './authErrors';
import { useAuth } from './authContext';
import styles from './SignInDialog.module.scss';
import type { AuthMethod } from './types';

interface SignInDialogProps {
  open: boolean;
  /** Why sign-in is needed, e.g. "Finalizing creates a permanent report." */
  reason?: string;
  onClose: () => void;
}

/** Google and email/password sign-in. A current guest is upgraded, never discarded. */
export function SignInDialog({ open, reason, onClose }: SignInDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title="Sign in to WaterLens"
      description={reason ?? 'Sign in to keep your reports and take part in communities.'}
    >
      {open && <SignInBody onDone={onClose} />}
    </Dialog>
  );
}

type Mode = 'sign-in' | 'create';
type Busy = 'google' | 'email' | 'claim' | null;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_ID = 'sign-in-email';
const PASSWORD_ID = 'sign-in-password';

function validate(mode: Mode, email: string, password: string): FieldError[] {
  const errors: FieldError[] = [];
  if (!EMAIL_PATTERN.test(email.trim())) {
    errors.push({ fieldId: EMAIL_ID, message: 'Enter an email address like name@example.org.' });
  }
  if (!password) {
    errors.push({ fieldId: PASSWORD_ID, message: 'Enter your password.' });
  } else if (mode === 'create' && password.length < 6) {
    errors.push({ fieldId: PASSWORD_ID, message: 'Choose a password with at least 6 characters.' });
  }
  return errors;
}

function SignInBody({ onDone }: { onDone: () => void }) {
  const auth = useAuth();
  const online = useOnlineStatus();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([]);
  const [busy, setBusy] = useState<Busy>(null);
  const [failure, setFailure] = useState<AuthFailure | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const isGuest = auth.user?.kind === 'guest';

  const run = async (method: AuthMethod, which: Exclude<Busy, null>) => {
    if (busy) return;
    setBusy(which);
    setFailure(null);
    try {
      const result = await auth.authenticate(method);
      if (!result.pendingClaim) onDone();
    } catch (error) {
      setFailure(toAuthFailure(error));
    } finally {
      setBusy(null);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const errors = validate(mode, email, password);
    setFieldErrors(errors);
    if (errors.length > 0) return;
    void run(
      { kind: mode === 'create' ? 'email-create' : 'email-sign-in', email, password },
      'email',
    );
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setFailure(null);
    setFieldErrors([]);
    emailRef.current?.focus();
  };

  const retryClaim = async () => {
    setBusy('claim');
    setFailure(null);
    try {
      await auth.retryPendingClaim();
      onDone();
    } catch (error) {
      setFailure(toAuthFailure(error, 'claim-failed'));
    } finally {
      setBusy(null);
    }
  };

  if (auth.pendingClaim) {
    return (
      <div className={styles.body}>
        <Notice kind="info" title="Signed in — your guest plan is not moved yet">
          {failure?.kind === 'network'
            ? failure.message
            : 'We could not finish moving your current planning session to this account.'}{' '}
          Try again now; the offer to move it lasts ten minutes.
        </Notice>
        <div className={styles.actions}>
          <Button loading={busy === 'claim'} onClick={() => void retryClaim()}>
            Try again
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              auth.discardPendingClaim();
              onDone();
            }}
          >
            Continue without moving it
          </Button>
        </div>
      </div>
    );
  }

  const fieldError = (id: string) => fieldErrors.find((e) => e.fieldId === id)?.message;

  return (
    <div className={styles.body}>
      {isGuest && (
        <p className={styles.note}>
          Your current planning session comes with you. If the account you sign in to already has a
          session in progress, that session is closed and replaced by this one.
        </p>
      )}
      {!online && <Notice kind="offline">You are offline. Sign-in needs a connection.</Notice>}
      {failure && (
        <FailureNotice
          failure={failure}
          onRetryGoogle={() => void run({ kind: 'google' }, 'google')}
          onSwitch={switchMode}
          onUseEmail={() => emailRef.current?.focus()}
        />
      )}

      <Button
        variant="secondary"
        fullWidth
        loading={busy === 'google'}
        aria-disabled={!online || (busy !== null && busy !== 'google') || undefined}
        onClick={() => void run({ kind: 'google' }, 'google')}
      >
        Continue with Google
      </Button>

      <p className={styles.divider}>
        <span>or use email</span>
      </p>

      <form className={styles.form} noValidate onSubmit={onSubmit}>
        <ErrorSummary errors={fieldErrors} />
        <Field id={EMAIL_ID} label="Email" required error={fieldError(EMAIL_ID)}>
          {(control) => (
            <Input
              {...control}
              ref={emailRef}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          )}
        </Field>
        <Field
          id={PASSWORD_ID}
          label="Password"
          required
          hint={mode === 'create' ? 'At least 6 characters.' : undefined}
          error={fieldError(PASSWORD_ID)}
        >
          {(control) => (
            <Input
              {...control}
              type="password"
              autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          )}
        </Field>
        <Button
          type="submit"
          fullWidth
          loading={busy === 'email'}
          aria-disabled={!online || (busy !== null && busy !== 'email') || undefined}
        >
          {mode === 'create' ? 'Create account' : 'Sign in'}
        </Button>
      </form>

      <p className={styles.switch}>
        {mode === 'sign-in' ? 'New to WaterLens? ' : 'Already have an account? '}
        <button
          type="button"
          className={styles.link}
          onClick={() => switchMode(mode === 'sign-in' ? 'create' : 'sign-in')}
        >
          {mode === 'sign-in' ? 'Create an account' : 'Sign in instead'}
        </button>
      </p>

      {env.appMode === 'local' && (
        <p className={styles.local}>
          Local mode: accounts live only in the Firebase Auth emulator, never a real project.
        </p>
      )}
    </div>
  );
}

interface FailureNoticeProps {
  failure: AuthFailure;
  onRetryGoogle: () => void;
  onSwitch: (mode: Mode) => void;
  onUseEmail: () => void;
}

function FailureNotice({ failure, onRetryGoogle, onSwitch, onUseEmail }: FailureNoticeProps) {
  switch (failure.kind) {
    case 'cancelled':
      return (
        <Notice
          kind="auth-cancelled"
          title="Sign-in was cancelled"
          action={
            <Button size="sm" variant="secondary" onClick={onRetryGoogle}>
              Try again
            </Button>
          }
        >
          Nothing was changed and your session is as it was.
        </Notice>
      );
    case 'popup-blocked':
      return (
        <Notice
          kind="info"
          action={
            <Button size="sm" variant="secondary" onClick={onUseEmail}>
              Use email instead
            </Button>
          }
        >
          {failure.message}
        </Notice>
      );
    case 'email-in-use':
    case 'different-provider':
      return (
        <Notice
          kind="info"
          action={
            <Button size="sm" variant="secondary" onClick={() => onSwitch('sign-in')}>
              Sign in with email
            </Button>
          }
        >
          {failure.message}
        </Notice>
      );
    default:
      return (
        <div role="alert" className={styles.error}>
          {failure.message}
        </div>
      );
  }
}
