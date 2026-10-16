import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { ToastProvider } from '../components/Toast/ToastProvider';
import { AGENT_WIDTH, AGENT_WIDTH_STORAGE_KEY } from '../features/planning/agentWidth';
import { PLANNING_MODE_STORAGE_KEY } from '../features/planning/planningMode';
import { DESKTOP_QUERY } from '../lib/useMediaQuery';
import { pathForSessionStage, sessionStageForPath, stageForPath } from './stages';
import { routes } from '../routes';
import { AuthFailure } from '../auth/authErrors';
import { AuthTestProviders } from '../test/AuthTestProviders';
import { preloadLazyRoutes } from '../test/preloadRoutes';
import { FakeAuthBackend, guest, permanent } from '../test/fakeAuth';
import { FakeSessionServer } from '../test/fakeSession';
import { setMediaQuery } from '../test/mediaQueryMock';
import { DisplayPreferencesProvider } from '../theme/DisplayPreferencesProvider';

beforeAll(() => preloadLazyRoutes(routes), 60_000);

async function renderAt(
  path: string,
  backend = new FakeAuthBackend(),
  sessions = new FakeSessionServer(),
) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <DisplayPreferencesProvider>
      <AuthTestProviders backend={backend} sessions={sessions}>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthTestProviders>
    </DisplayPreferencesProvider>,
  );
  await screen.findByRole('heading', { level: 1 });
  return router;
}

describe('welcome', () => {
  it('starts planning as an anonymous guest account, then opens the first stage', async () => {
    const backend = new FakeAuthBackend();
    const router = await renderAt('/', backend);
    expect(screen.getByText(/coverage varies by location/i)).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Start exploring' }));
    await screen.findByRole('heading', { level: 1, name: 'Confirm your location' });
    expect(router.state.location.pathname).toBe('/area');
    expect(backend.calls).toEqual(['signInAsGuest']);
    expect(screen.getByText('Guest')).toBeInTheDocument();
  });

  it('starts the session in the mode chosen on Welcome', async () => {
    setMediaQuery(DESKTOP_QUERY, true);
    const sessions = new FakeSessionServer();
    await renderAt('/', new FakeAuthBackend(), sessions);
    fireEvent.click(await screen.findByRole('button', { name: 'Start with agent' }));
    await screen.findByRole('heading', { level: 1, name: 'Confirm your location' });
    expect(sessions.active('guest-1')?.mode).toBe('AGENT');
    expect(screen.getByRole('complementary', { name: 'Conversation' })).toBeInTheDocument();
    expect(window.localStorage.getItem(PLANNING_MODE_STORAGE_KEY)).toBe('agent');
  });

  it('presents Copilot first with the primary CTA and keeps local previews secondary', async () => {
    await renderAt('/');
    const choices = screen.getByRole('region', { name: 'Choose how to plan' });
    expect(
      within(choices)
        .getAllByRole('heading', { level: 2 })
        .map((heading) => heading.textContent),
    ).toEqual(['Guide me with WaterLensAgent', 'Explore on my own']);
    const agentCard = within(choices)
      .getByRole('heading', { name: 'Guide me with WaterLensAgent' })
      .closest('article')!;
    const explorerCard = within(choices)
      .getByRole('heading', { name: 'Explore on my own' })
      .closest('article')!;
    expect(within(agentCard).getByRole('button', { name: 'Start with agent' }).className).not.toBe(
      within(explorerCard).getByRole('button', { name: 'Start exploring' }).className,
    );
    expect(screen.getByText('Browse other screens').closest('details')).not.toHaveAttribute('open');
  });

  it('continues an existing guest at the saved step and mode, without new accounts or sessions', async () => {
    setMediaQuery(DESKTOP_QUERY, true);
    const backend = new FakeAuthBackend(guest());
    const sessions = new FakeSessionServer();
    sessions.seed('guest-1', { stage: 'GOAL', mode: 'AGENT' });
    const router = await renderAt('/', backend, sessions);
    fireEvent.click(await screen.findByRole('button', { name: 'Continue planning' }));
    await screen.findByRole('heading', { level: 1, name: 'Set your goal and constraints' });
    expect(router.state.location.pathname).toBe('/goals');
    expect(
      screen.getByRole('radio', { name: /Copilot: Plan with AI assistance/ }),
    ).toBeInTheDocument();
    expect(backend.calls).toEqual([]);
    expect(sessions.calls.filter((c) => c.startsWith('create'))).toEqual([]);
  });

  it('sends a signed-in account to its dashboard with the current plan', async () => {
    const sessions = new FakeSessionServer();
    sessions.seed('user-1', { stage: 'COMPARE' });
    const router = await renderAt('/', new FakeAuthBackend(permanent()), sessions);
    await screen.findByRole('heading', { level: 1, name: 'Dashboard' });
    expect(router.state.location.pathname).toBe('/dashboard');
    expect(await screen.findByRole('link', { name: /continue compare/i })).toHaveAttribute(
      'href',
      '/plans',
    );
  });

  it('asks guests to sign in on the dashboard', async () => {
    await renderAt('/dashboard', new FakeAuthBackend(guest()));
    expect(
      await screen.findByRole('heading', { name: 'Sign in to see your dashboard' }),
    ).toBeInTheDocument();
  });

  it('explains when guest sessions are paused and still offers sign-in', async () => {
    const backend = new FakeAuthBackend();
    backend.failures.set('signInAsGuest', new AuthFailure('method-disabled'));
    await renderAt('/', backend);
    fireEvent.click(await screen.findByRole('button', { name: 'Start exploring' }));
    expect(await screen.findByText(/new guest sessions are paused/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('offers a retry when starting fails on the network', async () => {
    const backend = new FakeAuthBackend();
    backend.failures.set('signInAsGuest', new AuthFailure('network'));
    await renderAt('/', backend);
    fireEvent.click(await screen.findByRole('button', { name: 'Start exploring' }));
    expect(await screen.findByText(/could not reach the sign-in service/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByRole('heading', { level: 1, name: 'Confirm your location' });
  });

  it('reports a cancelled sign-in and keeps guest start available', async () => {
    await renderAt('/');
    fireEvent.click(await screen.findByRole('button', { name: 'Sign in' }));
    const dialog = await screen.findByRole('dialog', { name: 'Sign in to WaterLens' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(
      await screen.findByText('Sign-in was cancelled. You can still start planning as a guest.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start exploring' })).toBeInTheDocument();
  });

  it('shows a signed-in account with sign-out in the header', async () => {
    const backend = new FakeAuthBackend(permanent());
    await renderAt('/', backend);
    expect(await screen.findByText('ana@example.org')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('button', { name: 'Start exploring' })).toBeInTheDocument();
    expect(backend.calls).toEqual(['signOut']);
  });
});

describe('application shell', () => {
  it('marks the first stage as the current step', async () => {
    await renderAt('/area');
    const stages = screen.getByRole('navigation', { name: 'Planning stages' });
    expect(screen.getByRole('region', { name: 'Workspace' })).toContainElement(stages);
    expect(
      within(screen.getByRole('link', { name: 'WaterLens home' }).closest('header')!).getByRole(
        'group',
        { name: 'Planning mode' },
      ),
    ).toBeInTheDocument();
    const links = within(stages).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual([
      '1Location',
      '2Baseline',
      '3Goal',
      '4Compare',
      '5Review',
    ]);
    expect(within(stages).getByRole('link', { name: /location/i })).toHaveAttribute(
      'aria-current',
      'step',
    );
    expect(screen.getByText('Step 1 of 5', { selector: 'p:not(nav p)' })).toBeInTheDocument();
    expect(document.title).toBe('Confirm your location · WaterLens');
  });

  it('keeps Reports inactive while Review is open inside the planning shell', async () => {
    await renderAt('/reports/review');
    const primary = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(primary).getByRole('link', { name: 'Plan' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(within(primary).getByRole('link', { name: 'Reports' })).toHaveAttribute(
      'aria-current',
      'false',
    );
    const stages = screen.getByRole('navigation', { name: 'Planning stages' });
    expect(within(stages).getByRole('link', { name: 'Review' })).toHaveAttribute(
      'aria-current',
      'step',
    );
  });

  it('has no separate What-if page: /scenarios redirects into the workspace', async () => {
    const router = await renderAt('/scenarios');
    expect(router.state.location.pathname).toBe('/plans');
    expect(screen.queryByRole('link', { name: /future scenario/i })).not.toBeInTheDocument();
  });

  it('keeps the old /funding link working by redirecting to Make It Happen', async () => {
    const router = await renderAt('/funding');
    expect(router.state.location.pathname).toBe('/make-it-happen');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Funding opportunities' }),
    ).toBeInTheDocument();
  });

  it('opens the implementation project stage with its guest sign-in state', async () => {
    await renderAt('/tracking');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Implementation projects' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Sign in to view implementation projects' }),
    ).toBeInTheDocument();
  });

  it('moves focus to the new page heading after navigation', async () => {
    await renderAt('/area');
    const stages = screen.getByRole('navigation', { name: 'Planning stages' });
    fireEvent.click(within(stages).getByRole('link', { name: /goal/i }));
    const heading = await screen.findByRole('heading', {
      level: 1,
      name: 'Set your goal and constraints',
    });
    expect(heading).toHaveFocus();
  });

  it('offers a skip link to the main landmark', async () => {
    await renderAt('/area');
    expect(screen.getByRole('link', { name: /skip to main content/i })).toHaveAttribute(
      'href',
      '#main',
    );
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
  });

  it('shows a not-found page for unknown addresses', async () => {
    await renderAt('/nope');
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
  });

  it('lists Reports and Communities as top-level destinations', async () => {
    await renderAt('/reports');
    const primary = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(primary).getByRole('link', { name: 'Reports' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(primary).getByRole('link', { name: 'Communities' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Sign in to view saved reports' }),
    ).toBeInTheDocument();
  });
});

describe('planning modes', () => {
  it('defaults to Traditional with the workspace only', async () => {
    await renderAt('/area');
    expect(screen.getByRole('radio', { name: /Explorer: Build your plan yourself/ })).toBeChecked();
    expect(screen.queryByRole('complementary', { name: 'Conversation' })).not.toBeInTheDocument();
  });

  it('desktop Agent mode shows the agent beside the workspace, and the choice persists', async () => {
    setMediaQuery(DESKTOP_QUERY, true);
    const sessions = new FakeSessionServer();
    const { id } = sessions.seed('guest-1', { stage: 'UNDERSTAND', mode: 'TRADITIONAL' });
    await renderAt('/area', new FakeAuthBackend(guest()), sessions);
    const workspaceBefore = screen.getByRole('region', { name: 'Workspace' });
    const explorer = screen.getByRole('radio', { name: /Explorer: Build your plan yourself/ });
    explorer.focus();
    fireEvent.keyDown(explorer, { key: 'ArrowRight' });
    fireEvent.click(screen.getByRole('radio', { name: /Copilot: Plan with AI assistance/ }));

    const agent = screen.getByRole('complementary', { name: 'Conversation' });
    const workspace = screen.getByRole('region', { name: 'Workspace' });
    expect(
      agent.compareDocumentPosition(workspace) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(within(agent).getByText('Not connected')).toBeInTheDocument();
    expect(within(workspace).getByRole('heading', { level: 1 })).toBeVisible();
    expect(screen.queryByRole('tablist', { name: 'Planning panes' })).not.toBeInTheDocument();
    expect(window.localStorage.getItem(PLANNING_MODE_STORAGE_KEY)).toBe('agent');
    expect(workspace).toBe(workspaceBefore);
    await waitFor(() => expect(sessions.active('guest-1')?.mode).toBe('AGENT'));
    expect(sessions.active('guest-1')?.id).toBe(id);
    expect(sessions.active('guest-1')?.stage).toBe('UNDERSTAND');
    expect(sessions.calls.filter((call) => call.startsWith('create'))).toEqual([]);
  });

  it('desktop conversation pane resizes from the keyboard within bounds and persists', async () => {
    setMediaQuery(DESKTOP_QUERY, true);
    window.localStorage.setItem(PLANNING_MODE_STORAGE_KEY, 'agent');
    await renderAt('/area');
    const handle = screen.getByRole('separator', { name: 'Resize conversation pane' });
    const pane = screen.getByRole('complementary', { name: 'Conversation' });
    expect(handle).toHaveAttribute('aria-controls', pane.id);
    expect(handle).toHaveAttribute('aria-valuenow', String(AGENT_WIDTH.default));

    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(handle).toHaveAttribute('aria-valuenow', String(AGENT_WIDTH.default + 16));
    expect(handle).toHaveAttribute('aria-valuetext', 'Conversation pane 400 pixels wide');
    fireEvent.keyDown(handle, { key: 'ArrowLeft', shiftKey: true });
    expect(handle).toHaveAttribute('aria-valuenow', String(AGENT_WIDTH.default + 16 - 64));

    fireEvent.keyDown(handle, { key: 'Home' });
    expect(handle).toHaveAttribute('aria-valuenow', String(AGENT_WIDTH.min));
    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    expect(handle).toHaveAttribute('aria-valuenow', String(AGENT_WIDTH.min));
    fireEvent.keyDown(handle, { key: 'End' });
    expect(handle).toHaveAttribute('aria-valuenow', String(AGENT_WIDTH.max));
    expect(window.localStorage.getItem(AGENT_WIDTH_STORAGE_KEY)).toBe(String(AGENT_WIDTH.max));

    fireEvent.keyDown(handle, { key: 'Enter' });
    expect(handle).toHaveAttribute('aria-valuenow', String(AGENT_WIDTH.default));
  });

  it('ignores an out-of-range stored pane width', async () => {
    setMediaQuery(DESKTOP_QUERY, true);
    window.localStorage.setItem(PLANNING_MODE_STORAGE_KEY, 'agent');
    window.localStorage.setItem(AGENT_WIDTH_STORAGE_KEY, '5000');
    await renderAt('/area');
    expect(screen.getByRole('separator')).toHaveAttribute(
      'aria-valuenow',
      String(AGENT_WIDTH.default),
    );
  });

  it('narrow Agent mode switches panes with tabs without remounting the workspace', async () => {
    window.localStorage.setItem(PLANNING_MODE_STORAGE_KEY, 'agent');
    await renderAt('/area');
    const heading = screen.getByRole('heading', { level: 1 });
    const tabs = screen.getByRole('tablist', { name: 'Planning panes' });
    const agentTab = within(tabs).getByRole('tab', { name: 'Conversation' });
    const workspaceTab = within(tabs).getByRole('tab', { name: 'Workspace' });
    expect(workspaceTab).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(agentTab);
    expect(screen.getByRole('tabpanel', { name: 'Conversation' })).toBeVisible();
    expect(heading).not.toBeVisible();

    fireEvent.keyDown(agentTab, { key: 'ArrowRight' });
    expect(workspaceTab).toHaveFocus();
    expect(heading).toBeVisible();

    // Growing to desktop keeps the very same workspace element, now beside a resize handle.
    act(() => setMediaQuery(DESKTOP_QUERY, true));
    expect(screen.getByRole('heading', { level: 1 })).toBe(heading);
    expect(screen.queryByRole('tablist', { name: 'Planning panes' })).not.toBeInTheDocument();
    expect(screen.getByRole('separator', { name: 'Resize conversation pane' })).toBeVisible();
  });

  it('shows a global offline notice and announces reconnection', async () => {
    const onLine = vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    await renderAt('/area');
    expect(screen.getByText("You're offline")).toBeInTheDocument();

    onLine.mockReturnValue(true);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => expect(screen.queryByText("You're offline")).not.toBeInTheDocument());
    expect(screen.getByText('Back online.')).toBeInTheDocument();
    onLine.mockRestore();
  });

  it('"Use Traditional mode" from the agent pane switches back', async () => {
    setMediaQuery(DESKTOP_QUERY, true);
    window.localStorage.setItem(PLANNING_MODE_STORAGE_KEY, 'agent');
    await renderAt('/goals');
    fireEvent.click(screen.getByRole('button', { name: 'Use Traditional mode' }));
    expect(screen.getByRole('radio', { name: /Explorer: Build your plan yourself/ })).toBeChecked();
    expect(screen.queryByRole('complementary', { name: 'Conversation' })).not.toBeInTheDocument();
  });
});

describe('corrected journey compatibility', () => {
  it.each([
    ['BASELINE', '/baseline'],
    ['BASELINE_INPUTS', '/baseline/inputs'],
    ['BASELINE_OVERVIEW', '/baseline/overview'],
    ['REVIEW', '/reports/review'],
    ['MAKE_IT_HAPPEN', '/make-it-happen'],
    ['TRACK', '/tracking'],
  ] as const)('recovers %s without creating another session', async (stage, path) => {
    expect(pathForSessionStage(stage)).toBe(path);
    const sessions = new FakeSessionServer();
    sessions.seed('guest-1', { stage, mode: 'AGENT' });
    const router = await renderAt(path, new FakeAuthBackend(guest()), sessions);
    expect(router.state.location.pathname).toBe(path);
    const isBranch = stage === 'MAKE_IT_HAPPEN' || stage === 'TRACK';
    if (isBranch) {
      expect(screen.queryByRole('navigation', { name: 'Planning stages' })).not.toBeInTheDocument();
    } else {
      expect(sessionStageForPath(path)).toBe(stage);
      expect(screen.getByRole('navigation', { name: 'Planning stages' })).toBeInTheDocument();
      await screen.findByRole('radio', { name: /Copilot: Plan with AI assistance/ });
    }
    expect(sessions.active('guest-1')?.stage).toBe(stage);
    expect(sessions.calls.filter((call) => call.startsWith('create'))).toEqual([]);
    expect(stageForPath('/reports/reviewer')).toBeNull();
    expect(stageForPath('/area-other')).toBeNull();
  });
});
