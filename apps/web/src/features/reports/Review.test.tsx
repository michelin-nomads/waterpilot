import { render, screen } from '@testing-library/react';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import { MemoryRouter } from 'react-router-dom';

import { apiClient } from '../../lib/apiClient';
import { AuthTestProviders } from '../../test/AuthTestProviders';
import { FakeAuthBackend, guest, permanent } from '../../test/fakeAuth';
import { FakeSessionServer } from '../../test/fakeSession';
import ReviewPage from './Review';

let selectedPlanStatus: 'CURRENT' | 'IMPACT_CHANGED' = 'CURRENT';
const originalAdapter = apiClient.defaults.adapter;
const adapter: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
  const body = JSON.parse(config.data as string) as { query: string };
  const op = /(?:query|mutation)\s+(\w+)/.exec(body.query)?.[1] ?? '';
  if (op !== 'PlanComparison') throw new Error(`unexpected operation ${op}`);
  return {
    data: {
      data: {
        planningSession: {
          id: 'ses_1',
          selectedPlanStatus,
          planComparison: {
            metric: 'TANKER_DEPENDENCE',
            unit: 'RATIO',
            baselineValue: { exact: '3/10', value: '0.3' },
            targetLevel: { exact: '3/20', value: '0.15' },
            assumptions: ['Costs use your own estimates.'],
            options: [
              {
                id: 'opt_private_id',
                name: 'Water-efficient fixtures',
                pessimistic: { exact: '0.1', value: '0.1' },
                optimistic: { exact: '0.05', value: '0.05' },
                cost: null,
                buildDays: null,
                firstBenefit: 'DURING_BUILD',
                waterLow: null,
                waterHigh: null,
                uncertainty: ['Water savings have not been measured.'],
              },
            ],
          },
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
  selectedPlanStatus = 'CURRENT';
  apiClient.defaults.adapter = adapter;
});

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
});

function renderReview(account: 'guest' | 'permanent' = 'permanent') {
  const sessions = new FakeSessionServer();
  sessions.seed(account === 'guest' ? 'guest-1' : 'user-1', {
    id: 'ses_1',
    areaId: 'are_1',
    areaName: 'Test ward',
    goal: { kind: 'REDUCE_TANKER_DEPENDENCE', description: '' },
    selectedPlanOptionId: 'opt_private_id',
    inputsRevision: 1,
  });
  render(
    <AuthTestProviders
      backend={new FakeAuthBackend(account === 'guest' ? guest() : permanent())}
      sessions={sessions}
    >
      <MemoryRouter>
        <ReviewPage />
      </MemoryRouter>
    </AuthTestProviders>,
  );
  return sessions;
}

describe('Review page', () => {
  it('lets a guest review but not finalize: finalizing needs a sign-in, offered here', async () => {
    renderReview('guest');
    await screen.findByRole('heading', { name: 'Water-efficient fixtures' });
    expect(screen.getByText('to finalize and create your report.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Finalize report' })).toBeDisabled();
  });

  it('shows no sign-in prompt to a signed-in person', async () => {
    renderReview();
    await screen.findByRole('heading', { name: 'Water-efficient fixtures' });
    expect(screen.queryByText('to finalize and create your report.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument();
  });

  it('shows the comparison name and current figures instead of its internal option ID', async () => {
    renderReview();
    expect(await screen.findByRole('heading', { name: 'Water-efficient fixtures' })).toBeVisible();
    expect(screen.getByText('Test ward')).toBeVisible();
    expect(screen.queryByText('opt_private_id')).not.toBeInTheDocument();
    expect(screen.getByText('30.0% → 15.0%')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Finalize report' })).toBeEnabled();
  });

  it('blocks saving when the selected plan impact is stale and links back to Compare', async () => {
    selectedPlanStatus = 'IMPACT_CHANGED';
    renderReview();
    expect(await screen.findByText(/review the current comparison before saving/i)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Return to Compare plans' })).toHaveAttribute(
      'href',
      '/plans',
    );
    expect(screen.queryByRole('button', { name: 'Finalize report' })).not.toBeInTheDocument();
  });
});
