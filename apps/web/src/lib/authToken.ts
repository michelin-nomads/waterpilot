/**
 * Returns the current Firebase ID token, or null when signed out. The SDK caches and
 * refreshes tokens itself; `forceRefresh` asks for a new one after a rejection.
 */
export type AuthTokenProvider = (options?: { forceRefresh?: boolean }) => Promise<string | null>;

let tokenProvider: AuthTokenProvider = async () => null;

/**
 * Register the ID-token source (the AuthProvider). The backend derives the caller's
 * identity only from this verified token; requests never carry a user id, and tokens
 * are never stored by the app (Firebase persistence keeps the session). Kept apart from
 * the Axios client so the auth shell does not pull the HTTP stack into the entry chunk.
 */
export function setAuthTokenProvider(provider: AuthTokenProvider): void {
  tokenProvider = provider;
}

export function getAuthToken(options?: { forceRefresh?: boolean }): Promise<string | null> {
  return tokenProvider(options);
}
