import { createContext, useContext } from 'react';

import type { PendingClaim, UpgradeResult } from './accountUpgrade';
import type { AuthMethod, AuthUser } from './types';

export type AuthStatus = 'loading' | 'ready' | 'error';

export interface AuthContextValue {
  /** `loading` until the SDK chunk loads and the persisted user is restored. */
  status: AuthStatus;
  user: AuthUser | null;
  /** Retry after the auth SDK failed to load (e.g. offline on first visit). */
  reload: () => void;
  /** Continue as a guest: an anonymous Firebase account. Reuses an existing user. */
  startGuest: () => Promise<AuthUser>;
  /** Sign in; a current guest is upgraded (linked or claimed) instead of replaced. */
  authenticate: (method: AuthMethod) => Promise<UpgradeResult>;
  /** A claim whose sign-in succeeded but whose transfer still needs completing. */
  pendingClaim: PendingClaim | null;
  retryPendingClaim: () => Promise<void>;
  discardPendingClaim: () => void;
  /** Open the sign-in dialog. Resolves true once the user holds a permanent account. */
  openSignIn: (reason?: string) => Promise<boolean>;
  /** True immediately for permanent accounts; otherwise asks the user to sign in first. */
  ensurePermanent: (reason?: string) => Promise<boolean>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
