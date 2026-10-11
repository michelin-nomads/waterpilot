import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AxiosError, type AxiosAdapter, type AxiosResponse } from 'axios';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ToastProvider } from '../../components/Toast/ToastProvider';
import type { JobFieldsFragment } from '../../graphql/generated/graphql';
import { apiClient } from '../../lib/apiClient';
import { routes } from '../../routes';
import { AuthTestProviders } from '../../test/AuthTestProviders';
import { FakeAuthBackend, guest } from '../../test/fakeAuth';
import { DisplayPreferencesProvider } from '../../theme/DisplayPreferencesProvider';
import {
  createEventParser,
  JobStreamError,
  mergeJobState,
  streamFailureOf,
  type JobStreamState,
  type StreamFailure,
} from './jobStream';
import { HEALTHY_STREAM_MS, MAX_STREAM_FAILURES, reconnectDelay } from './useJobProgress';

interface OpenStream {
  path: string;
  forceRefresh: boolean;
  push: (state: Partial<JobStreamState>) => void;
  end: () => void;
  fail: (kind?: StreamFailure) => void;
  signal: AbortSignal;
}

const streams: OpenStream[] = [];

vi.mock('./jobStream', async (importActual) => {
  const actual = await importActual<typeof import('./jobStream')>();
  return {
    ...actual,
    streamJobEvents: (
      path: string,
      onState: (state: JobStreamState) => void,
      signal: AbortSignal,
      options: { forceRefresh?: boolean } = {},
    ) =>
      new Promise<void>((resolve, reject) => {
        streams.push({
          path,
          signal,
          forceRefresh: options.forceRefresh ?? false,
          push: (state) => onState({ ...streamState(), ...state }),
          end: resolve,
          fail: (kind = 'transient') => reject(new actual.JobStreamError(kind)),
        });
        signal.addEventListener('abort', () => resolve());
      }),
  };
});

const JOB_ID = 'job_01J9Z8Y7X6W5V4T3S2R1Q0P9N8';

function job(overrides: Partial<JobFieldsFragment> = {}): JobFieldsFragment {
  return {
    __typename: 'Job',
    id: JOB_ID,
    version: 1,
    kind: 'PROPOSAL_GENERATION',
    status: 'QUEUED',
    stage: null,
    attempts: 0,
    maxAttempts: 3,
    errorCode: null,
    eventsPath: `/v1/jobs/${JOB_ID}/events`,
    updatedAt: '2026-10-10T06:00:00.000Z',
    ...overrides,
  } as JobFieldsFragment;
}

let current = 1;
function streamState(): JobStreamState {
  current += 1;
  return {
    id: JOB_ID,
    version: current,
    status: 'running',
    stage: 'started',
    attempts: 1,
    maxAttempts: 3,
    errorCode: null,
    updatedAt: '2026-10-10T06:00:05.000Z',
  };
}

type Reply = { data?: unknown; errors?: unknown[] } | Error;
let replies: Reply[] = [];
let jobRequests = 0;
const originalAdapter = apiClient.defaults.adapter;

const stubAdapter: AxiosAdapter = async (config) => {
  const body = typeof config.data === 'string' ? config.data : '';
  if (!body.includes('query Job(')) {
    return { data: { data: {} }, status: 200, statusText: 'OK', headers: {}, config };
  }
  jobRequests += 1;
  const reply = replies.length > 1 ? replies.shift()! : replies[0]!;
  if (reply instanceof Error) throw reply;
  return { data: reply, status: 200, statusText: 'OK', headers: {}, config };
};

beforeEach(() => {
  streams.length = 0;
  replies = [];
  jobRequests = 0;
  current = 1;
  apiClient.defaults.adapter = stubAdapter;
});

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
});

async function openJob(id = JOB_ID) {
  const router = createMemoryRouter(routes, { initialEntries: [`/jobs/${id}`] });
  render(
    <DisplayPreferencesProvider>
      <AuthTestProviders backend={new FakeAuthBackend(guest())}>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthTestProviders>
    </DisplayPreferencesProvider>,
  );
  await screen.findByRole('heading', { level: 1, name: 'Task progress' });
  return router;
}

describe('event stream parsing', () => {
  it('assembles events split across chunks and ignores comments', () => {
    const parse = createEventParser();
    expect(parse(': keep-alive\n\nevent: sta')).toEqual([]);
    expect(parse('te\r\ndata: {"a":1}\r\n\r\nevent: state\ndata: x\ndata: y\n\n')).toEqual([
      { event: 'state', data: '{"a":1}' },
      { event: 'state', data: 'x\ny' },
    ]);
  });

  it('merges newer states with uppercase enums and ignores stale or foreign ones', () => {
    const base = job({ version: 4 });
    const newer = { ...streamState(), version: 5, status: 'succeeded', stage: 'completed' };
    expect(mergeJobState(base, newer)).toMatchObject({ status: 'SUCCEEDED', version: 5 });
    expect(mergeJobState(base, { ...newer, version: 3 })).toBe(base);
    expect(mergeJobState(base, { ...newer, id: 'job_other' })).toBe(base);
  });
});

describe('stream failures', () => {
  it('classifies rejections, missing jobs and transient errors', () => {
    const http = (status: number) =>
      new AxiosError('x', 'E', undefined, undefined, {
        status,
      } as AxiosResponse);
    expect(streamFailureOf(http(401))).toBe('auth');
    expect(streamFailureOf(http(404))).toBe('gone');
    expect(streamFailureOf(http(403))).toBe('gone');
    expect(streamFailureOf(http(503))).toBe('transient');
    expect(streamFailureOf(new TypeError('network'))).toBe('transient');
    expect(streamFailureOf(new JobStreamError('gone'))).toBe('gone');
  });

  it('caps the reconnect delay', () => {
    expect([0, 1, 2, 3, 6, 20].map(reconnectDelay)).toEqual([
      0, 1_000, 2_000, 4_000, 30_000, 30_000,
    ]);
  });
});

describe('job progress page', () => {
  it('restores a job by the id in the URL and follows it live until it finishes', async () => {
    replies = [{ data: { job: job() } }];
    await openJob();
    expect(await screen.findByText('Waiting to start')).toBeInTheDocument();
    await waitFor(() => expect(streams).toHaveLength(1));
    expect(streams[0]!.path).toBe(`/v1/jobs/${JOB_ID}/events`);

    act(() => streams[0]!.push({ stage: 'rendering' }));
    expect(await screen.findByText('Preparing the document.')).toBeInTheDocument();
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.getByText('Live updates on.')).toBeInTheDocument();

    act(() => streams[0]!.push({ status: 'succeeded', stage: 'completed' }));
    expect(await screen.findByText('Finished')).toBeInTheDocument();
    await waitFor(() => expect(streams[0]!.signal.aborted).toBe(true));
    expect(screen.queryByText('Live updates on.')).not.toBeInTheDocument();
  });

  it('reconnects at once after a healthy stream, with backoff after a short one', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      replies = [{ data: { job: job({ status: 'RUNNING', stage: 'started', attempts: 1 }) } }];
      await openJob();
      await waitFor(() => expect(streams).toHaveLength(1));
      act(() => streams[0]!.push({ stage: 'rendering' }));
      await act(() => vi.advanceTimersByTimeAsync(HEALTHY_STREAM_MS));
      act(() => streams[0]!.end()); // the server's time cap
      await waitFor(() => expect(streams).toHaveLength(2));

      act(() => streams[1]!.end()); // closed at once: not healthy
      await act(() => vi.advanceTimersByTimeAsync(reconnectDelay(1) - 100));
      expect(streams).toHaveLength(2);
      await act(() => vi.advanceTimersByTimeAsync(200));
      await waitFor(() => expect(streams).toHaveLength(3));
    } finally {
      vi.useRealTimers();
    }
  });

  it('gives up streaming after a bounded number of failures and keeps polling', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      replies = [{ data: { job: job({ status: 'RUNNING', stage: 'started', attempts: 1 }) } }];
      await openJob();
      for (let i = 0; i < MAX_STREAM_FAILURES; i += 1) {
        await waitFor(() => expect(streams).toHaveLength(i + 1));
        act(() => streams[i]!.fail());
        await act(() => vi.advanceTimersByTimeAsync(reconnectDelay(i + 1)));
      }
      await act(() => vi.advanceTimersByTimeAsync(5 * 60_000));
      expect(streams).toHaveLength(MAX_STREAM_FAILURES);
      expect(screen.getByText(/live updates are unavailable/i)).toBeInTheDocument();
      expect(jobRequests).toBeGreaterThan(10); // polling every 5 s continued
    } finally {
      vi.useRealTimers();
    }
  });

  it('retries a rejected stream once with a refreshed token', async () => {
    replies = [{ data: { job: job({ status: 'RUNNING', stage: 'started', attempts: 1 }) } }];
    await openJob();
    await waitFor(() => expect(streams).toHaveLength(1));
    expect(streams[0]!.forceRefresh).toBe(false);
    act(() => streams[0]!.fail('auth'));
    await waitFor(() => expect(streams).toHaveLength(2));
    expect(streams[1]!.forceRefresh).toBe(true);
    act(() => streams[1]!.push({ stage: 'rendering' }));
    expect(await screen.findByText('Live updates on.')).toBeInTheDocument();
  });

  it('stops streaming and shows not-found when the job is gone for this account', async () => {
    replies = [
      { data: { job: job({ status: 'RUNNING', stage: 'started', attempts: 1 }) } },
      { errors: [{ message: 'job not found', extensions: { code: 'NOT_FOUND' } }] },
    ];
    await openJob();
    await waitFor(() => expect(streams).toHaveLength(1));
    act(() => streams[0]!.fail('gone'));
    expect(await screen.findByText('We could not find this task')).toBeInTheDocument();
    expect(streams).toHaveLength(1);
  });

  it('pauses while the tab is hidden and reconnects when it is shown again', async () => {
    replies = [{ data: { job: job({ status: 'RUNNING', stage: 'started', attempts: 1 }) } }];
    await openJob();
    await waitFor(() => expect(streams).toHaveLength(1));
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    try {
      act(() => document.dispatchEvent(new Event('visibilitychange')));
      expect(streams[0]!.signal.aborted).toBe(true);
      expect(await screen.findByText(/pause while this tab is in the background/i)).toBeVisible();
      hidden.mockReturnValue(false);
      act(() => document.dispatchEvent(new Event('visibilitychange')));
      await waitFor(() => expect(streams).toHaveLength(2));
    } finally {
      hidden.mockRestore();
    }
  });

  it.each(['succeeded', 'failed', 'cancelled'])(
    'stops listening once the job is %s',
    async (status) => {
      replies = [{ data: { job: job({ status: 'RUNNING', stage: 'started', attempts: 1 }) } }];
      await openJob();
      await waitFor(() => expect(streams).toHaveLength(1));
      act(() => streams[0]!.push({ status, stage: status === 'cancelled' ? null : 'completed' }));
      await waitFor(() => expect(streams[0]!.signal.aborted).toBe(true));
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(streams).toHaveLength(1);
      expect(screen.queryByText(/live updates/i)).not.toBeInTheDocument();
    },
  );

  it('falls back to polling with a stale notice when the stream fails', async () => {
    replies = [{ data: { job: job({ status: 'RUNNING', stage: 'started', attempts: 1 }) } }];
    await openJob();
    await waitFor(() => expect(streams).toHaveLength(1));
    act(() => streams[0]!.fail());
    expect(await screen.findByText(/live updates are unavailable/i)).toBeInTheDocument();
    const before = jobRequests;
    fireEvent.click(screen.getByRole('button', { name: 'Check now' }));
    await waitFor(() => expect(jobRequests).toBe(before + 1));
  });

  it('explains a proposal that cannot be produced yet without inventing a document', async () => {
    replies = [
      {
        data: {
          job: job({
            status: 'FAILED',
            stage: 'failed',
            attempts: 1,
            errorCode: 'SERVICE_UNAVAILABLE',
          }),
        },
      },
    ];
    await openJob();
    expect(await screen.findByText('Could not finish')).toBeInTheDocument();
    expect(screen.getByText(/cannot be produced in this version yet/i)).toBeInTheDocument();
    expect(screen.getByText('Attempt 1 of 3')).toBeInTheDocument();
    expect(streams).toHaveLength(0);
  });

  it('shows not-found for unknown or other accounts’ jobs', async () => {
    replies = [{ errors: [{ message: 'job not found', extensions: { code: 'NOT_FOUND' } }] }];
    await openJob('job_doesnotexist000000000000');
    expect(await screen.findByText('We could not find this task')).toBeInTheDocument();
  });

  it('offers retry when progress cannot load, then shows the job', async () => {
    replies = [new Error('Network Error'), { data: { job: job() } }];
    await openJob();
    expect(await screen.findByText('Task progress could not load')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('Waiting to start')).toBeInTheDocument();
  });
});
