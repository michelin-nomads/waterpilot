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
import { FakeAuthBackend, FakeClaimApi, guest, permanent } from '../test/fakeAuth';
import { FakeSessionServer } from '../test/fakeSession';
import { setMediaQuery } from '../test/mediaQueryMock';
import { DisplayPreferencesProvider } from '../theme/DisplayPreferencesProvider';

beforeAll(() => preloadLazyRoutes(routes), 60_000);

async function renderAt(
  path: string,
  backend = new FakeAuthBackend(),
  sessions = new FakeSessionServer(),
  claims = new FakeClaimApi(),
) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <DisplayPreferencesProvider>
      <AuthTestProviders backend={backend} sessions={sessions} claimApi={claims}>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthTestProviders>
    </DisplayPreferencesProvider>,
  );
  await screen.findByRole('heading', { level: 1 });
  return router;
}

/** The application header (pages have their own banner-like headers too). */
const appHeader = () => screen.getByRole('link', { name: 'WaterPilot home' }).closest('header')!;

/** Planning screens belong to a plan, so these tests open one the way a visit would have. */
async function renderPlan(
  path: string,
  {
    mode = 'TRADITIONAL',
    stage = 'UNDERSTAND',
  }: { mode?: 'TRADITIONAL' | 'AGENT'; stage?: string } = {},
) {
  const sessions = new FakeSessionServer();
  sessions.seed('guest-1', {
    stage: stage as never,
    mode,
    ...(stage !== 'UNDERSTAND' ? { areaId: 'area-1', baselineReviewed: true } : {}),
    ...(['GOAL', 'COMPARE', 'REVIEW'].includes(stage)
      ? { scenario: { adjustments: [], confirmed: true } }
      : {}),
    ...(['COMPARE', 'REVIEW'].includes(stage)
      ? { goal: { kind: 'REDUCE_SHORTAGE' as const } }
      : {}),
    ...(stage === 'REVIEW' ? { selectedPlanOptionId: 'pln_saved' } : {}),
  });
  const router = await renderAt(path, new FakeAuthBackend(guest()), sessions);
  return { router, sessions };
}

const MAIN_HEADING = 'A better water plan starts here.';
const SIGN_IN_HEADING = 'Welcome to WaterPilot';

describe('main screen', () => {
  it('is open to everyone: someone with no account sees how to plan, and a Sign in link', async () => {
    const backend = new FakeAuthBackend();
    const router = await renderAt('/', backend);
    expect(screen.getByRole('heading', { level: 1, name: MAIN_HEADING })).toBeVisible();
    expect(screen.getByText(/coverage varies by location/i)).toBeInTheDocument();
    const header = appHeader();
    expect(within(header).getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/signin',
    );
    expect(within(header).getByText('Guest')).toBeVisible();
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
    expect(backend.calls).toEqual([]);
  });

  it('plans without signing in: starting begins a guest session, then opens the first stage', async () => {
    const backend = new FakeAuthBackend();
    const router = await renderAt('/', backend);
    fireEvent.click(screen.getByRole('button', { name: 'Start Exploring' }));
    await screen.findByRole('heading', { level: 1, name: 'Understand your area' });
    expect(router.state.location.pathname).toBe('/area');
    expect(backend.calls).toEqual(['signInAsGuest']);
    expect(within(appHeader()).getByText('Guest')).toBeInTheDocument();
  });

  it('has no /start route any more', async () => {
    const router = await renderAt('/start', new FakeAuthBackend());
    expect(router.state.location.pathname).toBe('/start');
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
  });

  it('shows a guest the same screen with a Guest label and Sign in, but not the workspace', async () => {
    await renderAt('/', new FakeAuthBackend(guest()));
    expect(screen.getByRole('heading', { level: 1, name: MAIN_HEADING })).toBeVisible();
    const header = appHeader();
    expect(within(header).getByText('Guest')).toBeInTheDocument();
    expect(within(header).getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();
  });

  it('keeps a signed-in account here, with an avatar, Reports and Communities in the header', async () => {
    const router = await renderAt('/', new FakeAuthBackend(permanent()));
    expect(screen.getByRole('heading', { level: 1, name: MAIN_HEADING })).toBeVisible();
    expect(router.state.location.pathname).toBe('/');
    const header = appHeader();
    expect(within(header).getByRole('button', { name: /Account menu/ })).toBeInTheDocument();
    expect(within(header).queryByText('Guest')).not.toBeInTheDocument();
    expect(within(header).queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();
    const primary = within(header).getByRole('navigation', { name: 'Primary' });
    expect(
      within(primary)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Reports', 'Communities']);
  });

  it('starts the session in the mode chosen here', async () => {
    setMediaQuery(DESKTOP_QUERY, true);
    const sessions = new FakeSessionServer();
    await renderAt('/', new FakeAuthBackend(guest()), sessions);
    fireEvent.click(await screen.findByRole('button', { name: 'Start with Agent' }));
    await screen.findByRole('heading', { level: 1, name: 'Understand your area' });
    expect(sessions.active('guest-1')?.mode).toBe('AGENT');
    expect(screen.getByRole('complementary', { name: 'Conversation' })).toBeInTheDocument();
    expect(window.localStorage.getItem(PLANNING_MODE_STORAGE_KEY)).toBe('agent');
  });

  it('presents WaterPilot Agent first with the primary CTA and keeps local previews secondary', async () => {
    await renderAt('/', new FakeAuthBackend(guest()));
    const choices = screen.getByRole('region', { name: 'Choose how to plan' });
    expect(
      within(choices)
        .getAllByRole('heading', { level: 2 })
        .map((heading) => heading.textContent),
    ).toEqual(['Guide me with WaterPilot', 'Explore on my own']);
    const agentCard = within(choices)
      .getByRole('heading', { name: 'Guide me with WaterPilot' })
      .closest('article')!;
    const explorerCard = within(choices)
      .getByRole('heading', { name: 'Explore on my own' })
      .closest('article')!;
    expect(within(agentCard).getByRole('button', { name: 'Start with Agent' }).className).not.toBe(
      within(explorerCard).getByRole('button', { name: 'Start Exploring' }).className,
    );
    expect(screen.getByText('How WaterPilot works').closest('details')).not.toHaveAttribute('open');
  });

  it('never offers to continue a plan: unfinished plans are not kept', async () => {
    const sessions = new FakeSessionServer();
    sessions.seed('guest-1', { stage: 'GOAL', mode: 'AGENT' });
    await renderAt('/', new FakeAuthBackend(guest()), sessions);
    expect(screen.queryByRole('button', { name: 'Continue planning' })).not.toBeInTheDocument();
    expect(screen.queryByText(/in progress/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Exploring' })).toBeInTheDocument();
  });

  it('explains when guest sessions are paused and keeps Sign in available', async () => {
    const backend = new FakeAuthBackend();
    backend.failures.set('signInAsGuest', new AuthFailure('method-disabled'));
    await renderAt('/', backend);
    fireEvent.click(screen.getByRole('button', { name: 'Start Exploring' }));
    expect(await screen.findByText(/new guest sessions are paused/i)).toBeInTheDocument();
    expect(within(appHeader()).getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('shows a failure to start and lets the person try again', async () => {
    const backend = new FakeAuthBackend();
    backend.failures.set('signInAsGuest', new AuthFailure('network'));
    const router = await renderAt('/', backend);
    fireEvent.click(screen.getByRole('button', { name: 'Start Exploring' }));
    expect(await screen.findByText(/your plan could not be started/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByRole('heading', { level: 1, name: 'Understand your area' });
    expect(router.state.location.pathname).toBe('/area');
  });

  it('opens the sign-in screen, not a dialog, from the header', async () => {
    const router = await renderAt('/', new FakeAuthBackend(guest()));
    fireEvent.click(within(appHeader()).getByRole('link', { name: 'Sign in' }));
    await screen.findByRole('heading', { level: 1, name: SIGN_IN_HEADING });
    expect(router.state.location.pathname).toBe('/signin');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps the workspace and the old /dashboard link closed to guests, sending them to sign in', async () => {
    const router = await renderAt('/dashboard', new FakeAuthBackend(guest()));
    await screen.findByRole('heading', { level: 1, name: SIGN_IN_HEADING });
    expect(router.state.location.pathname).toBe('/signin');
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();
  });

  it('sends the old /dashboard link of a signed-in account to the workspace', async () => {
    const router = await renderAt('/dashboard', new FakeAuthBackend(permanent()));
    await screen.findByRole('heading', { level: 1, name: 'Your water planning workspace' });
    expect(router.state.location.pathname).toBe('/reports');
  });

  it('shows a signed-in account as an avatar menu; signing out returns to this screen', async () => {
    const backend = new FakeAuthBackend(permanent());
    const router = await renderAt('/', backend);
    const trigger = await screen.findByRole('button', { name: 'Account menu for ana@example.org' });
    expect(trigger).toHaveTextContent('AN');
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
    fireEvent.click(trigger);
    expect(within(appHeader()).getByText('ana@example.org')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() =>
      expect(within(appHeader()).getByRole('link', { name: 'Sign in' })).toBeInTheDocument(),
    );
    expect(screen.getByRole('heading', { level: 1, name: MAIN_HEADING })).toBeVisible();
    expect(router.state.location.pathname).toBe('/');
    expect(backend.calls).toEqual(['signOut']);
  });
});

describe('communities page', () => {
  it('is its own page, with Create a community at the top right and no workspace tabs', async () => {
    await renderAt('/communities', new FakeAuthBackend(permanent()));
    const title = screen.getByRole('heading', { level: 1, name: 'Communities' });
    expect(title).toBeVisible();
    expect(screen.queryByRole('navigation', { name: 'Workspace' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create a community' })).toHaveAttribute(
      'href',
      '/communities/new',
    );
    expect(
      within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('link', {
        name: 'Communities',
      }),
    ).toHaveAttribute('aria-current', 'page');
  });
});

describe('sign-in screen', () => {
  it.each([null, guest()])(
    'hides Guest and duplicate Sign in on the sign-in screen (user: %s)',
    async (user) => {
      const backend = new FakeAuthBackend(user);
      const router = await renderAt('/signin', backend);
      expect(screen.getByRole('heading', { level: 1, name: SIGN_IN_HEADING })).toBeVisible();
      expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
      expect(screen.getByLabelText(/^Email/)).toBeVisible();
      expect(screen.getByRole('link', { name: 'Continue as guest' })).toBeVisible();
      expect(
        screen.getByText('An account is only needed to finalize and save your plan.'),
      ).toBeVisible();
      const header = appHeader();
      expect(within(header).queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();
      expect(within(header).queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument();
      expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();
      expect(within(header).queryByText('Guest')).not.toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/signin');
      expect(backend.calls).toEqual([]);
    },
  );

  it('continues as a guest to the main screen without creating an account', async () => {
    const backend = new FakeAuthBackend();
    const router = await renderAt('/signin', backend);
    fireEvent.click(screen.getByRole('link', { name: 'Continue as guest' }));
    await screen.findByRole('heading', { level: 1, name: MAIN_HEADING });
    expect(router.state.location.pathname).toBe('/');
    expect(within(appHeader()).getByText('Guest')).toBeVisible();
    expect(backend.calls).toEqual([]);
  });

  it('signs in and lands on the main screen with the account in the header', async () => {
    const backend = new FakeAuthBackend();
    backend.existing.set('ana@example.org', permanent('user-1', 'ana@example.org'));
    const router = await renderAt('/signin', backend);
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'ana@example.org' } });
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'secret-pass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByRole('heading', { level: 1, name: MAIN_HEADING });
    expect(router.state.location.pathname).toBe('/');
    expect(
      await within(appHeader()).findByRole('button', { name: /Account menu/ }),
    ).toBeInTheDocument();
  });

  it('sends an account that is already signed in to the main screen', async () => {
    const router = await renderAt('/signin', new FakeAuthBackend(permanent()));
    await screen.findByRole('heading', { level: 1, name: MAIN_HEADING });
    expect(router.state.location.pathname).toBe('/');
  });
});

describe('header by account', () => {
  it('shows a guest in the planner the Guest label and Sign in, but no workspace links', async () => {
    await renderPlan('/area');
    const header = appHeader();
    expect(within(header).getByText('Guest')).toBeInTheDocument();
    expect(within(header).getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(within(header).queryByRole('button', { name: /Account menu/ })).not.toBeInTheDocument();
    expect(within(header).queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();
    expect(within(header).getByRole('button', { name: 'Display settings' })).toBeInTheDocument();
  });

  it('opens Sign in as a dialog in the planner and leaves the plan untouched when it is closed', async () => {
    const { router } = await renderPlan('/area');
    fireEvent.click(within(appHeader()).getByRole('button', { name: 'Sign in' }));
    const dialog = await screen.findByRole('dialog', { name: 'Sign in to WaterPilot' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(
      await screen.findByText('Sign-in was cancelled. Your plan is as you left it.'),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/area');
    expect(screen.getByRole('heading', { level: 1, name: 'Understand your area' })).toBeVisible();
  });

  it('keeps the person on the same planner screen once they have signed in', async () => {
    const { router } = await renderPlan('/area');
    const nameField = screen.getByRole('combobox', { name: 'Search for a place' });
    fireEvent.change(nameField, { target: { value: 'Our village well' } });
    fireEvent.click(within(appHeader()).getByRole('button', { name: 'Sign in' }));
    const dialog = await screen.findByRole('dialog', { name: 'Sign in to WaterPilot' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create an account' }));
    fireEvent.change(within(dialog).getByLabelText(/^Email/), {
      target: { value: 'new@example.org' },
    });
    fireEvent.change(within(dialog).getByLabelText(/^Password/), {
      target: { value: 'secret-pass' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(router.state.location.pathname).toBe('/area');
    expect(screen.getByRole('heading', { level: 1, name: 'Understand your area' })).toBeVisible();
    const header = appHeader();
    expect(await within(header).findByRole('button', { name: /Account menu/ })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Search for a place' })).toBe(nameField);
    expect(nameField).toHaveValue('Our village well');
    expect(within(header).queryByText('Guest')).not.toBeInTheDocument();
    expect(within(header).getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });

  it.each([false, true])(
    'keeps the guest form through an existing-account claim (retry: %s)',
    async (retry) => {
      const backend = new FakeAuthBackend(guest());
      backend.existing.set('ana@example.org', permanent());
      const sessions = new FakeSessionServer();
      const guestPlan = sessions.seed('guest-1');
      const oldPlan = sessions.seed('user-1', { stage: 'GOAL' });
      const claims = new FakeClaimApi();
      let release!: () => void;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      const complete = claims.complete;
      let failures = 0;
      claims.complete = async (...args) => {
        await held;
        if (retry && failures++ < 3) {
          throw new AuthFailure('network');
        }
        sessions.sessions.get(oldPlan.id)!.status = 'CLOSED';
        sessions.sessions.get(guestPlan.id)!.owner = 'user-1';
        await complete(...args);
      };
      const router = await renderAt('/area', backend, sessions, claims);
      const field = screen.getByRole('combobox', { name: 'Search for a place' });
      fireEvent.change(field, { target: { value: 'Unsaved village well' } });
      fireEvent.click(within(appHeader()).getByRole('button', { name: 'Sign in' }));
      const dialog = await screen.findByRole('dialog');
      fireEvent.change(within(dialog).getByLabelText(/^Email/), {
        target: { value: 'ana@example.org' },
      });
      fireEvent.change(within(dialog).getByLabelText(/^Password/), {
        target: { value: 'secret-pass' },
      });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Sign in' }));
      await waitFor(() => expect(backend.currentUser()?.uid).toBe('user-1'));
      expect(field).toBeInTheDocument();
      expect(field).toHaveValue('Unsaved village well');
      await act(async () => release());
      if (retry) {
        await within(dialog).findByText('Signed in — your guest plan is not moved yet');
        act(() => {
          window.dispatchEvent(new Event('online'));
        });
        expect(field).toBeInTheDocument();
        fireEvent.click(within(dialog).getByRole('button', { name: 'Try again' }));
      }
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(screen.getByRole('combobox', { name: 'Search for a place' })).toBe(field);
      expect(field).toHaveValue('Unsaved village well');
      expect(router.state.location.pathname).toBe('/area');
      expect(sessions.active('user-1')?.id).toBe(guestPlan.id);
      expect(sessions.calls.filter((call) => call.startsWith('create'))).toEqual([]);
    },
  );

  it('shows a signed-in person in the planner their avatar and the workspace links, with no Guest label or Sign in', async () => {
    const sessions = new FakeSessionServer();
    sessions.seed('user-1', { stage: 'UNDERSTAND' });
    await renderAt('/area', new FakeAuthBackend(permanent()), sessions);
    const header = appHeader();
    expect(within(header).getByRole('button', { name: /Account menu/ })).toBeInTheDocument();
    expect(within(header).queryByText('Guest')).not.toBeInTheDocument();
    expect(within(header).queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument();
    const primary = within(header).getByRole('navigation', { name: 'Primary' });
    expect(within(primary).getByRole('link', { name: 'Reports' })).toBeInTheDocument();
    expect(within(primary).getByRole('link', { name: 'Communities' })).toBeInTheDocument();
  });

  it('keeps the planning mode toggle and display control together at the end of the header', async () => {
    await renderPlan('/area');
    const header = appHeader();
    const toggle = within(header).getByRole('group', { name: 'Planning mode' });
    const display = within(header).getByRole('button', { name: 'Display settings' });
    const tools = toggle.closest('div[class*="tools"]');
    expect(tools).not.toBeNull();
    expect(tools).toContainElement(display);
    expect(header.querySelector('[class*="tools"]')).toBe(tools);
  });
});

describe('application shell', () => {
  it('redirects a direct future-stage URL to the first incomplete step', async () => {
    const { router } = await renderPlan('/plans');
    expect(router.state.location.pathname).toBe('/area');
    const stages = await screen.findByRole('navigation', { name: 'Planning stages' });
    expect(within(stages).getAllByRole('link')).toHaveLength(1);
    expect(stages.querySelectorAll('[aria-disabled="true"]')).toHaveLength(5);
  });

  it('marks the first stage as the current step', async () => {
    await renderPlan('/area');
    const stages = await screen.findByRole('navigation', { name: 'Planning stages' });
    expect(screen.getByRole('region', { name: 'Workspace' })).toContainElement(stages);
    expect(
      within(screen.getByRole('link', { name: 'WaterPilot home' }).closest('header')!).getByRole(
        'group',
        { name: 'Planning mode' },
      ),
    ).toBeInTheDocument();
    const links = within(stages).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['1Understand Your Area']);
    expect(stages.querySelectorAll('[aria-disabled="true"]')).toHaveLength(5);
    expect(within(stages).getByRole('link', { name: /Understand Your Area/i })).toHaveAttribute(
      'aria-current',
      'step',
    );
    expect(screen.getByText('Step 1 of 6', { selector: 'p:not(nav p)' })).toBeInTheDocument();
    expect(document.title).toBe('Understand your area · WaterPilot');
  });

  it('shows the signed-in navigation without Reports current while Review is open', async () => {
    const sessions = new FakeSessionServer();
    sessions.seed('user-1', {
      stage: 'REVIEW',
      areaId: 'area-1',
      baselineReviewed: true,
      goal: { kind: 'REDUCE_SHORTAGE' },
      selectedPlanOptionId: 'pln_saved',
    });
    await renderAt('/reports/review', new FakeAuthBackend(permanent()), sessions);
    const primary = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(primary).queryByRole('link', { name: 'Plan' })).not.toBeInTheDocument();
    expect(within(primary).getByRole('link', { name: 'Reports' })).not.toHaveAttribute(
      'aria-current',
    );
    const stages = await screen.findByRole('navigation', { name: 'Planning stages' });
    expect(within(stages).getByRole('link', { name: 'Take Action' })).toHaveAttribute(
      'aria-current',
      'step',
    );
  });

  it('hides the Reports and Communities links from guests', async () => {
    await renderPlan('/area');
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Reports' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Communities' })).not.toBeInTheDocument();
  });

  it('opens scenario testing as its own planning step', async () => {
    const { router } = await renderPlan('/scenarios', { stage: 'COMPARE' });
    expect(router.state.location.pathname).toBe('/scenarios');
    expect(await screen.findByRole('heading', { name: 'Test a Future Scenario' })).toBeVisible();
  });

  it('keeps the old /funding link working by redirecting to Make It Happen', async () => {
    const sessions = new FakeSessionServer();
    sessions.seed('user-1', {
      areaId: 'area-1',
      baselineReviewed: true,
      goal: { kind: 'REDUCE_SHORTAGE' },
      selectedPlanOptionId: 'pln_saved',
    });
    const router = await renderAt('/funding', new FakeAuthBackend(permanent()), sessions);
    expect(router.state.location.pathname).toBe('/make-it-happen');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Make it Happen' }),
    ).toBeInTheDocument();
  });

  it('opens implementation projects for a signed-in account and keeps guests out', async () => {
    await renderAt('/tracking', new FakeAuthBackend(permanent()));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Implementation projects' }),
    ).toBeInTheDocument();
  });

  it('moves focus to the new page heading after navigation', async () => {
    await renderPlan('/area', { stage: 'GOAL' });
    const stages = await screen.findByRole('navigation', { name: 'Planning stages' });
    fireEvent.click(within(stages).getByRole('link', { name: /goal/i }));
    const heading = await screen.findByRole('heading', {
      level: 1,
      name: 'What would you like to improve?',
    });
    expect(heading).toHaveFocus();
  });

  it('offers a skip link to the main landmark', async () => {
    await renderPlan('/area');
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

  it('lists Reports and Communities as top-level destinations for a signed-in account', async () => {
    await renderAt('/reports', new FakeAuthBackend(permanent()));
    const primary = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(primary).getByRole('link', { name: 'Reports' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(primary).getByRole('link', { name: 'Communities' })).toBeInTheDocument();
  });
});

describe('planning modes', () => {
  it('defaults to Traditional with the workspace only', async () => {
    await renderPlan('/area');
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
    fireEvent.click(
      screen.getByRole('radio', { name: /WaterPilot Agent: Plan with AI assistance/ }),
    );

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
    await renderPlan('/area', { mode: 'AGENT' });
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
    await renderPlan('/area', { mode: 'AGENT' });
    expect(screen.getByRole('separator')).toHaveAttribute(
      'aria-valuenow',
      String(AGENT_WIDTH.default),
    );
  });

  it('narrow Agent mode switches panes with tabs without remounting the workspace', async () => {
    await renderPlan('/area', { mode: 'AGENT' });
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
    await renderPlan('/area');
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
    await renderPlan('/goals', { mode: 'AGENT', stage: 'GOAL' });
    fireEvent.click(screen.getByRole('button', { name: 'Use Traditional mode' }));
    expect(screen.getByRole('radio', { name: /Explorer: Build your plan yourself/ })).toBeChecked();
    expect(screen.queryByRole('complementary', { name: 'Conversation' })).not.toBeInTheDocument();
  });
});

describe('corrected journey compatibility', () => {
  it('hides a direct baseline URL and unlocks scenarios without marking a baseline reviewed', async () => {
    const sessions = new FakeSessionServer();
    sessions.seed('guest-1', { areaId: 'area-1', baselineReviewed: false });
    const router = await renderAt('/baseline/overview', new FakeAuthBackend(guest()), sessions);
    await screen.findByRole('heading', { level: 1, name: 'Understand your area' });
    expect(router.state.location.pathname).toBe('/area');
    expect(screen.queryByRole('heading', { name: 'Your water baseline' })).not.toBeInTheDocument();
    const steps = screen.getByRole('navigation', { name: 'Planning stages' });
    expect(within(steps).getByRole('link', { name: 'Test a Future Scenario' })).toHaveAttribute(
      'href',
      '/scenarios',
    );
    expect(sessions.active('guest-1')?.baselineReviewed).toBe(false);
  });
  it.each([
    ['BASELINE', '/area'],
    ['BASELINE_INPUTS', '/area'],
    ['BASELINE_OVERVIEW', '/area'],
    ['SCENARIO', '/scenarios'],
    ['REVIEW', '/reports/review'],
    ['MAKE_IT_HAPPEN', '/make-it-happen'],
    ['TRACK', '/tracking'],
  ] as const)('recovers %s without creating another session', async (stage, path) => {
    expect(pathForSessionStage(stage)).toBe(path);
    const isBranch = stage === 'TRACK';
    // The optional branches belong to a signed-in account; the planner is open to guests.
    const uid = isBranch ? 'user-1' : 'guest-1';
    const sessions = new FakeSessionServer();
    sessions.seed(uid, {
      stage,
      mode: 'AGENT',
      areaId: 'area-1',
      baselineReviewed: true,
      goal: { kind: 'REDUCE_SHORTAGE' },
      selectedPlanOptionId: 'pln_saved',
    });
    const router = await renderAt(
      path,
      new FakeAuthBackend(isBranch ? permanent() : guest()),
      sessions,
    );
    expect(router.state.location.pathname).toBe(path);
    if (isBranch) {
      expect(screen.queryByRole('navigation', { name: 'Planning stages' })).not.toBeInTheDocument();
    } else {
      expect(sessionStageForPath(path)).toBe(stage.startsWith('BASELINE') ? 'UNDERSTAND' : stage);
      expect(screen.getByRole('navigation', { name: 'Planning stages' })).toBeInTheDocument();
      await screen.findByRole('radio', { name: /WaterPilot Agent: Plan with AI assistance/ });
    }
    expect(sessions.active(uid)?.stage).toBe(stage.startsWith('BASELINE') ? 'UNDERSTAND' : stage);
    expect(sessions.calls.filter((call) => call.startsWith('create'))).toEqual([]);
    expect(stageForPath('/reports/reviewer')).toBeNull();
    expect(stageForPath('/area-other')).toBeNull();
  });
});
