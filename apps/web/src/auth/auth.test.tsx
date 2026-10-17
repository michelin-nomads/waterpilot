import { QueryClient } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { AxiosError } from 'axios';
import type { ReactNode } from 'react';

import { FINALIZE_SIGN_IN_REASON, useFinalizeReport } from '../features/reports/useFinalizeReport';
import { GraphQLRequestError, graphqlRequest, MutationFailure } from '../graphql/client';
import { CreatePlanningSessionDocument, ViewerDocument } from '../graphql/generated/graphql';
import { apiClient, getAuthToken, setAuthTokenProvider } from '../lib/apiClient';
import { AuthTestProviders } from '../test/AuthTestProviders';
import { FakeAuthBackend, FakeClaimApi, guest, permanent } from '../test/fakeAuth';
import { upgradeGuest } from './accountUpgrade';
import { AuthFailure, toAuthFailure } from './authErrors';
import { useAuth, type AuthContextValue } from './authContext';

const EMAIL = { email: 'ana@example.org', password: 'secret-pass' };

function networkError(): AxiosError {
  return new AxiosError('Network Error', 'ERR_NETWORK');
}

describe('toAuthFailure', () => {
  it.each([
    ['auth/popup-closed-by-user', 'cancelled'],
    ['auth/cancelled-popup-request', 'cancelled'],
    ['auth/popup-blocked', 'popup-blocked'],
    ['auth/email-already-in-use', 'email-in-use'],
    ['auth/credential-already-in-use', 'credential-in-use'],
    ['auth/account-exists-with-different-credential', 'different-provider'],
    ['auth/invalid-credential', 'wrong-credentials'],
    ['auth/network-request-failed', 'network'],
    ['auth/user-token-expired', 'session-expired'],
    ['auth/too-many-requests', 'rate-limited'],
    ['auth/admin-restricted-operation', 'method-disabled'],
  ])('maps %s to %s', (code, kind) => {
    expect(toAuthFailure({ code }).kind).toBe(kind);
  });

  it('maps transport and server errors', () => {
    expect(toAuthFailure(networkError()).kind).toBe('network');
    expect(toAuthFailure(new GraphQLRequestError('UNAUTHENTICATED', 'x', null)).kind).toBe(
      'session-expired',
    );
    expect(
      toAuthFailure(
        new MutationFailure({
          code: 'REAUTHENTICATION_REQUIRED',
          message: 'x',
          fieldErrors: [],
          currentVersion: null,
          requestId: 'req_1',
        }),
      ).kind,
    ).toBe('session-expired');
    expect(toAuthFailure(new Error('boom'), 'claim-failed').kind).toBe('claim-failed');
  });
});

describe('upgradeGuest', () => {
  it('links a new email to the guest, keeping the uid and opening no claim', async () => {
    const backend = new FakeAuthBackend(guest('g1'));
    const claims = new FakeClaimApi();
    const result = await upgradeGuest(backend, claims, { kind: 'email-create', ...EMAIL });
    expect(result).toEqual({
      user: { ...guest('g1'), kind: 'permanent', email: EMAIL.email },
      pendingClaim: null,
    });
    expect(claims.calls).toEqual([]);
  });

  it('links a new Google identity to the guest', async () => {
    const backend = new FakeAuthBackend(guest('g1'));
    const result = await upgradeGuest(backend, new FakeClaimApi(), { kind: 'google' });
    expect(result.user.uid).toBe('g1');
    expect(backend.calls).toEqual(['link:google']);
  });

  it('reports a duplicate email signup without opening a claim', async () => {
    const backend = new FakeAuthBackend(guest());
    backend.existing.set(EMAIL.email, permanent('u9', EMAIL.email));
    const claims = new FakeClaimApi();
    await expect(
      upgradeGuest(backend, claims, { kind: 'email-create', ...EMAIL }),
    ).rejects.toMatchObject({ kind: 'email-in-use' });
    expect(claims.calls).toEqual([]);
  });

  it('claims into an existing Google account: begin as guest, sign in, then complete', async () => {
    const backend = new FakeAuthBackend(guest('g1'));
    backend.existing.set('google', permanent('u9', 'g@example.org'));
    const claims = new FakeClaimApi();
    const order: string[] = [];
    const begin = claims.begin;
    claims.begin = async () => {
      order.push(`begin as ${backend.user?.uid}`);
      return begin();
    };
    const complete = claims.complete;
    claims.complete = async (...args) => {
      order.push(`complete as ${backend.user?.uid}`);
      return complete(...args);
    };

    const result = await upgradeGuest(backend, claims, { kind: 'google' });
    expect(result).toEqual({ user: permanent('u9', 'g@example.org'), pendingClaim: null });
    expect(order).toEqual(['begin as g1', 'complete as u9']);
    expect(backend.calls).toEqual(['link:google', 'signInWithPendingCredential']);
  });

  it('claims into an existing email account', async () => {
    const backend = new FakeAuthBackend(guest('g1'));
    backend.existing.set(EMAIL.email, permanent('u9', EMAIL.email));
    const claims = new FakeClaimApi();
    const result = await upgradeGuest(backend, claims, { kind: 'email-sign-in', ...EMAIL });
    expect(result.user.uid).toBe('u9');
    expect(claims.calls).toEqual(['begin', 'complete:clm_1']);
  });

  it('cancels the claim when signing in to the existing account fails or is cancelled', async () => {
    const backend = new FakeAuthBackend(guest('g1'));
    backend.existing.set('google', permanent('u9'));
    backend.failures.set('signInWithPendingCredential', new AuthFailure('cancelled'));
    const claims = new FakeClaimApi();
    await expect(upgradeGuest(backend, claims, { kind: 'google' })).rejects.toMatchObject({
      kind: 'cancelled',
    });
    expect(claims.calls).toEqual(['begin', 'cancel:clm_1:1']);
    expect(backend.user?.uid).toBe('g1');
  });

  it('retries a failed completion with the same idempotency key', async () => {
    const backend = new FakeAuthBackend(guest());
    backend.existing.set(EMAIL.email, permanent('u9', EMAIL.email));
    const claims = new FakeClaimApi();
    claims.completeFailures = [networkError(), networkError()];
    const keys: string[] = [];
    const complete = claims.complete;
    claims.complete = async (id, secret, key) => {
      keys.push(key);
      return complete(id, secret, key);
    };
    const result = await upgradeGuest(backend, claims, { kind: 'email-sign-in', ...EMAIL });
    expect(result.pendingClaim).toBeNull();
    expect(keys).toHaveLength(3);
    expect(new Set(keys).size).toBe(1);
  });

  it('returns a pending claim when completion keeps failing, keeping the sign-in', async () => {
    const backend = new FakeAuthBackend(guest());
    backend.existing.set(EMAIL.email, permanent('u9', EMAIL.email));
    const claims = new FakeClaimApi();
    claims.completeFailures = [networkError(), networkError(), networkError()];
    const result = await upgradeGuest(backend, claims, { kind: 'email-sign-in', ...EMAIL });
    expect(result.user.uid).toBe('u9');
    expect(result.pendingClaim).toMatchObject({ claimId: 'clm_1', secret: 'secret-1' });
  });
});

function renderAuth(
  backend: FakeAuthBackend,
  claims = new FakeClaimApi(),
  queryClient?: QueryClient,
) {
  let auth: AuthContextValue | undefined;
  function Probe() {
    auth = useAuth();
    return <p>status: {auth.status}</p>;
  }
  render(
    <AuthTestProviders backend={backend} claimApi={claims} queryClient={queryClient}>
      <Probe />
    </AuthTestProviders>,
  );
  return {
    get auth(): AuthContextValue {
      if (!auth) throw new Error('not rendered');
      return auth;
    },
  };
}

describe('AuthProvider', () => {
  it('restores the persisted user and supplies its ID token to API requests', async () => {
    renderAuth(new FakeAuthBackend(guest('g1')));
    await screen.findByText('status: ready');
    await expect(getAuthToken()).resolves.toBe('token-g1');
  });

  it('ensurePermanent resolves at once for a permanent account', async () => {
    const view = renderAuth(new FakeAuthBackend(permanent()));
    await screen.findByText('status: ready');
    await expect(view.auth.ensurePermanent()).resolves.toBe(true);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('asks a guest to sign in and resolves false when the dialog is closed', async () => {
    const view = renderAuth(new FakeAuthBackend(guest()));
    await screen.findByText('status: ready');
    let result: boolean | undefined;
    act(() => void view.auth.ensurePermanent('Needed for this.').then((r) => (result = r)));
    const dialog = await screen.findByRole('dialog', { name: 'Sign in to WaterPilot' });
    expect(dialog).toHaveTextContent('Needed for this.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(result).toBe(false));
  });

  it('clears cached data when the identity changes', async () => {
    const backend = new FakeAuthBackend(guest('g1'));
    backend.existing.set(EMAIL.email, permanent('u9', EMAIL.email));
    const client = new QueryClient();
    const view = renderAuth(backend, new FakeClaimApi(), client);
    await screen.findByText('status: ready');
    client.setQueryData(['session', 'current'], { id: 'ses_guest' });
    await act(() => view.auth.authenticate({ kind: 'email-sign-in', ...EMAIL }));
    await waitFor(() => expect(client.getQueryData(['session', 'current'])).toBeUndefined());
  });

  it('shows a retry when the auth SDK cannot load', async () => {
    let fail = true;
    const backend = new FakeAuthBackend();
    function Probe() {
      const auth = useAuth();
      return (
        <button type="button" onClick={auth.reload}>
          {auth.status}
        </button>
      );
    }
    const { AuthProvider } = await import('./AuthProvider');
    const load = async () => {
      if (fail) throw new Error('chunk failed');
      return backend;
    };
    render(
      <AuthTestProviders backend={backend}>
        <AuthProvider loadBackend={load}>
          <Probe />
        </AuthProvider>
      </AuthTestProviders>,
    );
    const button = await screen.findByRole('button', { name: 'error' });
    fail = false;
    fireEvent.click(button);
    expect(await screen.findByRole('button', { name: 'ready' })).toBeInTheDocument();
  });
});

describe('SignInDialog', () => {
  async function openDialog(backend: FakeAuthBackend, claims = new FakeClaimApi()) {
    const view = renderAuth(backend, claims);
    await screen.findByText('status: ready');
    let result: boolean | undefined;
    act(() => void view.auth.openSignIn().then((r) => (result = r)));
    const dialog = await screen.findByRole('dialog', { name: 'Sign in to WaterPilot' });
    return { dialog, result: () => result, view };
  }

  it('reports a cancelled Google popup and lets the user try again', async () => {
    const backend = new FakeAuthBackend(guest('g1'));
    backend.failures.set('link', new AuthFailure('cancelled'));
    const { dialog, result } = await openDialog(backend);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continue with Google' }));
    expect(await within(dialog).findByText('Sign-in was cancelled')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(result()).toBe(true));
    expect(backend.user).toMatchObject({ uid: 'g1', kind: 'permanent' });
  });

  it('explains a blocked popup and offers email instead', async () => {
    const backend = new FakeAuthBackend();
    backend.failures.set('signIn', new AuthFailure('popup-blocked'));
    const { dialog } = await openDialog(backend);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continue with Google' }));
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Use email instead' }));
    expect(within(dialog).getByLabelText(/^Email/)).toHaveFocus();
  });

  it('validates the email form before contacting the service', async () => {
    const backend = new FakeAuthBackend();
    const { dialog } = await openDialog(backend);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sign in' }));
    expect(await within(dialog).findByText('Check these fields')).toBeInTheDocument();
    expect(backend.calls).toEqual([]);
  });

  it('asks for an email before sending a password-reset link, then sends it', async () => {
    const backend = new FakeAuthBackend();
    const { dialog } = await openDialog(backend);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Forgot password?' }));
    expect(await within(dialog).findAllByText(/Enter your email address/)).not.toHaveLength(0);
    expect(backend.calls).toEqual([]);
    fireEvent.change(within(dialog).getByLabelText(/^Email/), { target: { value: EMAIL.email } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Forgot password?' }));
    expect(await within(dialog).findByText(/link to reset the password/)).toBeInTheDocument();
    expect(backend.calls).toEqual([`sendPasswordReset:${EMAIL.email}`]);
  });

  it('shows and hides the password on request', async () => {
    const { dialog } = await openDialog(new FakeAuthBackend());
    const field = within(dialog).getByLabelText(/^Password/);
    expect(field).toHaveAttribute('type', 'password');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Show password' }));
    expect(field).toHaveAttribute('type', 'text');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hide password' }));
    expect(field).toHaveAttribute('type', 'password');
  });

  it('turns a duplicate signup into a sign-in suggestion', async () => {
    const backend = new FakeAuthBackend(guest());
    backend.existing.set(EMAIL.email, permanent('u9', EMAIL.email));
    const { dialog } = await openDialog(backend);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create an account' }));
    fireEvent.change(within(dialog).getByLabelText(/^Email/), { target: { value: EMAIL.email } });
    fireEvent.change(within(dialog).getByLabelText(/^Password/), {
      target: { value: EMAIL.password },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create account' }));
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Sign in with email' }));
    expect(within(dialog).getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('keeps the sign-in and offers a retry when moving the guest plan fails', async () => {
    const backend = new FakeAuthBackend(guest());
    backend.existing.set(EMAIL.email, permanent('u9', EMAIL.email));
    const claims = new FakeClaimApi();
    claims.completeFailures = [networkError(), networkError(), networkError()];
    const { dialog, result } = await openDialog(backend, claims);
    fireEvent.change(within(dialog).getByLabelText(/^Email/), { target: { value: EMAIL.email } });
    fireEvent.change(within(dialog).getByLabelText(/^Password/), {
      target: { value: EMAIL.password },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sign in' }));
    expect(await within(dialog).findByText(/guest plan is not moved yet/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(result()).toBe(true));
    expect(claims.completedKeys).toHaveLength(1);
  });
});

describe('useFinalizeReport', () => {
  const report = {
    __typename: 'Report',
    id: 'rep_1',
    version: 1,
    title: 'Plan',
    status: 'FINALIZED',
  };

  function finalizeResponse() {
    return { data: { data: { finalizeReport: { report, error: null } } } };
  }

  function wrapper(backend: FakeAuthBackend) {
    return ({ children }: { children: ReactNode }) => (
      <AuthTestProviders backend={backend}>{children}</AuthTestProviders>
    );
  }

  afterEach(() => vi.restoreAllMocks());

  it('sends nothing when a guest cancels sign-in', async () => {
    const post = vi.spyOn(apiClient, 'post');
    const backend = new FakeAuthBackend(guest());
    const { result } = renderHook(() => useFinalizeReport(), { wrapper: wrapper(backend) });
    await waitFor(() => expect(getAuthToken()).resolves.toBe('token-guest-1'));
    let outcome: unknown;
    act(
      () =>
        void result.current
          .finalize({ sessionId: 'ses_1', title: 'Plan' })
          .then((o) => (outcome = o)),
    );
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(FINALIZE_SIGN_IN_REASON);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(outcome).toEqual({ status: 'cancelled' }));
    expect(post).not.toHaveBeenCalled();
  });

  it('links first, then finalizes as the permanent account', async () => {
    const backend = new FakeAuthBackend(guest('g1'));
    const tokens: Array<string | null> = [];
    vi.spyOn(apiClient, 'post').mockImplementation(async () => {
      tokens.push(await getAuthToken());
      return finalizeResponse();
    });
    const { result } = renderHook(() => useFinalizeReport(), { wrapper: wrapper(backend) });
    let outcome: unknown;
    await waitFor(() => expect(getAuthToken()).resolves.toBe('token-g1'));
    act(
      () =>
        void result.current
          .finalize({ sessionId: 'ses_1', title: 'Plan' })
          .then((o) => (outcome = o)),
    );
    const dialog = await screen.findByRole('dialog');
    expect(tokens).toEqual([]);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create an account' }));
    fireEvent.change(within(dialog).getByLabelText(/^Email/), { target: { value: EMAIL.email } });
    fireEvent.change(within(dialog).getByLabelText(/^Password/), {
      target: { value: EMAIL.password },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(outcome).toEqual({ status: 'finalized', report }));
    expect(backend.calls).toEqual(['link:email-create']);
    expect(backend.user?.kind).toBe('permanent');
    expect(tokens).toEqual(['token-g1']);
  });

  it('retries with the same idempotency key and ignores a second click while running', async () => {
    const backend = new FakeAuthBackend(permanent());
    const keys: string[] = [];
    let calls = 0;
    vi.spyOn(apiClient, 'post').mockImplementation(async (_url, body) => {
      keys.push(
        (body as { variables: { input: { idempotencyKey: string } } }).variables.input
          .idempotencyKey,
      );
      calls += 1;
      if (calls === 1) throw networkError();
      return finalizeResponse();
    });
    const { result } = renderHook(() => useFinalizeReport(), { wrapper: wrapper(backend) });
    await waitFor(() => expect(getAuthToken()).resolves.toBe('token-user-1'));
    await act(async () => {
      await expect(
        result.current.finalize({ sessionId: 'ses_1', title: 'Plan' }),
      ).rejects.toThrow();
    });
    let outcomes: unknown[] = [];
    await act(async () => {
      outcomes = await Promise.all([
        result.current.finalize({ sessionId: 'ses_1', title: 'Plan' }),
        result.current.finalize({ sessionId: 'ses_1', title: 'Plan' }),
      ]);
    });
    expect(outcomes).toEqual([{ status: 'finalized', report }, { status: 'busy' }]);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });
});

describe('graphqlRequest token refresh', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    setAuthTokenProvider(async () => null);
  });

  const unauthenticated = {
    data: { data: null, errors: [{ message: 'sign in', extensions: { code: 'UNAUTHENTICATED' } }] },
  };

  it('retries once with a force-refreshed token after the server rejects the token', async () => {
    const provider = vi.fn(async (options?: { forceRefresh?: boolean }) =>
      options?.forceRefresh ? 'fresh' : 'stale',
    );
    setAuthTokenProvider(provider);
    const post = vi
      .spyOn(apiClient, 'post')
      .mockResolvedValueOnce(unauthenticated)
      .mockResolvedValueOnce({ data: { data: { viewer: null } } });
    await expect(graphqlRequest(ViewerDocument, {})).resolves.toEqual({ viewer: null });
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[1][2]?.headers).toEqual({ Authorization: 'Bearer fresh' });
    expect(provider).toHaveBeenCalledWith({ forceRefresh: true });
  });

  it('does not retry when there is no signed-in user', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue(unauthenticated);
    await expect(graphqlRequest(ViewerDocument, {})).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
    expect(post).toHaveBeenCalledTimes(1);
  });

  const mutationError = (code: string) => ({
    data: {
      data: {
        createPlanningSession: {
          session: null,
          error: { code, message: code, fieldErrors: [], currentVersion: null, requestId: 'r' },
        },
      },
    },
  });
  const created = {
    data: { data: { createPlanningSession: { session: { id: 'ses_1' }, error: null } } },
  };
  const createSession = () =>
    graphqlRequest(CreatePlanningSessionDocument, {
      input: { mode: 'AGENT', idempotencyKey: 'key-0000000000000001' },
    });
  const sentKeys = (post: { mock: { calls: unknown[][] } }) =>
    post.mock.calls.map(
      (call) => (call[1] as { variables: { input: { idempotencyKey: string } } }).variables.input,
    );

  it('resends a rejected mutation once with the same idempotency key', async () => {
    setAuthTokenProvider(async (options) => (options?.forceRefresh ? 'fresh' : 'stale'));
    const post = vi
      .spyOn(apiClient, 'post')
      .mockResolvedValueOnce(mutationError('UNAUTHENTICATED'))
      .mockResolvedValueOnce(created);
    await createSession();
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[1][1]).toEqual(post.mock.calls[0][1]);
    expect(sentKeys(post).map((input) => input.idempotencyKey)).toEqual([
      'key-0000000000000001',
      'key-0000000000000001',
    ]);
  });

  it('retries at most once even if the refreshed token is rejected too', async () => {
    setAuthTokenProvider(async () => 'token');
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue(mutationError('UNAUTHENTICATED'));
    const data = await createSession();
    expect(data.createPlanningSession.error?.code).toBe('UNAUTHENTICATED');
    expect(post).toHaveBeenCalledTimes(2);
  });

  it.each(['REAUTHENTICATION_REQUIRED', 'PERMANENT_ACCOUNT_REQUIRED', 'VALIDATION_FAILED'])(
    'does not retry a mutation answered with %s',
    async (code) => {
      setAuthTokenProvider(async () => 'token');
      const post = vi.spyOn(apiClient, 'post').mockResolvedValue(mutationError(code));
      await createSession();
      expect(post).toHaveBeenCalledTimes(1);
    },
  );

  it('does not retry when only part of the request was rejected', async () => {
    setAuthTokenProvider(async () => 'token');
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({
      data: {
        data: { viewer: { uid: 'u' } },
        errors: [{ message: 'sign in', extensions: { code: 'UNAUTHENTICATED' } }],
      },
    });
    await expect(graphqlRequest(ViewerDocument, {})).rejects.toBeInstanceOf(GraphQLRequestError);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('does not retry transport failures', async () => {
    setAuthTokenProvider(async () => 'token');
    const post = vi.spyOn(apiClient, 'post').mockRejectedValue(new AxiosError('offline'));
    await expect(createSession()).rejects.toBeInstanceOf(AxiosError);
    expect(post).toHaveBeenCalledTimes(1);
  });
});
