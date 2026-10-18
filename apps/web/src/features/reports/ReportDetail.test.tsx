import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { apiClient } from '../../lib/apiClient';
import { AuthTestProviders } from '../../test/AuthTestProviders';
import { FakeAuthBackend, permanent } from '../../test/fakeAuth';
import ReportDetailPage from './ReportDetail';

const originalAdapter = apiClient.defaults.adapter;
const adapter: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
  const body = JSON.parse(config.data as string) as { query: string };
  const op = /(?:query|mutation)\s+(\w+)/.exec(body.query)?.[1] ?? '';
  if (op !== 'Report') throw new Error(`unexpected operation ${op}`);
  return {
    data: {
      data: {
        report: {
          id: 'rpt_1',
          version: 1,
          title: 'Ward water plan',
          status: 'FINALIZED',
          sessionId: 'ses_1',
          communityId: null,
          areaId: 'are_1',
          planOptionId: 'opt_1',
          planName: 'Rainwater capture',
          finalizedAt: '2026-10-15T10:00:00Z',
          archivedAt: null,
          area: { id: 'are_1', name: 'Test ward', countryCode: 'IN' },
          impact: null,
          proposals: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
          goal: { id: 'goal_1', kind: 'REDUCE_TANKER_DEPENDENCE', description: 'Reduce tankers' },
          economics: null,
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

it('opens the authoritative finalized report after creation without suggesting a report PDF exists', async () => {
  render(
    <AuthTestProviders backend={new FakeAuthBackend(permanent())}>
      <MemoryRouter initialEntries={['/reports/rpt_1?created=1']}>
        <Routes>
          <Route path="/reports/:reportId" element={<ReportDetailPage />} />
        </Routes>
      </MemoryRouter>
    </AuthTestProviders>,
  );

  expect(await screen.findByRole('heading', { name: 'Report created' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Open report' })).toBeEnabled();
  expect(await screen.findByRole('heading', { name: 'Finalized snapshot' })).toBeVisible();
  expect(screen.getByText(/standalone report pdf export is not available/i)).toBeVisible();
  expect(screen.getByRole('link', { name: 'Prepare proposal' })).toHaveAttribute(
    'href',
    '/proposals/new?reportId=rpt_1',
  );
  expect(screen.getByRole('button', { name: 'Download PDF' })).toBeDisabled();
  fireEvent.click(screen.getByRole('tab', { name: 'Evidence' }));
  expect(
    await screen.findByText('No impact assessment was recorded in this report version.'),
  ).toBeVisible();
  fireEvent.click(screen.getByRole('tab', { name: 'Implementation' }));
  expect(
    await screen.findByRole('link', { name: 'Start a project from this report' }),
  ).toHaveAttribute('href', '/tracking/new?reportId=rpt_1');
  const originalScroll = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView');
  const scroll = vi.fn();
  Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: scroll });
  fireEvent.click(screen.getByRole('button', { name: 'Open report' }));
  await waitFor(() =>
    expect(screen.getByRole('heading', { name: 'Finalized snapshot' })).toHaveFocus(),
  );
  expect(scroll).toHaveBeenCalled();
  if (originalScroll) Object.defineProperty(Element.prototype, 'scrollIntoView', originalScroll);
  else Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
});
