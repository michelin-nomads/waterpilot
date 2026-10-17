import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  getAuth,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  initializeAuth,
  inMemoryPersistence,
  linkWithCredential,
  linkWithPopup,
  onIdTokenChanged,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type Auth,
  type AuthCredential,
  type Persistence,
  type User,
} from 'firebase/auth';

import { env, type FirebaseWebConfig } from '../config/env';
import { AuthFailure, toAuthFailure } from './authErrors';
import type { AuthBackend, AuthMethod, AuthUser, LinkMethod } from './types';

/**
 * The only module that imports the Firebase SDK. It is loaded lazily so the SDK stays
 * out of the entry bundle. Firebase is initialised once per app name and the Auth
 * emulator is connected once, before any other Auth call.
 */

function toAuthUser(user: User | null): AuthUser | null {
  if (!user) return null;
  return {
    uid: user.uid,
    kind: user.isAnonymous ? 'guest' : 'permanent',
    email: user.email,
    displayName: user.displayName,
  };
}

function requireUser(user: User | null): AuthUser {
  const mapped = toAuthUser(user);
  if (!mapped) throw new AuthFailure('unknown');
  return mapped;
}

function googleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

async function attempt<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    const failure = toAuthFailure(error);
    if (failure.kind === 'credential-in-use') {
      const pending = GoogleAuthProvider.credentialFromError(error as never);
      throw new AuthFailure('credential-in-use', { pending: pending ?? undefined });
    }
    throw failure;
  }
}

export interface AuthClientOptions {
  /** Distinct app names keep test instances isolated from the browser singleton. */
  appName?: string;
  /** Browser-local by default; tests use in-memory persistence. */
  persistence?: 'browser' | 'memory';
}

function initAuth(config: FirebaseWebConfig, options: AuthClientOptions): Auth {
  const name = options.appName ?? '[DEFAULT]';
  const existing = getApps().find((app) => app.name === name);
  const app: FirebaseApp =
    existing ??
    initializeApp(
      {
        apiKey: config.apiKey,
        authDomain: config.authDomain,
        projectId: config.projectId,
        ...(config.appId ? { appId: config.appId } : {}),
      },
      name,
    );
  const browser = (options.persistence ?? 'browser') === 'browser';
  const persistence: Persistence[] = browser
    ? [indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence]
    : [inMemoryPersistence];
  // Reuse the instance after a hot reload: initializeAuth may only run once per app.
  const auth = existing
    ? getAuth(app)
    : initializeAuth(app, {
        persistence,
        ...(browser ? { popupRedirectResolver: browserPopupRedirectResolver } : {}),
      });
  if (config.authEmulatorHost && !auth.emulatorConfig) {
    connectAuthEmulator(auth, `http://${config.authEmulatorHost}`);
  }
  return auth;
}

export function createFirebaseAuthBackend(
  config: FirebaseWebConfig,
  options: AuthClientOptions = {},
): AuthBackend {
  const auth = initAuth(config, options);

  async function signIn(method: AuthMethod): Promise<AuthUser> {
    const credential = await attempt(() => {
      switch (method.kind) {
        case 'google':
          return signInWithPopup(auth, googleProvider());
        case 'email-sign-in':
          return signInWithEmailAndPassword(auth, method.email, method.password);
        case 'email-create':
          return createUserWithEmailAndPassword(auth, method.email, method.password);
      }
    });
    return requireUser(credential.user);
  }

  async function link(method: LinkMethod): Promise<AuthUser> {
    const user = auth.currentUser;
    if (!user?.isAnonymous) throw new AuthFailure('unknown');
    const credential = await attempt(() =>
      method.kind === 'google'
        ? linkWithPopup(user, googleProvider())
        : linkWithCredential(user, EmailAuthProvider.credential(method.email, method.password)),
    );
    // The API reads the account kind from the token's sign-in provider, so never let a
    // cached pre-link (anonymous) token outlive the link.
    await credential.user.getIdToken(true);
    return requireUser(credential.user);
  }

  return {
    ready: () => auth.authStateReady(),
    currentUser: () => toAuthUser(auth.currentUser),
    onUserChanged: (listener) => onIdTokenChanged(auth, (user) => listener(toAuthUser(user))),
    async getIdToken(forceRefresh) {
      const user = auth.currentUser;
      if (!user) return null;
      try {
        return await user.getIdToken(forceRefresh);
      } catch (error) {
        throw toAuthFailure(error);
      }
    },
    async signInAsGuest() {
      const credential = await attempt(() => signInAnonymously(auth));
      return requireUser(credential.user);
    },
    signIn,
    link,
    async signInWithPendingCredential(pending) {
      const credential = await attempt(() => signInWithCredential(auth, pending as AuthCredential));
      return requireUser(credential.user);
    },
    async sendPasswordReset(email) {
      await attempt(() => sendPasswordResetEmail(auth, email));
    },
    signOut: () => signOut(auth),
  };
}

let browserBackend: AuthBackend | undefined;

/** The browser's single Auth backend, created on first use. */
export function getFirebaseAuthBackend(): AuthBackend {
  browserBackend ??= createFirebaseAuthBackend(env.firebase);
  return browserBackend;
}
