import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import { MemoryRouter, useLocation } from 'react-router-dom';

import { apiClient } from '../../lib/apiClient';
import { AuthTestProviders } from '../../test/AuthTestProviders';
import { FakeAuthBackend, guest, permanent } from '../../test/fakeAuth';
import { FakeSessionServer } from '../../test/fakeSession';
import ReviewPage from './Review';

let selectedPlanStatus: 'CURRENT' | 'IMPACT_CHANGED' = 'CURRENT';
let finalizationCalls = 0;
let fundingFailure = false;

const originalAdapter = apiClient.defaults.adapter;
const adapter: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
  const body = JSON.parse(config.data as string) as { query: string };
  const op = /(?:query|mutation)\s+(\w+)/.exec(body.query)?.[1] ?? '';
  if (op === 'FinalizeReport') {
    finalizationCalls += 1;
    throw new Error('Test save failure');
  }
  if (op === 'FundingMatches' && fundingFailure) throw new Error('Funding is unavailable');
  if (op === 'FundingMatches')
    return {
      data: {
        data: { fundingMatches: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } },
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    };
  if (op === 'AreaLocation' || op === 'AreaBaseline')
    return { data: { data: { area: null } }, status: 200, statusText: 'OK', headers: {}, config };
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
  finalizationCalls = 0;
  fundingFailure = false;
  apiClient.defaults.adapter = adapter;
});

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
});

function LocationIndicator() {
  const location = useLocation();
  return <output aria-label="Current path">{location.pathname}</output>;
}

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
      <MemoryRouter initialEntries={['/reports/review']}>
        <ReviewPage />
        <LocationIndicator />
      </MemoryRouter>
    </AuthTestProviders>,
  );
  return sessions;
}

describe('Review page', () => {
  it('lets a guest review but not finalize: finalizing needs a sign-in, offered here', async () => {
    renderReview('guest');
    await screen.findByRole('button', { name: 'Review Compare Plans' });
    expect(screen.getByText('Sign in to finalize and create your report.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Finalize report' })).toBeDisabled();
  });

  it('shows no sign-in prompt to a signed-in person', async () => {
    renderReview();
    await screen.findByRole('button', { name: 'Review Compare Plans' });
    expect(
      screen.queryByText('Sign in to finalize and create your report.'),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument();
  });

  it('shows the comparison name and current figures instead of its internal option ID', async () => {
    renderReview();
    expect(await screen.findByRole('button', { name: 'Review Compare Plans' })).toHaveTextContent(
      'Water-efficient fixtures',
    );
    const locationName = screen.getByRole('button', { name: 'Test ward' });
    expect(locationName).toBeVisible();
    expect(locationName).toHaveAccessibleDescription('Test ward');
    expect(
      screen.queryByRole('img', { name: /planning area illustration/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('opt_private_id')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Review Expected impact' }));
    expect(within(screen.getByRole('dialog')).getByText('30.0% → 15.0%')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Done reviewing' }));
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
  it('reviews saved goal, plan and evidence in a drawer without navigating or editing the session', async () => {
    const sessions = renderReview();
    await screen.findByRole('button', { name: 'Review Set Your Goal' });
    expect(
      screen.queryByRole('button', { name: 'Review Test a Future Scenario' }),
    ).not.toBeInTheDocument();
    const opener = screen.getByRole('button', { name: 'Review Set Your Goal' });
    opener.focus();
    fireEvent.click(opener);
    expect(screen.getByRole('dialog', { name: 'Set Your Goal' })).toBeVisible();
    expect(screen.getByText('Compare options without a numeric target')).toBeVisible();
    expect(screen.getByLabelText('Current path')).toHaveTextContent('/reports/review');
    fireEvent.click(screen.getByRole('button', { name: 'Done reviewing' }));
    await waitFor(() => expect(opener).toHaveFocus());
    fireEvent.click(screen.getByRole('button', { name: 'Review Compare Plans' }));
    expect(screen.getByRole('dialog', { name: 'Compare Plans' })).toBeVisible();
    expect(
      screen.getByText('No individual measure breakdown was returned for this plan.'),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Done reviewing' }));
    fireEvent.click(screen.getByRole('button', { name: 'Review Assumptions & evidence' }));
    expect(await screen.findByText('Costs use your own estimates.')).toBeVisible();
    expect(screen.getByText('Water savings have not been measured.')).toBeVisible();
    expect(sessions.calls.filter((c) => c.startsWith('update'))).toEqual([]);
  });

  it('keeps funding unknown when no declarations or matches are recorded', async () => {
    renderReview();
    fireEvent.click(await screen.findByRole('button', { name: 'Review Make it Happen' }));
    expect(
      await screen.findByText('No funding matches have been recorded for this selected plan.'),
    ).toBeVisible();
    expect(
      screen.getByText('No funding contributions have been declared for this plan.'),
    ).toBeVisible();
    expect(within(screen.getByRole('dialog')).queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Current path')).toHaveTextContent('/reports/review');
  });

  it('retains review access if the funding query fails', async () => {
    fundingFailure = true;
    renderReview();
    fireEvent.click(await screen.findByRole('button', { name: 'Review Make it Happen' }));
    expect(await screen.findByText('Funding opportunities could not load')).toBeVisible();
    expect(
      screen.getByText('No funding contributions have been declared for this plan.'),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Done reviewing' }));
    expect(screen.getByRole('button', { name: 'Finalize report' })).toBeEnabled();
  });

  it('asks for the report title in a same-path finalization drawer and preserves it after a save failure', async () => {
    renderReview();
    fireEvent.click(await screen.findByRole('button', { name: 'Finalize report' }));
    expect(screen.getByRole('dialog', { name: 'Finalize report' })).toBeVisible();
    fireEvent.change(screen.getByRole('textbox', { name: 'Report title' }), {
      target: { value: '  ' },
    });
    expect(screen.getByRole('button', { name: 'Finalize & save report' })).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: 'Report title' }), {
      target: { value: 'Our community plan' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Finalize & save report' }));
    expect(
      await screen.findByText(
        'The plan could not be finalized. Review any recent edits and try again.',
      ),
    ).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Report title' })).toHaveValue('Our community plan');
    expect(screen.getByLabelText('Current path')).toHaveTextContent('/reports/review');
    expect(finalizationCalls).toBe(1);
  });
  it('keeps area review compact and read-only', async () => {
    renderReview();
    fireEvent.click(await screen.findByRole('button', { name: 'Review Understand Your Area' }));
    const drawer = screen.getByRole('dialog');
    expect(await within(drawer).findByRole('heading', { name: 'Test ward' })).toBeVisible();
    expect(within(drawer).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(drawer).queryByRole('button', { name: /change area/i })).not.toBeInTheDocument();
    expect(within(drawer).queryByRole('table')).not.toBeInTheDocument();
  });
});
