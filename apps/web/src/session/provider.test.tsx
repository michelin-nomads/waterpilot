import { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { useAuth } from '../auth/authContext';
import { ToastProvider } from '../components/Toast/ToastProvider';
import { queryKeys } from '../graphql/queryKeys';
import { DESKTOP_QUERY } from '../lib/useMediaQuery';
import { routes } from '../routes';
import { AuthTestProviders } from '../test/AuthTestProviders';
import { preloadLazyRoutes } from '../test/preloadRoutes';
import { FakeAuthBackend, guest, permanent } from '../test/fakeAuth';
import { FakeSessionServer } from '../test/fakeSession';
import { setMediaQuery } from '../test/mediaQueryMock';
import { DisplayPreferencesProvider } from '../theme/DisplayPreferencesProvider';
import { MemoryRecoveryStore } from './recoveryStore';
import { usePlanningSession } from './sessionContext';

beforeAll(() => preloadLazyRoutes(routes), 60_000);

const GOAL_A = { kind: 'REDUCE_SHORTAGE', description: 'Cut demand by a fifth' } as const;
const GOAL_B = { kind: 'REDUCE_SHORTAGE', description: 'Cut demand by a third' } as const;

type Session = ReturnType<typeof usePlanningSession>;
const probe: { session: Session | null } = { session: null };
const seen: Array<{ uid: string | null; sessionId: string | null }> = [];

/** Records what every render shows, to prove no frame mixes identities. */
function Probe() {
  const auth = useAuth();
  const session = usePlanningSession();
  probe.session = session;
  seen.push({ uid: auth.user?.uid ?? null, sessionId: session.view?.id ?? null });
  return null;
}

function renderApp({
  path = '/area',
  backend = new FakeAuthBackend(permanent()),
  sessions = new FakeSessionServer(),
  recovery = new MemoryRecoveryStore(),
  queryClient = new QueryClient(),
  resumeExisting = true,
}: {
  resumeExisting?: boolean;
  path?: string;
  backend?: FakeAuthBackend;
  sessions?: FakeSessionServer;
  recovery?: MemoryRecoveryStore;
  queryClient?: QueryClient;
} = {}) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <DisplayPreferencesProvider>
      <AuthTestProviders
        backend={backend}
        sessions={sessions}
        recovery={recovery}
        queryClient={queryClient}
        resumeExisting={resumeExisting}
      >
        <Probe />
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthTestProviders>
    </DisplayPreferencesProvider>,
  );
  return { router, backend, sessions, recovery, queryClient };
}

const session = () => probe.session as Session;

/** Sign out lives in the account menu: open it, then choose it. */
function chooseSignOut() {
  fireEvent.click(screen.getByRole('button', { name: /^Account menu/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
}

beforeEach(() => {
  probe.session = null;
  seen.length = 0;
});

describe('planning session in the app', () => {
  it('shows saving until acknowledgement, then removes routine status', async () => {
    const sessions = new FakeSessionServer();
    sessions.seed('user-1');
    renderApp({ sessions });
    await vi.waitFor(() => expect(session().state.status).toBe('ready'));
    let release!: () => void;
    sessions.hold = new Promise((resolve) => (release = resolve));

    act(() => session().coordinator?.setGoal(GOAL_A));
    expect(await screen.findByText('Saving…')).toBeInTheDocument();
    expect(screen.queryByText('Changes saved')).not.toBeInTheDocument();
    expect(session().view?.goal?.description).toBe(GOAL_A.description);

    await act(async () => release());
    await vi.waitFor(() => expect(session().state.save).toBe('saved'));
    expect(screen.queryByText('Changes saved')).not.toBeInTheDocument();
  });

  it('offers a clear choice when another tab changed the same input', async () => {
    const sessions = new FakeSessionServer();
    const { id } = sessions.seed('user-1');
    renderApp({ sessions });
    await vi.waitFor(() => expect(session().state.status).toBe('ready'));
    sessions.externalEdit(id, { goal: GOAL_B });

    act(() => session().coordinator?.setGoal(GOAL_A));
    const notice = (await screen.findByText(/changed in another tab or on another device/i))
      .parentElement?.parentElement as HTMLElement;
    expect(within(notice).getByText(/your goal also changed there/i)).toBeInTheDocument();
    expect(screen.getByText(/not saved · choose a version/i)).toBeInTheDocument();

    fireEvent.click(within(notice).getByRole('button', { name: 'Keep my changes' }));
    await vi.waitFor(() => expect(session().state.save).toBe('saved'));
    expect(screen.queryByText('Changes saved')).not.toBeInTheDocument();
    expect(sessions.sessions.get(id)?.goal?.description).toBe(GOAL_A.description);
  });

  it('switching mode keeps the same session and its inputs', async () => {
    setMediaQuery(DESKTOP_QUERY, true);
    const sessions = new FakeSessionServer();
    const { id } = sessions.seed('user-1', { areaId: 'area-1', goal: GOAL_A });
    renderApp({ sessions });
    await vi.waitFor(() => expect(session().view?.goal?.description).toBe(GOAL_A.description));
    const explorer = screen.getByRole('radio', {
      name: /Explorer: Build your plan yourself, step by step/i,
    });
    expect(explorer).toBeChecked();
    expect(
      screen.getByText('Plan with AI assistance. You can make changes yourself anytime.'),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('radio', { name: /WaterPilot Agent: Plan with AI assistance/i }),
    );
    expect(
      screen.getByRole('radio', { name: /WaterPilot Agent: Plan with AI assistance/i }),
    ).toBeChecked();
    expect(screen.getByRole('complementary', { name: 'Conversation' })).toBeInTheDocument();
    await vi.waitFor(() => expect(sessions.sessions.get(id)?.mode).toBe('AGENT'));
    expect(session().view?.goal?.description).toBe(GOAL_A.description);
    expect(session().view?.id).toBe(id);
    expect(sessions.calls.some((c) => c.startsWith('create'))).toBe(false);
  });

  it('records the step the user navigates to on the session', async () => {
    const sessions = new FakeSessionServer();
    const { id } = sessions.seed('user-1', {
      areaId: 'area-1',
      baselineReviewed: true,
      goal: GOAL_A,
    });
    renderApp({ sessions });
    await vi.waitFor(() => expect(session().state.status).toBe('ready'));
    const stages = await screen.findByRole('navigation', { name: 'Planning stages' });
    fireEvent.click(within(stages).getByRole('link', { name: /compare/i }));
    await vi.waitFor(() => expect(sessions.sessions.get(id)?.stage).toBe('COMPARE'));
  });

  it('removes derived results when an upstream input changes', async () => {
    const sessions = new FakeSessionServer();
    const { id } = sessions.seed('user-1');
    const queryClient = new QueryClient();
    queryClient.setQueryData(queryKeys.sessions.planOptions(id, 0), { cached: true });
    queryClient.setQueryData(queryKeys.sessions.fundingMatches(id, 0, 'pln_1'), { cached: true });
    renderApp({ sessions, queryClient });
    await vi.waitFor(() => expect(session().state.status).toBe('ready'));

    act(() => session().coordinator?.setStage('GOAL'));
    await vi.waitFor(() => expect(session().state.save).toBe('saved'));
    expect(queryClient.getQueryData(queryKeys.sessions.planOptions(id, 0))).toBeDefined();

    act(() => session().coordinator?.setArea('area-2'));
    await vi.waitFor(() => expect(session().state.server?.inputsRevision).toBe(1));
    expect(queryClient.getQueryData(queryKeys.sessions.planOptions(id, 0))).toBeUndefined();
    expect(
      queryClient.getQueryData(queryKeys.sessions.fundingMatches(id, 0, 'pln_1')),
    ).toBeUndefined();
  });

  it('switching accounts never shows the previous account’s plan', async () => {
    const backend = new FakeAuthBackend(permanent('user-1', 'ana@example.org'));
    backend.existing.set('bo@example.org', permanent('user-2', 'bo@example.org'));
    const sessions = new FakeSessionServer();
    const first = sessions.seed('user-1', { goal: GOAL_A });
    const second = sessions.seed('user-2', { goal: GOAL_B });
    const recovery = new MemoryRecoveryStore();
    const queryClient = new QueryClient();
    renderApp({ backend, sessions, recovery, queryClient });
    await vi.waitFor(() => expect(session().view?.goal?.description).toBe(GOAL_A.description));
    await vi.waitFor(async () => expect(await recovery.forUid('user-1')).toHaveLength(1));
    queryClient.setQueryData(queryKeys.sessions.detail(first.id), { cached: true });

    await act(async () => {
      await backend.signIn({ kind: 'email-sign-in', email: 'bo@example.org', password: 'x' });
    });
    await vi.waitFor(() => expect(session().view?.goal?.description).toBe(GOAL_B.description));
    expect(screen.queryByText(GOAL_A.description)).not.toBeInTheDocument();
    expect(seen.some((s) => s.uid === 'user-2' && s.sessionId === first.id)).toBe(false);
    expect(seen.some((s) => s.uid === 'user-2' && s.sessionId === second.id)).toBe(true);
    expect(queryClient.getQueryData(queryKeys.sessions.detail(first.id))).toBeUndefined();
    await vi.waitFor(async () => expect(await recovery.forUid('user-1')).toEqual([]));
  });

  it('signing out leaves nothing of the account on the device', async () => {
    const sessions = new FakeSessionServer();
    sessions.seed('user-1', { goal: GOAL_A });
    const recovery = new MemoryRecoveryStore();
    const { backend } = renderApp({ sessions, recovery });
    await vi.waitFor(() => expect(session().view?.goal?.description).toBe(GOAL_A.description));
    await vi.waitFor(async () => expect(await recovery.forUid('user-1')).toHaveLength(1));

    chooseSignOut();
    fireEvent.click(
      within(await screen.findByRole('dialog', { name: 'Sign out and lose your plan?' })).getByRole(
        'button',
        { name: 'Sign out and lose plan' },
      ),
    );
    await vi.waitFor(() => expect(backend.calls).toContain('signOut'));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'A better water plan starts here.' }),
    ).toBeInTheDocument();
    await vi.waitFor(async () => expect(await recovery.forUid('user-1')).toEqual([]));
    expect(screen.queryByText(GOAL_A.description)).not.toBeInTheDocument();
  });

  it('asks before signing out of a plan, and signing out ends it', async () => {
    const sessions = new FakeSessionServer();
    sessions.seed('user-1', {
      goal: GOAL_A,
      stage: 'GOAL',
      areaId: 'area-1',
      baselineReviewed: true,
    });
    const { backend } = renderApp({ sessions, path: '/goals' });
    await vi.waitFor(() => expect(session().view?.goal?.description).toBe(GOAL_A.description));

    chooseSignOut();
    const dialog = await screen.findByRole('dialog', { name: 'Sign out and lose your plan?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Stay signed in' }));
    expect(backend.calls).not.toContain('signOut');

    chooseSignOut();
    fireEvent.click(
      within(await screen.findByRole('dialog', { name: 'Sign out and lose your plan?' })).getByRole(
        'button',
        { name: 'Sign out and lose plan' },
      ),
    );
    await vi.waitFor(() => expect(backend.calls).toContain('signOut'));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'A better water plan starts here.' }),
    ).toBeInTheDocument();
  });

  it('a guest who upgrades keeps the same plan', async () => {
    const backend = new FakeAuthBackend(guest());
    const sessions = new FakeSessionServer();
    const { id } = sessions.seed('guest-1', { goal: GOAL_A });
    renderApp({ backend, sessions, path: '/goals' });
    await vi.waitFor(() => expect(session().view?.goal?.description).toBe(GOAL_A.description));
    await act(async () => {
      await backend.link({ kind: 'email-create', email: 'g@example.org', password: 'secret1' });
    });
    await vi.waitFor(() => expect(session().state.status).toBe('ready'));
    expect(session().view?.id).toBe(id);
    expect(session().view?.goal?.description).toBe(GOAL_A.description);
  });

  it('New report starts the chosen mode from the workspace and replaces the old plan', async () => {
    const sessions = new FakeSessionServer();
    const { id } = sessions.seed('user-1', { stage: 'GOAL' });
    const { router } = renderApp({ sessions, path: '/reports' });
    await screen.findByRole('heading', { level: 1, name: 'Your water planning workspace' });

    fireEvent.click(screen.getByRole('button', { name: 'New report' }));
    const dialog = await screen.findByRole('dialog', { name: 'New report' });
    expect(within(dialog).getByRole('button', { name: /Explorer/ })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /WaterPilot Agent/ })).toBeInTheDocument();
    expect(screen.queryByText('Replace your current plan?')).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: /Explorer/ }));
    await screen.findByRole('heading', { level: 1, name: 'Understand your area' });
    expect(router.state.location.pathname).toBe('/area');
    expect(sessions.sessions.get(id)?.status).toBe('CLOSED');
    expect(session().view?.id).not.toBe(id);
  });

  it('reuses the same create intent after a lost response', async () => {
    const sessions = new FakeSessionServer();
    const { router } = renderApp({ sessions, path: '/reports', resumeExisting: false });
    await screen.findByRole('heading', { level: 1, name: 'Your water planning workspace' });

    fireEvent.click(screen.getByRole('button', { name: 'New report' }));
    const dialog = await screen.findByRole('dialog', { name: 'New report' });
    sessions.dropResponses = 1;
    await act(async () =>
      fireEvent.click(within(dialog).getByRole('button', { name: /WaterPilot Agent/ })),
    );
    expect(
      await screen.findByText(
        'A new report could not be started. Check your connection and try again.',
      ),
    ).toBeInTheDocument();
    await act(async () =>
      fireEvent.click(within(dialog).getByRole('button', { name: /WaterPilot Agent/ })),
    );

    await screen.findByRole('heading', { level: 1, name: 'Understand your area' });
    expect(router.state.location.pathname).toBe('/area');
    expect(sessions.calls.filter((call) => call === 'create:AGENT')).toHaveLength(2);
    expect([...sessions.sessions.values()].filter((item) => item.status === 'ACTIVE')).toHaveLength(
      1,
    );
  });

  it('does not resume a plan from an earlier visit', async () => {
    const sessions = new FakeSessionServer();
    const { id } = sessions.seed('user-1', {
      goal: GOAL_A,
      stage: 'GOAL',
      areaId: 'area-1',
      baselineReviewed: true,
    });
    const recovery = new MemoryRecoveryStore();
    const { router } = renderApp({ sessions, recovery, path: '/goals', resumeExisting: false });

    await screen.findByRole('heading', { level: 1, name: 'A better water plan starts here.' });
    expect(router.state.location.pathname).toBe('/');
    expect(session().state.status).toBe('none');
    expect(screen.queryByText(GOAL_A.description)).not.toBeInTheDocument();
    expect(await recovery.forUid('user-1')).toEqual([]);
    // Nothing closed it on the server; the next plan started replaces it.
    expect(sessions.sessions.get(id)?.status).toBe('ACTIVE');
  });

  it('asks before leaving a plan and discards it only when confirmed', async () => {
    const sessions = new FakeSessionServer();
    sessions.seed('user-1', {
      goal: GOAL_A,
      stage: 'GOAL',
      areaId: 'area-1',
      baselineReviewed: true,
    });
    const { router } = renderApp({ sessions, path: '/goals' });
    await vi.waitFor(() => expect(session().view?.goal?.description).toBe(GOAL_A.description));

    await vi.waitFor(() => expect(session().state.status).toBe('ready'));
    // Let the router register its leave-guard, as the moments before a real click do.
    await act(async () => new Promise((resolve) => setTimeout(resolve, 50)));
    fireEvent.click(screen.getByRole('link', { name: 'Communities' }));
    const dialog = await screen.findByRole(
      'dialog',
      { name: 'Leave this plan?' },
      { timeout: 4000 },
    );
    expect(within(dialog).getByText(/Your plan will be lost/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Stay on this plan' }));
    expect(router.state.location.pathname).toBe('/goals');
    expect(session().state.status).toBe('ready');

    fireEvent.click(screen.getByRole('link', { name: 'Communities' }));
    fireEvent.click(
      within(
        await screen.findByRole('dialog', { name: 'Leave this plan?' }, { timeout: 4000 }),
      ).getByRole('button', {
        name: 'Leave and lose plan',
      }),
    );
    await screen.findByRole('heading', { level: 1, name: 'Communities' });
    expect(router.state.location.pathname).toBe('/communities');
    expect(session().state.status).toBe('none');
  });

  it('moving between planning steps never asks', async () => {
    const sessions = new FakeSessionServer();
    sessions.seed('user-1', {
      goal: GOAL_A,
      stage: 'GOAL',
      areaId: 'area-1',
      baselineReviewed: true,
    });
    const { router } = renderApp({ sessions, path: '/goals' });
    await vi.waitFor(() => expect(session().view?.goal?.description).toBe(GOAL_A.description));

    await act(async () => {
      await router.navigate('/plans');
    });
    expect(screen.queryByRole('dialog', { name: 'Leave this plan?' })).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/plans');
  });

  it('keeps the workspace and its routes for signed-in accounts only', async () => {
    const { router } = renderApp({
      backend: new FakeAuthBackend(guest()),
      path: '/reports',
      resumeExisting: false,
    });
    await screen.findByRole('heading', { level: 1, name: 'Welcome to WaterPilot' });
    expect(router.state.location.pathname).toBe('/signin');
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();
  });
});
