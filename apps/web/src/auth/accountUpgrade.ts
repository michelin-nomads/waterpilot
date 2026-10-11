import { newIdempotencyKey } from '../lib/idempotency';
import { toAuthFailure } from './authErrors';
import type { AuthBackend, AuthMethod, AuthUser } from './types';

/** Server calls for the guest → existing-account claim (docs/api/graphql.md#account-claims). */
export interface ClaimApi {
  begin(): Promise<{ claimId: string; version: number; secret: string }>;
  complete(claimId: string, secret: string, idempotencyKey: string): Promise<void>;
  cancel(claimId: string, version: number): Promise<void>;
}

/**
 * A claim whose sign-in succeeded but whose completion did not. The secret stays in
 * memory only; the claim expires on the server after ten minutes if never completed.
 */
export interface PendingClaim {
  claimId: string;
  secret: string;
  idempotencyKey: string;
}

export type UpgradeResult =
  { user: AuthUser; pendingClaim: null } | { user: AuthUser; pendingClaim: PendingClaim };

/**
 * Complete a claim, retrying transient failures with the same idempotency key so a
 * repeated request can never transfer twice.
 */
export async function completeClaim(
  api: ClaimApi,
  pending: PendingClaim,
  attempts = 3,
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await api.complete(pending.claimId, pending.secret, pending.idempotencyKey);
      return;
    } catch (error) {
      lastError = error;
      if (toAuthFailure(error).kind !== 'network') break;
    }
  }
  throw toAuthFailure(lastError, 'claim-failed');
}

/**
 * Move the guest's current session to an account that already exists. The claim is
 * opened while still signed in as the guest (proving control of the guest), then the
 * user signs in to the existing account (proving control of it), then the server
 * transfers only that session. A failed or cancelled sign-in cancels the claim.
 */
async function claimIntoExistingAccount(
  api: ClaimApi,
  signInExisting: () => Promise<AuthUser>,
): Promise<UpgradeResult> {
  const claim = await api.begin().catch((error: unknown) => {
    throw toAuthFailure(error, 'claim-failed');
  });
  let user: AuthUser;
  try {
    user = await signInExisting();
  } catch (error) {
    await api.cancel(claim.claimId, claim.version).catch(() => undefined);
    throw toAuthFailure(error);
  }
  const pending = {
    claimId: claim.claimId,
    secret: claim.secret,
    idempotencyKey: newIdempotencyKey(),
  };
  try {
    await completeClaim(api, pending);
  } catch {
    return { user, pendingClaim: pending };
  }
  return { user, pendingClaim: null };
}

/**
 * Turn the current guest into a permanent account.
 *
 * New credential: linked to the guest, so the uid (and everything it owns) is kept.
 * Credential that already has an account: a narrowly scoped server claim moves only
 * the guest's current session; accounts are never merged.
 */
export async function upgradeGuest(
  backend: AuthBackend,
  api: ClaimApi,
  method: AuthMethod,
): Promise<UpgradeResult> {
  if (method.kind === 'email-sign-in') {
    return claimIntoExistingAccount(api, () => backend.signIn(method));
  }
  try {
    return { user: await backend.link(method), pendingClaim: null };
  } catch (error) {
    const failure = toAuthFailure(error);
    if (failure.kind === 'credential-in-use' && failure.pending !== undefined) {
      return claimIntoExistingAccount(api, () =>
        backend.signInWithPendingCredential(failure.pending),
      );
    }
    throw failure;
  }
}
