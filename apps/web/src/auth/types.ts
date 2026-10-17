/** Guests are anonymous Firebase accounts; permanent accounts use Google or email. */
export type AccountKind = 'guest' | 'permanent';

export interface AuthUser {
  uid: string;
  kind: AccountKind;
  email: string | null;
  displayName: string | null;
}

export interface EmailCredentials {
  email: string;
  password: string;
}

/** How the user chose to sign in. Phone auth is deliberately absent (paid SMS). */
export type AuthMethod =
  | { kind: 'google' }
  | ({ kind: 'email-sign-in' } & EmailCredentials)
  | ({ kind: 'email-create' } & EmailCredentials);

/** Methods that create a new credential and can therefore be linked to a guest. */
export type LinkMethod = Extract<AuthMethod, { kind: 'google' | 'email-create' }>;

/**
 * The narrow surface the app needs from Firebase Auth. The real implementation lives in
 * the lazily loaded `firebaseClient` chunk; tests substitute a fake.
 */
export interface AuthBackend {
  /** Resolves once the persisted user (if any) has been restored. */
  ready(): Promise<void>;
  currentUser(): AuthUser | null;
  /** Fires on sign-in, sign-out, linking and token refresh. Returns an unsubscribe. */
  onUserChanged(listener: (user: AuthUser | null) => void): () => void;
  getIdToken(forceRefresh: boolean): Promise<string | null>;
  signInAsGuest(): Promise<AuthUser>;
  signIn(method: AuthMethod): Promise<AuthUser>;
  /** Attach a new credential to the current guest, keeping its uid. */
  link(method: LinkMethod): Promise<AuthUser>;
  /** Sign in to the account that already owns a credential reported by a failed link. */
  signInWithPendingCredential(pending: unknown): Promise<AuthUser>;
  /** Email a password-reset link. Succeeds whether or not the address has an account. */
  sendPasswordReset(email: string): Promise<void>;
  signOut(): Promise<void>;
}
