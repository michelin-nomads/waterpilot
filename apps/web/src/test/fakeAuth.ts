import type { ClaimApi } from '../auth/accountUpgrade';
import { AuthFailure } from '../auth/authErrors';
import type { AuthBackend, AuthMethod, AuthUser, LinkMethod } from '../auth/types';

type Step =
  'signInAsGuest' | 'signIn' | 'link' | 'signInWithPendingCredential' | 'sendPasswordReset';

/** In-memory stand-in for the Firebase backend, with scriptable failures. */
export class FakeAuthBackend implements AuthBackend {
  user: AuthUser | null;
  /** Existing permanent accounts by email (or "google" for the Google identity). */
  existing = new Map<string, AuthUser>();
  failures = new Map<Step, AuthFailure>();
  calls: string[] = [];
  private listeners = new Set<(user: AuthUser | null) => void>();
  private nextUid = 1;

  constructor(user: AuthUser | null = null) {
    this.user = user;
  }

  private set(user: AuthUser | null): AuthUser | null {
    this.user = user;
    this.listeners.forEach((listener) => listener(user));
    return user;
  }

  private fail(step: Step): void {
    const failure = this.failures.get(step);
    if (failure) {
      this.failures.delete(step);
      throw failure;
    }
  }

  private key(method: AuthMethod): string {
    return method.kind === 'google' ? 'google' : method.email;
  }

  ready = async () => {};
  currentUser = () => this.user;
  onUserChanged = (listener: (user: AuthUser | null) => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getIdToken = async () => (this.user ? `token-${this.user.uid}` : null);

  signInAsGuest = async () => {
    this.calls.push('signInAsGuest');
    this.fail('signInAsGuest');
    return this.set(guest(`guest-${this.nextUid++}`)) as AuthUser;
  };

  signIn = async (method: AuthMethod) => {
    this.calls.push(`signIn:${method.kind}`);
    this.fail('signIn');
    const found = this.existing.get(this.key(method));
    if (method.kind === 'email-create') {
      if (found) throw new AuthFailure('email-in-use');
      return this.set(permanent(`user-${this.nextUid++}`, method.email)) as AuthUser;
    }
    if (!found) throw new AuthFailure('wrong-credentials');
    return this.set(found) as AuthUser;
  };

  link = async (method: LinkMethod) => {
    this.calls.push(`link:${method.kind}`);
    this.fail('link');
    const found = this.existing.get(this.key(method));
    if (found && method.kind === 'google') {
      throw new AuthFailure('credential-in-use', { pending: { for: 'google' } });
    }
    if (found) throw new AuthFailure('email-in-use');
    const current = this.user as AuthUser;
    const email = method.kind === 'google' ? 'g@example.org' : method.email;
    return this.set({ ...current, kind: 'permanent', email }) as AuthUser;
  };

  signInWithPendingCredential = async () => {
    this.calls.push('signInWithPendingCredential');
    this.fail('signInWithPendingCredential');
    return this.set(this.existing.get('google') ?? null) as AuthUser;
  };

  sendPasswordReset = async (email: string) => {
    this.calls.push(`sendPasswordReset:${email}`);
    this.fail('sendPasswordReset');
  };

  signOut = async () => {
    this.calls.push('signOut');
    this.set(null);
  };
}

export function guest(uid = 'guest-1'): AuthUser {
  return { uid, kind: 'guest', email: null, displayName: null };
}

export function permanent(uid = 'user-1', email = 'ana@example.org'): AuthUser {
  return { uid, kind: 'permanent', email, displayName: null };
}

/** Records claim calls; `completeFailures` scripts transient completion failures. */
export class FakeClaimApi implements ClaimApi {
  calls: string[] = [];
  completeFailures: unknown[] = [];
  completedKeys: string[] = [];

  begin = async () => {
    this.calls.push('begin');
    return { claimId: 'clm_1', version: 1, secret: 'secret-1' };
  };
  complete = async (claimId: string, _secret: string, key: string) => {
    this.calls.push(`complete:${claimId}`);
    const failure = this.completeFailures.shift();
    if (failure) throw failure;
    this.completedKeys.push(key);
  };
  cancel = async (claimId: string, version: number) => {
    this.calls.push(`cancel:${claimId}:${version}`);
  };
}
