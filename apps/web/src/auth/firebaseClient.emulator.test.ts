// Real Firebase JS SDK against the Auth emulator (demo-waterpilot). Run with
// `npm run test:emulator` from the repo root; skipped when the emulator is not running
// unless WP_REQUIRE_AUTH_EMULATOR=1.
import { GoogleAuthProvider } from 'firebase/auth';

import type { FirebaseWebConfig } from '../config/env';
import { AuthFailure } from './authErrors';
import { createFirebaseAuthBackend } from './firebaseClient';

// Vitest exposes the process environment on import.meta.env.
const HOST = String(import.meta.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099');
const PROJECT = 'demo-waterpilot';
const REQUIRED = import.meta.env.WP_REQUIRE_AUTH_EMULATOR === '1';

const config: FirebaseWebConfig = {
  apiKey: 'demo-api-key',
  authDomain: `${PROJECT}.firebaseapp.com`,
  projectId: PROJECT,
  appId: null,
  authEmulatorHost: HOST,
};

async function emulatorUp(): Promise<boolean> {
  try {
    const response = await fetch(`http://${HOST}/emulator/v1/projects/${PROJECT}/config`);
    return response.ok;
  } catch {
    return false;
  }
}

const available = await emulatorUp();
if (!available && REQUIRED) {
  throw new Error(`Auth emulator not reachable at ${HOST} (WP_REQUIRE_AUTH_EMULATOR=1)`);
}

function claims(token: string): Record<string, unknown> {
  const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(payload)) as Record<string, unknown>;
}

function googleCredential(sub: string, email: string) {
  return GoogleAuthProvider.credential(JSON.stringify({ sub, email, email_verified: true }));
}

let appCounter = 0;
const backend = () =>
  createFirebaseAuthBackend(config, {
    appName: `emulator-test-${appCounter++}`,
    persistence: 'memory',
  });

describe.skipIf(!available)('Firebase Auth client against the emulator', () => {
  beforeEach(async () => {
    await fetch(`http://${HOST}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
  });

  it('creates an anonymous guest account with a verifiable guest token', async () => {
    const auth = backend();
    const user = await auth.signInAsGuest();
    expect(user.kind).toBe('guest');
    const token = (await auth.getIdToken(false)) as string;
    expect(claims(token)).toMatchObject({
      user_id: user.uid,
      aud: PROJECT,
      firebase: { sign_in_provider: 'anonymous' },
    });
  });

  it('links a new email to the guest, keeping the uid and switching the token provider', async () => {
    const auth = backend();
    const guest = await auth.signInAsGuest();
    const linked = await auth.link({
      kind: 'email-create',
      email: 'new@example.org',
      password: 'secret-pass',
    });
    expect(linked).toMatchObject({ uid: guest.uid, kind: 'permanent', email: 'new@example.org' });
    const token = (await auth.getIdToken(false)) as string;
    expect(claims(token)).toMatchObject({ firebase: { sign_in_provider: 'password' } });
  });

  it('reports duplicate signup and wrong passwords as typed failures', async () => {
    const owner = backend();
    await owner.signIn({
      kind: 'email-create',
      email: 'taken@example.org',
      password: 'secret-pass',
    });

    const auth = backend();
    await auth.signInAsGuest();
    await expect(
      auth.link({ kind: 'email-create', email: 'taken@example.org', password: 'other-pass' }),
    ).rejects.toMatchObject({ kind: 'email-in-use' });
    await expect(
      auth.signIn({ kind: 'email-sign-in', email: 'taken@example.org', password: 'wrong-pass' }),
    ).rejects.toBeInstanceOf(AuthFailure);
    expect(auth.currentUser()?.kind).toBe('guest');
  });

  it('signs in to an existing Google account with a pending credential (claim sign-in step)', async () => {
    const owner = backend();
    const existing = await owner.signInWithPendingCredential(
      googleCredential('g-1', 'g@example.org'),
    );

    const auth = backend();
    const guest = await auth.signInAsGuest();
    const signedIn = await auth.signInWithPendingCredential(
      googleCredential('g-1', 'g@example.org'),
    );
    expect(signedIn).toMatchObject({ uid: existing.uid, kind: 'permanent' });
    expect(signedIn.uid).not.toBe(guest.uid);
  });

  it('refreshes tokens on demand and notifies listeners on sign-out', async () => {
    const auth = backend();
    const seen: Array<string | null> = [];
    const unsubscribe = auth.onUserChanged((user) => seen.push(user?.kind ?? null));
    await auth.signInAsGuest();
    const first = (await auth.getIdToken(false)) as string;
    const refreshed = (await auth.getIdToken(true)) as string;
    expect(claims(refreshed).user_id).toBe(claims(first).user_id);
    await auth.signOut();
    unsubscribe();
    expect(seen).toContain('guest');
    expect(seen.at(-1)).toBeNull();
    await expect(auth.getIdToken(false)).resolves.toBeNull();
  });

  it('initialises an app name once and connects the emulator once', () => {
    const name = `emulator-test-singleton-${appCounter++}`;
    const first = createFirebaseAuthBackend(config, { appName: name, persistence: 'memory' });
    expect(() =>
      createFirebaseAuthBackend(config, { appName: name, persistence: 'memory' }),
    ).not.toThrow();
    expect(first.currentUser()).toBeNull();
  });
});
