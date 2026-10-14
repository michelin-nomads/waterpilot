import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi, it, expect, beforeEach } from 'vitest';
import { PlanningSessionContext } from '../../session/sessionContext';
import type { PlanningSessionContextValue } from '../../session/sessionContext';
import AgentConversation from './AgentConversation';
import type { AgentRun, StreamFrame } from './agentTransport';

const transport = vi.hoisted(() => ({ fetch: vi.fn(), command: vi.fn(), stream: vi.fn() }));
vi.mock('./agentTransport', () => ({
  agentFetch: transport.fetch,
  agentCommand: transport.command,
  readAgentStream: transport.stream,
}));

let frame: ((value: StreamFrame) => Promise<void>) | undefined;
const run: AgentRun = {
  id: 'agr_1',
  sessionId: 'ses_1',
  version: 1,
  status: 'running',
  checkpoint: false,
  cursor: 1,
  events: [{ id: 1, type: 'message', role: 'user', text: 'Check rainfall' }],
};
const value = {
  view: { id: 'ses_1', version: 2, mode: 'AGENT' },
  coordinator: { refresh: vi.fn() },
  state: { status: 'ready', save: 'saved', server: { id: 'ses_1', version: 2 } },
} as unknown as PlanningSessionContextValue;
function mount() {
  const client = new QueryClient();
  const focus = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <PlanningSessionContext.Provider value={value}>
        <MemoryRouter>
          <AgentConversation onUseTraditional={vi.fn()} onFocusWorkspace={focus} />
        </MemoryRouter>
      </PlanningSessionContext.Provider>
    </QueryClientProvider>,
  );
  return { client, focus };
}
beforeEach(() => {
  vi.clearAllMocks();
  frame = undefined;
  transport.fetch.mockResolvedValue({ json: async () => null });
  transport.command.mockResolvedValue(run);
  transport.stream.mockImplementation(async (_rid, _cursor, signal: AbortSignal, listener) => {
    frame = listener;
    await new Promise<void>((resolve) =>
      signal.addEventListener('abort', () => resolve(), { once: true }),
    );
  });
});

it('can send after a saved edit, receives partial results, and focuses the authoritative workspace', async () => {
  const { focus } = mount();
  await waitFor(() => expect(transport.fetch).toHaveBeenCalled());
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Check rainfall' } });
  expect(screen.getByRole('button', { name: /^Send$/ })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: /^Send$/ }));
  await waitFor(() => expect(frame).toBeDefined());
  await act(async () =>
    frame!({ id: 2, event: 'text', data: { id: 2, type: 'text', text: 'Checking data' } }),
  );
  expect(screen.getByRole('log')).toHaveTextContent('Checking data');
  await act(async () =>
    frame!({
      id: 3,
      event: 'result',
      data: {
        id: 3,
        type: 'result',
        name: 'inspect_coverage',
        action: '/area',
        result: { result: { rainfall: 'unavailable' } },
      },
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Edit in workspace' }));
  expect(focus).toHaveBeenCalledOnce();
  expect(transport.command).toHaveBeenCalledOnce();
});

it('reconnects the same run, deduplicates events and invalidates only affected queries', async () => {
  transport.fetch.mockResolvedValue({ json: async () => run });
  const { client } = mount();
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  await waitFor(() => expect(frame).toBeDefined());
  expect(transport.stream).toHaveBeenCalledWith(
    'agr_1',
    1,
    expect.any(AbortSignal),
    expect.any(Function),
  );
  const event = { id: 2, type: 'invalidate', keys: [['session', 'ses_1']] };
  await act(async () => frame!({ id: 2, event: 'invalidate', data: event }));
  await act(async () => frame!({ id: 2, event: 'invalidate', data: event }));
  expect(invalidate).toHaveBeenCalledOnce();
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['session', 'ses_1'] });
  expect(transport.command).not.toHaveBeenCalled();
});

it('a delayed initial history load cannot erase a successfully started run', async () => {
  let finishLoad: ((value: unknown) => void) | undefined;
  transport.fetch.mockImplementation(
    () =>
      new Promise((resolve) => {
        finishLoad = resolve;
      }),
  );
  mount();
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Check rainfall' } });
  fireEvent.click(screen.getByRole('button', { name: /^Send$/ }));
  await waitFor(() => expect(screen.getByRole('log')).toHaveTextContent('You: Check rainfall'));
  await act(async () => finishLoad!({ json: async () => null }));
  expect(screen.getByRole('log')).toHaveTextContent('You: Check rainfall');
  expect(transport.command).toHaveBeenCalledOnce();
});
