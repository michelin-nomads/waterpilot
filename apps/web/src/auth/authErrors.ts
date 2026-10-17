export type AuthFailureKind =
  | 'cancelled'
  | 'popup-blocked'
  | 'email-in-use'
  | 'credential-in-use'
  | 'different-provider'
  | 'wrong-credentials'
  | 'weak-password'
  | 'invalid-email'
  | 'network'
  | 'rate-limited'
  | 'method-disabled'
  | 'account-disabled'
  | 'session-expired'
  | 'claim-failed'
  | 'unknown';

const MESSAGES: Record<AuthFailureKind, string> = {
  cancelled: 'Sign-in was cancelled. Nothing was changed.',
  'popup-blocked':
    'Your browser blocked the sign-in window. Allow pop-ups for this site and try again, or use email instead.',
  'email-in-use': 'An account with this email already exists. Sign in to it instead.',
  'credential-in-use': 'That Google account already has a WaterPilot account.',
  'different-provider':
    'This email already signs in another way. Use email and password for this account.',
  'wrong-credentials': 'The email or password is not right. Check them and try again.',
  'weak-password': 'Choose a password with at least 6 characters.',
  'invalid-email': 'Enter an email address like name@example.org.',
  network: 'We could not reach the sign-in service. Check your connection and try again.',
  'rate-limited': 'Too many attempts right now. Wait a few minutes, then try again.',
  'method-disabled': 'This sign-in method is turned off right now. Try another method.',
  'account-disabled': 'This account has been disabled. Contact the WaterPilot team for help.',
  'session-expired': 'Your sign-in has expired. Sign in again to continue.',
  'claim-failed': 'You are signed in, but your guest plan could not be moved to your account yet.',
  unknown: 'Something went wrong while signing in. Try again.',
};

const FIREBASE_CODES: Record<string, AuthFailureKind> = {
  'auth/popup-closed-by-user': 'cancelled',
  'auth/cancelled-popup-request': 'cancelled',
  'auth/user-cancelled': 'cancelled',
  'auth/popup-blocked': 'popup-blocked',
  'auth/email-already-in-use': 'email-in-use',
  'auth/credential-already-in-use': 'credential-in-use',
  'auth/account-exists-with-different-credential': 'different-provider',
  'auth/wrong-password': 'wrong-credentials',
  'auth/user-not-found': 'wrong-credentials',
  'auth/invalid-credential': 'wrong-credentials',
  'auth/invalid-login-credentials': 'wrong-credentials',
  'auth/missing-password': 'wrong-credentials',
  'auth/weak-password': 'weak-password',
  'auth/invalid-email': 'invalid-email',
  'auth/missing-email': 'invalid-email',
  'auth/network-request-failed': 'network',
  'auth/timeout': 'network',
  'auth/too-many-requests': 'rate-limited',
  'auth/quota-exceeded': 'rate-limited',
  'auth/operation-not-allowed': 'method-disabled',
  'auth/admin-restricted-operation': 'method-disabled',
  'auth/user-disabled': 'account-disabled',
  'auth/user-token-expired': 'session-expired',
  'auth/invalid-user-token': 'session-expired',
  'auth/requires-recent-login': 'session-expired',
};

/** A sign-in failure the UI can explain. `pending` carries a conflicting credential. */
export class AuthFailure extends Error {
  readonly kind: AuthFailureKind;
  readonly pending: unknown;

  constructor(kind: AuthFailureKind, options: { message?: string; pending?: unknown } = {}) {
    super(options.message ?? MESSAGES[kind]);
    this.name = 'AuthFailure';
    this.kind = kind;
    this.pending = options.pending;
  }
}

type ErrorLike = { name?: unknown; code?: unknown; isAxiosError?: unknown; response?: unknown };

const asErrorLike = (error: unknown): ErrorLike =>
  typeof error === 'object' && error !== null ? (error as ErrorLike) : {};

// Matched structurally so this module (loaded with the app shell) does not import the
// Axios/GraphQL client stack into the entry chunk.
const SERVER_ERRORS = new Set(['GraphQLRequestError', 'MutationFailure']);

/** Map Firebase, GraphQL and transport errors to an {@link AuthFailure}. */
export function toAuthFailure(error: unknown, fallback: AuthFailureKind = 'unknown'): AuthFailure {
  if (error instanceof AuthFailure) return error;
  const { name, code, isAxiosError, response } = asErrorLike(error);
  if (typeof code === 'string' && code.startsWith('auth/')) {
    return new AuthFailure(FIREBASE_CODES[code] ?? fallback);
  }
  if (isAxiosError === true && !response) return new AuthFailure('network');
  if (typeof name === 'string' && SERVER_ERRORS.has(name)) {
    if (code === 'UNAUTHENTICATED' || code === 'REAUTHENTICATION_REQUIRED') {
      return new AuthFailure('session-expired');
    }
    if (code === 'SERVICE_UNAVAILABLE') return new AuthFailure('network');
  }
  return new AuthFailure(fallback);
}

export function authFailureMessage(kind: AuthFailureKind): string {
  return MESSAGES[kind];
}
