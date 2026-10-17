import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import { MemoryRouter } from 'react-router-dom';

import type { AiStatusQuery, AiUnavailableReason } from '../../graphql/generated/graphql';
import { apiClient } from '../../lib/apiClient';
import { AuthTestProviders } from '../../test/AuthTestProviders';
import { FakeAuthBackend, permanent } from '../../test/fakeAuth';
import { FakeSessionServer } from '../../test/fakeSession';
import { AgentPanel } from './AgentPanel';

type Handler = (variables: Record<string, unknown>) => unknown;
let handlers: Record<string, Handler> = {};
const originalAdapter = apiClient.defaults.adapter;

const stub: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
  const body = JSON.parse(config.data as string) as { query: string; variables: never };
  const op = /(?:query|mutation)\s+(\w+)/.exec(body.query)?.[1] ?? '';
  const handler = handlers[op];
  if (!handler) throw new Error(`unexpected operation ${op}`);
  const data: unknown = await handler(body.variables);
  return { data, status: 200, statusText: 'OK', headers: {}, config };
};

function aiStatus(over: Partial<AiStatusQuery['aiStatus']> = {}): { data: AiStatusQuery } {
  return {
    data: {
      aiStatus: {
        available: false,
        reason: 'DISABLED',
        modelId: 'gemini-2.5-flash',
        requestsRemaining: 100,
        dailyRequestLimit: 100,
        budgetConfigured: false,
        suggestedDailyBudgetUsd: '5',
        ...over,
      },
    },
  };
}

beforeEach(() => {
  handlers = { AiStatus: () => aiStatus() };
  apiClient.defaults.adapter = stub;
});

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
});

function renderPanel(onUseTraditional = () => undefined) {
  const sessions = new FakeSessionServer();
  // No goal and no location, so the deterministic checks stay quiet and only AI status loads.
  sessions.seed('user-1', { id: 'ses_1', inputsRevision: 1 });
  render(
    <AuthTestProviders backend={new FakeAuthBackend(permanent())} sessions={sessions}>
      <MemoryRouter>
        <AgentPanel onUseTraditional={onUseTraditional} />
      </MemoryRouter>
    </AuthTestProviders>,
  );
}

async function panel(state: string): Promise<HTMLElement> {
  return waitFor(() => {
    const el = document.querySelector(`[data-ai-status="${state}"]`);
    if (!el) throw new Error(`panel not in state ${state}`);
    return el as HTMLElement;
  });
}

describe('AgentPanel AI status fallback', () => {
  it('says AI is turned off when disabled, and the workspace stays available', async () => {
    const onUse = vi.fn();
    renderPanel(onUse);
    await panel('DISABLED');
    expect(screen.getByText(/turned off in this build/i)).toBeInTheDocument();
    // The workspace fallback is always offered.
    fireEvent.click(screen.getByRole('button', { name: /use traditional mode/i }));
    expect(onUse).toHaveBeenCalledTimes(1);
  });

  it('explains invite-only access', async () => {
    handlers.AiStatus = () => aiStatus({ reason: 'NOT_INVITED' as AiUnavailableReason });
    renderPanel();
    await panel('NOT_INVITED');
    expect(screen.getByText(/limited to invited testers/i)).toBeInTheDocument();
  });

  it('explains a used-up daily allowance', async () => {
    handlers.AiStatus = () => aiStatus({ reason: 'BUDGET_EXHAUSTED' as AiUnavailableReason });
    renderPanel();
    await panel('BUDGET_EXHAUSTED');
    expect(screen.getByText(/allowance is used up/i)).toBeInTheDocument();
  });

  it('explains when no budget is configured, naming the suggested amount', async () => {
    handlers.AiStatus = () =>
      aiStatus({
        reason: 'NO_BUDGET_CONFIGURED' as AiUnavailableReason,
        suggestedDailyBudgetUsd: '5',
      });
    renderPanel();
    await panel('NO_BUDGET_CONFIGURED');
    expect(screen.getByText(/no budget set/i)).toBeInTheDocument();
    expect(screen.getByText(/\$5/)).toBeInTheDocument();
  });

  it('reports availability with the model and remaining requests when AI is on', async () => {
    handlers.AiStatus = () =>
      aiStatus({ available: true, reason: null, budgetConfigured: true, requestsRemaining: 42 });
    renderPanel();
    await panel('available');
    expect(screen.getByText(/gemini-2\.5-flash/i)).toBeInTheDocument();
    expect(await screen.findByText(/42 of 100 requests/i)).toBeInTheDocument();
  });
});
