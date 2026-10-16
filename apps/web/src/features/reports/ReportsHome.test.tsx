import { fireEvent, render, screen } from '@testing-library/react';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { apiClient } from '../../lib/apiClient';
import { AuthTestProviders } from '../../test/AuthTestProviders';
import { FakeAuthBackend, permanent } from '../../test/fakeAuth';
import ReportsPage from './index';

const originalAdapter = apiClient.defaults.adapter;
const adapter: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
  const body = JSON.parse(config.data as string) as { query: string };
  const op = /(?:query|mutation)\s+(\w+)/.exec(body.query)?.[1] ?? '';
  if (op !== 'Reports') throw new Error(`unexpected operation ${op}`);
  return {
    data: {
      data: {
        reports: {
          nodes: [
            {
              id: 'rpt_north',
              version: 1,
              title: 'North ward plan',
              status: 'FINALIZED',
              sessionId: 'ses_1',
              communityId: null,
              areaId: 'area_north',
              planOptionId: 'opt_1',
              planName: 'Rainwater capture',
              finalizedAt: '2026-10-15T10:00:00Z',
              archivedAt: null,
              area: { id: 'area_north', name: 'North Ward', countryCode: 'IN' },
              goal: {
                id: 'goal_1',
                kind: 'REDUCE_TANKER_DEPENDENCE',
                description: 'Fewer tankers',
              },
              economics: null,
            },
            {
              id: 'rpt_south',
              version: 1,
              title: 'South ward plan',
              status: 'FINALIZED',
              sessionId: 'ses_2',
              communityId: null,
              areaId: 'area_south',
              planOptionId: 'opt_2',
              planName: 'Leak repairs',
              finalizedAt: '2026-10-14T10:00:00Z',
              archivedAt: null,
              area: { id: 'area_south', name: 'South Ward', countryCode: 'IN' },
              goal: { id: 'goal_2', kind: 'REDUCE_BILLS', description: 'Lower bills' },
              economics: null,
            },
          ],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    },
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

it('lists report context and filters only the bounded loaded results', async () => {
  render(
    <AuthTestProviders backend={new FakeAuthBackend(permanent())}>
      <MemoryRouter initialEntries={['/reports']}>
        <Routes>
          <Route path="/reports" element={<ReportsPage />} />
        </Routes>
      </MemoryRouter>
    </AuthTestProviders>,
  );

  expect(
    await screen.findByRole('heading', { name: 'Your water planning workspace' }),
  ).toBeVisible();
  expect(screen.getByRole('navigation', { name: 'Planning workspace' })).toBeVisible();
  expect(screen.getByRole('link', { name: 'New report' })).toHaveAttribute('href', '/start');
  expect(await screen.findByText('North ward plan')).toBeVisible();
  expect(
    screen.getAllByRole('link', { name: 'Open report' }).map((link) => link.getAttribute('href')),
  ).toContain('/reports/rpt_north');
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search reports' }), {
    target: { value: 'South Ward' },
  });
  expect(await screen.findByText('South ward plan')).toBeVisible();
  expect(screen.queryByText('North ward plan')).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search reports' }), {
    target: { value: 'no such place' },
  });
  expect(
    await screen.findByRole('heading', { name: 'No reports match this search' }),
  ).toBeVisible();
});
