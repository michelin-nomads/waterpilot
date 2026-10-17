import { useRef, useState, type FormEvent } from 'react';

import { Button } from '../components/Button/Button';
import { Dialog } from '../components/Dialog/Dialog';
import { ErrorSummary, type FieldError } from '../components/ErrorSummary/ErrorSummary';
import { AdornedInput, Field } from '../components/Field/Field';
import { Icon } from '../components/Icon/Icon';
import { Notice } from '../components/Notice/Notice';
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
      title="Sign in to WaterPilot"
      description={reason ?? 'Sign in to keep your reports and take part in communities.'}
    >
      {open && <SignInForm onDone={onClose} />}
    </Dialog>
  );
}

type Mode = 'sign-in' | 'create';
type Busy = 'google' | 'email' | 'claim' | 'reset' | null;

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

/**
 * The sign-in form on its own: the dialog wraps it, and the first screen shows it inline.
 * `onDone` runs once the person holds a permanent account (or chose to carry on without
 * moving a guest plan).
 */
export function SignInForm({ onDone }: { onDone: () => void }) {
  const auth = useAuth();
  const online = useOnlineStatus();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [resetSentTo, setResetSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [failure, setFailure] = useState<AuthFailure | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);

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

  const forgotPassword = async () => {
    if (busy) return;
    const address = email.trim();
    if (!EMAIL_PATTERN.test(address)) {
      setFieldErrors([
        { fieldId: EMAIL_ID, message: 'Enter your email address, then ask for a reset link.' },
      ]);
      emailRef.current?.focus();
      return;
    }
    setFieldErrors([]);
    setBusy('reset');
    setFailure(null);
    try {
      await auth.sendPasswordReset(address);
      setResetSentTo(address);
    } catch (error) {
      setFailure(toAuthFailure(error));
    } finally {
      setBusy(null);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setResetSentTo(null);
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
    <div className={[styles.body, styles.compact].join(' ')}>
      {!online && <Notice kind="offline">You are offline. Sign-in needs a connection.</Notice>}
      {failure && (
        <FailureNotice
          failure={failure}
          onRetryGoogle={() => void run({ kind: 'google' }, 'google')}
          onSwitch={switchMode}
          onUseEmail={() => emailRef.current?.focus()}
        />
      )}

      {resetSentTo && (
        <Notice kind="info">
          If an account exists for {resetSentTo}, a link to reset the password is on its way.
        </Notice>
      )}

      <Button
        variant="secondary"
        fullWidth
        size="lg"
        className={styles.google}
        loading={busy === 'google'}
        aria-disabled={!online || (busy !== null && busy !== 'google') || undefined}
        onClick={() => void run({ kind: 'google' }, 'google')}
      >
        <span className={styles.googleLabel}>
          <GoogleMark />
          Continue with Google
        </span>
      </Button>

      <p className={styles.divider}>
        <span>or</span>
      </p>

      <form className={[styles.form, styles.compact].join(' ')} noValidate onSubmit={onSubmit}>
        <ErrorSummary errors={fieldErrors} />
        <Field id={EMAIL_ID} label="Email" required hideLabel error={fieldError(EMAIL_ID)}>
          {(control) => (
            <AdornedInput
              {...control}
              ref={emailRef}
              icon="mail"
              placeholder="Email address"
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
          hideLabel
          hint={mode === 'create' ? 'At least 6 characters.' : undefined}
          error={fieldError(PASSWORD_ID)}
        >
          {(control) => (
            <AdornedInput
              {...control}
              icon="lock"
              placeholder="Password"
              end={
                <button
                  type="button"
                  className={styles.reveal}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((shown) => !shown)}
                >
                  <Icon name={showPassword ? 'eye-off' : 'eye'} />
                </button>
              }
              type={showPassword ? 'text' : 'password'}
              autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          )}
        </Field>
        <Button
          type="submit"
          fullWidth
          size="lg"
          className={styles.submit}
          loading={busy === 'email'}
          aria-disabled={!online || (busy !== null && busy !== 'email') || undefined}
        >
          {mode === 'create' ? 'Create account' : 'Sign in'}
        </Button>
      </form>

      {mode === 'sign-in' && (
        <p className={styles.forgot}>
          <button type="button" className={styles.link} onClick={() => void forgotPassword()}>
            Forgot password?
          </button>
        </p>
      )}

      <p className={styles.switch}>
        {mode === 'sign-in' ? 'New to WaterPilot? ' : 'Already have an account? '}
        <button
          type="button"
          className={styles.link}
          onClick={() => switchMode(mode === 'sign-in' ? 'create' : 'sign-in')}
        >
          {mode === 'sign-in' ? 'Create an account' : 'Sign in instead'}
        </button>
      </p>
    </div>
  );
}

/** The Google "G", in its brand colours. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M23 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.4Z"
      />
      <path
        fill="#34A853"
        d="M12 23.5c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v3A11.5 11.5 0 0 0 12 23.5Z"
      />
      <path fill="#FBBC05" d="M5.6 14.2a6.9 6.9 0 0 1 0-4.4v-3H1.8a11.5 11.5 0 0 0 0 10.4l3.8-3Z" />
      <path
        fill="#EA4335"
        d="M12 5.1c1.7 0 3.2.6 4.4 1.7l3.3-3.3A11.5 11.5 0 0 0 1.8 6.8l3.8 3C6.5 7.1 9 5.1 12 5.1Z"
      />
    </svg>
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
