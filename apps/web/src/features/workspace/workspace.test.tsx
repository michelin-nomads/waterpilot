import { fireEvent, render, screen, within } from '@testing-library/react';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { apiClient } from '../../lib/apiClient';
import { routes } from '../../routes';
import { AuthTestProviders } from '../../test/AuthTestProviders';
import { FakeAuthBackend, guest, permanent } from '../../test/fakeAuth';
import { preloadLazyRoutes } from '../../test/preloadRoutes';
import { ToastProvider } from '../../components/Toast/ToastProvider';
import { DisplayPreferencesProvider } from '../../theme/DisplayPreferencesProvider';

beforeAll(() => preloadLazyRoutes(routes), 60_000);

function report(over: Record<string, unknown>): Record<string, unknown> & { area?: object } {
  return {
    version: 1,
    status: 'FINALIZED',
    sessionId: 'ses_1',
    communityId: null,
    planOptionId: 'opt_1',
    planName: 'Rainwater capture',
    archivedAt: null,
    goal: { id: 'goal_1', kind: 'REDUCE_SHORTAGE', description: 'Fewer tankers' },
    economics: null,
    ...over,
  };
}

const NORTH = report({
  id: 'rpt_north',
  title: 'North ward plan',
  areaId: 'area_north',
  finalizedAt: '2026-10-15T10:00:00Z',
  siteProfile: { communityType: 'APARTMENT', occupiedHomes: 120 },
  area: {
    id: 'area_north',
    name: 'North Ward',
    countryCode: 'IN',
    centroidLat: '12.93',
    centroidLon: '77.62',
    extent: 'USER_RADIUS',
    radiusMeters: 500,
    admin: { locality: 'Bengaluru' },
    boundaryBox: null,
  },
});
const SOUTH = report({
  id: 'rpt_south',
  title: 'South ward plan',
  areaId: 'area_south',
  finalizedAt: '2026-10-14T10:00:00Z',
  siteProfile: null,
  area: { ...NORTH.area, id: 'area_south', name: 'South Ward' },
});

const originalAdapter = apiClient.defaults.adapter;
let nodes: unknown[] = [];
const adapter: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
  const body = JSON.parse(config.data as string) as { query: string };
  const op = /(?:query|mutation)\s+(\w+)/.exec(body.query)?.[1] ?? '';
  if (op !== 'Reports') throw new Error(`unexpected operation ${op}`);
  return {
    data: { data: { reports: { nodes, pageInfo: { hasNextPage: false, endCursor: null } } } },
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  };
};

beforeEach(() => {
  apiClient.defaults.adapter = adapter;
});
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
});

function renderHome(backend = new FakeAuthBackend(permanent())) {
  const router = createMemoryRouter(routes, { initialEntries: ['/reports'] });
  render(
    <DisplayPreferencesProvider>
      <AuthTestProviders backend={backend}>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthTestProviders>
    </DisplayPreferencesProvider>,
  );
  return router;
}

describe('signed-in home', () => {
  it('lists each report with where, what kind, how big and when', async () => {
    nodes = [NORTH, SOUTH];
    renderHome();
    await screen.findByRole('heading', { level: 1, name: 'Your water planning workspace' });
    expect(screen.getByText('Manage your reports and community plans.')).toBeInTheDocument();
    const list = await screen.findByRole('list', { name: 'Reports' });
    const north = within(list).getByRole('heading', { name: 'North ward plan' }).closest('li')!;
    expect(within(north).getByText('North Ward, Bengaluru')).toBeInTheDocument();
    expect(within(north).getByText('Apartment community')).toBeInTheDocument();
    expect(within(north).getByText('120 occupied homes')).toBeInTheDocument();
    expect(within(north).getByText(/Finalized on/)).toBeInTheDocument();
    expect(within(north).getByText('Finalized')).toBeInTheDocument();
    // A report without a stated profile shows only what is known, never a made-up value.
    const south = within(list).getByRole('heading', { name: 'South ward plan' }).closest('li')!;
    expect(within(south).queryByText(/occupied home/)).not.toBeInTheDocument();
  });

  it('has no tab navigation: Reports is a page of its own with New report at the top right', async () => {
    nodes = [NORTH];
    renderHome();
    const title = await screen.findByRole('heading', {
      level: 1,
      name: 'Your water planning workspace',
    });
    expect(screen.queryByRole('navigation', { name: 'Workspace' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    const pageHeader = title.closest('header')!;
    expect(within(pageHeader).getByRole('button', { name: 'New report' })).toBeVisible();
    // The header links are the way between Reports and Communities.
    const primary = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(primary).getByRole('link', { name: 'Reports' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(primary).getByRole('link', { name: 'Communities' })).toBeVisible();
  });

  it('filters the loaded reports by search', async () => {
    nodes = [NORTH, SOUTH];
    renderHome();
    fireEvent.change(await screen.findByRole('searchbox', { name: 'Search reports' }), {
      target: { value: 'south' },
    });
    expect(await screen.findByText('South ward plan')).toBeVisible();
    expect(screen.queryByText('North ward plan')).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search reports' }), {
      target: { value: 'nowhere' },
    });
    expect(await screen.findByRole('heading', { name: 'No reports found' })).toBeVisible();
  });

  it('says "No reports found" when none have been created', async () => {
    nodes = [];
    renderHome();
    expect(await screen.findByRole('heading', { name: 'No reports found' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'New report' })).toBeVisible();
  });

  it('offers Explorer and WaterPilot Agent stacked in the New report dialog', async () => {
    nodes = [];
    renderHome();
    await screen.findByRole('heading', { name: 'No reports found' });
    fireEvent.click(screen.getByRole('button', { name: 'New report' }));
    const dialog = await screen.findByRole('dialog', { name: 'New report' });
    const choices = within(dialog).getAllByRole('button', { name: /Explorer|WaterPilot Agent/ });
    expect(choices.map((choice) => choice.textContent)).toEqual([
      expect.stringContaining('Explorer'),
      expect.stringContaining('WaterPilot Agent'),
    ]);
    expect(within(dialog).queryByText(/draft|in progress/i)).not.toBeInTheDocument();
  });

  it('is not available to guests', async () => {
    nodes = [NORTH];
    const router = renderHome(new FakeAuthBackend(guest()));
    await screen.findByRole('heading', { level: 1, name: 'Welcome to WaterPilot' });
    expect(router.state.location.pathname).toBe('/signin');
  });
});
