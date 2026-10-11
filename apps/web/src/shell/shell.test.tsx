import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { ToastProvider } from '../components/Toast/ToastProvider';
import { AGENT_WIDTH, AGENT_WIDTH_STORAGE_KEY } from '../features/planning/agentWidth';
import { PLANNING_MODE_STORAGE_KEY } from '../features/planning/planningMode';
import { DESKTOP_QUERY } from '../lib/useMediaQuery';
import { routes } from '../routes';
import { AuthFailure } from '../auth/authErrors';
import { AuthTestProviders } from '../test/AuthTestProviders';
import { FakeAuthBackend, guest, permanent } from '../test/fakeAuth';
import { FakeSessionServer } from '../test/fakeSession';
import { setMediaQuery } from '../test/mediaQueryMock';
import { DisplayPreferencesProvider } from '../theme/DisplayPreferencesProvider';

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
    fireEvent.click(await screen.findByRole('button', { name: 'Start planning' }));
    await screen.findByRole('heading', { level: 1, name: 'Understand Your Area' });
    expect(router.state.location.pathname).toBe('/area');
    expect(backend.calls).toEqual(['signInAsGuest']);
    expect(screen.getByText('Guest')).toBeInTheDocument();
  });

  it('starts the session in the mode chosen on Welcome', async () => {
    setMediaQuery(DESKTOP_QUERY, true);
    const sessions = new FakeSessionServer();
    await renderAt('/', new FakeAuthBackend(), sessions);
    fireEvent.click(await screen.findByRole('radio', { name: /with the assistant/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Start planning' }));
    await screen.findByRole('heading', { level: 1, name: 'Understand Your Area' });
    expect(sessions.active('guest-1')?.mode).toBe('AGENT');
    expect(screen.getByRole('complementary', { name: 'Conversation' })).toBeInTheDocument();
    expect(window.localStorage.getItem(PLANNING_MODE_STORAGE_KEY)).toBe('agent');
  });

  it('continues an existing guest at the saved step and mode, without new accounts or sessions', async () => {
    setMediaQuery(DESKTOP_QUERY, true);
    const backend = new FakeAuthBackend(guest());
    const sessions = new FakeSessionServer();
    sessions.seed('guest-1', { stage: 'GOAL', mode: 'AGENT' });
    const router = await renderAt('/', backend, sessions);
    fireEvent.click(await screen.findByRole('button', { name: 'Continue planning' }));
    await screen.findByRole('heading', { level: 1, name: 'Set Your Goal' });
    expect(router.state.location.pathname).toBe('/goals');
    expect(screen.getByRole('radio', { name: 'Agent' })).toBeChecked();
    expect(backend.calls).toEqual([]);
    expect(sessions.calls.filter((c) => c.startsWith('create'))).toEqual([]);
  });

  it('sends a signed-in account to its dashboard with the current plan', async () => {
    const sessions = new FakeSessionServer();
    sessions.seed('user-1', { stage: 'COMPARE' });
    const router = await renderAt('/', new FakeAuthBackend(permanent()), sessions);
    await screen.findByRole('heading', { level: 1, name: 'Dashboard' });
    expect(router.state.location.pathname).toBe('/dashboard');
    expect(await screen.findByRole('link', { name: /resume compare plans/i })).toHaveAttribute(
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
    fireEvent.click(await screen.findByRole('button', { name: 'Start planning' }));
    expect(await screen.findByText(/new guest sessions are paused/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in to your account' })).toBeInTheDocument();
  });

  it('offers a retry when starting fails on the network', async () => {
    const backend = new FakeAuthBackend();
    backend.failures.set('signInAsGuest', new AuthFailure('network'));
    await renderAt('/', backend);
    fireEvent.click(await screen.findByRole('button', { name: 'Start planning' }));
    expect(await screen.findByText(/could not reach the sign-in service/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByRole('heading', { level: 1, name: 'Understand Your Area' });
  });

  it('reports a cancelled sign-in and keeps guest start available', async () => {
    await renderAt('/');
    fireEvent.click(await screen.findByRole('button', { name: 'Sign in to your account' }));
    const dialog = await screen.findByRole('dialog', { name: 'Sign in to WaterLens' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(await screen.findByText(/sign-in was cancelled/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start planning' })).toBeInTheDocument();
  });

  it('shows a signed-in account with sign-out in the header', async () => {
    const backend = new FakeAuthBackend(permanent());
    await renderAt('/', backend);
    expect(await screen.findByText('ana@example.org')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('button', { name: 'Start planning' })).toBeInTheDocument();
    expect(backend.calls).toEqual(['signOut']);
  });
});

describe('application shell', () => {
  it('marks the first stage as the current step', async () => {
    await renderAt('/area');
    const stages = screen.getByRole('navigation', { name: 'Planning stages' });
    const links = within(stages).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual([
      '1Understand Your Area',
      '2Set Your Goal',
      '3Compare Plans',
      '4Make It Happen',
      '5Take Action & Track',
    ]);
    expect(within(stages).getByRole('link', { name: /understand your area/i })).toHaveAttribute(
      'aria-current',
      'step',
    );
    expect(screen.getByText('Step 1 of 5', { selector: 'p:not(nav p)' })).toBeInTheDocument();
    expect(document.title).toBe('Understand Your Area · WaterLens');
  });

  it('has no separate What-if page: /scenarios redirects into the workspace', async () => {
    const router = await renderAt('/scenarios');
    expect(router.state.location.pathname).toBe('/area');
    expect(screen.queryByRole('link', { name: /future scenario/i })).not.toBeInTheDocument();
  });

  it('keeps the old /funding link working by redirecting to Make It Happen', async () => {
    const router = await renderAt('/funding');
    expect(router.state.location.pathname).toBe('/make-it-happen');
    expect(screen.getByRole('heading', { level: 1, name: 'Make It Happen' })).toBeInTheDocument();
  });

  it('stage pages state plainly that no data is shown yet', async () => {
    await renderAt('/plans');
    expect(
      screen.getByRole('heading', { name: 'This stage is not built yet' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/nothing on this page is a result/i)).toBeInTheDocument();
  });

  it('moves focus to the new page heading after navigation', async () => {
    await renderAt('/area');
    const stages = screen.getByRole('navigation', { name: 'Planning stages' });
    fireEvent.click(within(stages).getByRole('link', { name: /set your goal/i }));
    const heading = await screen.findByRole('heading', { level: 1, name: 'Set Your Goal' });
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
    expect(screen.getByText(/require a permanent sign-in/i)).toBeInTheDocument();
  });
});

describe('planning modes', () => {
  it('defaults to Traditional with the workspace only', async () => {
    await renderAt('/area');
    expect(screen.getByRole('radio', { name: 'Traditional' })).toBeChecked();
    expect(screen.queryByRole('complementary', { name: 'Conversation' })).not.toBeInTheDocument();
  });

  it('desktop Agent mode shows the agent beside the workspace, and the choice persists', async () => {
    setMediaQuery(DESKTOP_QUERY, true);
    await renderAt('/area');
    fireEvent.click(screen.getByRole('radio', { name: 'Agent' }));

    const agent = screen.getByRole('complementary', { name: 'Conversation' });
    const workspace = screen.getByRole('region', { name: 'Workspace' });
    expect(
      agent.compareDocumentPosition(workspace) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(within(agent).getByText('Not connected')).toBeInTheDocument();
    expect(within(workspace).getByRole('heading', { level: 1 })).toBeVisible();
    expect(screen.queryByRole('tablist', { name: 'Planning panes' })).not.toBeInTheDocument();
    expect(window.localStorage.getItem(PLANNING_MODE_STORAGE_KEY)).toBe('agent');
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
    expect(screen.queryByText("You're offline")).not.toBeInTheDocument();
    expect(screen.getByText('Back online.')).toBeInTheDocument();
    onLine.mockRestore();
  });

  it('"Use Traditional mode" from the agent pane switches back', async () => {
    setMediaQuery(DESKTOP_QUERY, true);
    window.localStorage.setItem(PLANNING_MODE_STORAGE_KEY, 'agent');
    await renderAt('/goals');
    fireEvent.click(screen.getByRole('button', { name: 'Use Traditional mode' }));
    expect(screen.getByRole('radio', { name: 'Traditional' })).toBeChecked();
    expect(screen.queryByRole('complementary', { name: 'Conversation' })).not.toBeInTheDocument();
  });
});
