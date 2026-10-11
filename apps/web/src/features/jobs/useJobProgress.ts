import { useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import {
  JobDocument,
  type JobFieldsFragment,
  type JobQuery,
  type JobStatus,
} from '../../graphql/generated/graphql';
import { useGraphQLQuery } from '../../graphql/hooks';
import { queryKeys } from '../../graphql/queryKeys';
import { usePageVisible } from '../../lib/pageVisibility';
import { mergeJobState, streamFailureOf, streamJobEvents } from './jobStream';

const TERMINAL: ReadonlySet<JobStatus> = new Set(['SUCCEEDED', 'FAILED', 'CANCELLED']);
export const POLL_INTERVAL_MS = 5_000;
/** A stream that stayed open this long before a clean end was healthy: reconnect at once. */
export const HEALTHY_STREAM_MS = 10_000;
/** Consecutive bad streams before giving up on streaming; polling continues meanwhile. */
export const MAX_STREAM_FAILURES = 5;
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_CAP_MS = 30_000;

export const reconnectDelay = (failures: number): number =>
  failures === 0 ? 0 : Math.min(RECONNECT_BASE_MS * 2 ** (failures - 1), RECONNECT_CAP_MS);

export const isTerminal = (status: JobStatus): boolean => TERMINAL.has(status);

/**
 * `live`: the event stream is connected. `polling`: the stream failed, so the job is
 * re-read every few seconds until it reconnects (or for good, once streaming gave up). `paused`: the tab is hidden. `done`:
 * the job reached a terminal state and nothing is listening any more.
 */
export type JobConnection = 'connecting' | 'live' | 'polling' | 'paused' | 'done';

export interface JobProgress {
  query: UseQueryResult<JobQuery>;
  job: JobFieldsFragment | null;
  connection: JobConnection;
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      window.clearTimeout(timer);
      resolve();
    });
  });

/**
 * Follow one durable job by id. The server owns the state, so a refresh or a new tab
 * restores the same job from its id: the GraphQL query loads it, then the event stream
 * keeps the cached copy current (polling when the stream is unavailable).
 *
 * Bounds: a clean end after a healthy stream (the server's time cap) reconnects at once;
 * any other end backs off exponentially (1 s to 30 s), and after `MAX_STREAM_FAILURES`
 * consecutive bad streams only polling continues. A rejected token is retried once with a
 * force-refreshed token; a job that is gone for this account stops the stream and
 * refetches, so the page shows not-found. Everything stops while the tab is hidden
 * (restarting fresh when it is shown) and once the job reaches any terminal status.
 */
export function useJobProgress(jobId: string): JobProgress {
  const client = useQueryClient();
  const query = useGraphQLQuery(queryKeys.jobs.detail(jobId), JobDocument, { id: jobId });
  const job = query.data?.job ?? null;
  const visible = usePageVisible();
  const [streamFailed, setStreamFailed] = useState(false);
  const [streaming, setStreaming] = useState(false);

  const eventsPath = job?.eventsPath ?? null;
  const terminal = job ? isTerminal(job.status) : false;

  useEffect(() => {
    if (!eventsPath || terminal || !visible) return;
    const controller = new AbortController();
    const { signal } = controller;
    const cacheKey = queryKeys.jobs.detail(jobId);
    void (async () => {
      let failures = 0;
      let refreshToken = false;
      while (!signal.aborted) {
        const opened = Date.now();
        let healthy = false;
        try {
          await streamJobEvents(
            eventsPath,
            (state) => {
              setStreaming(true);
              setStreamFailed(false);
              client.setQueryData<JobQuery>(cacheKey, (old) =>
                old?.job ? { job: mergeJobState(old.job, state) } : old,
              );
            },
            signal,
            { forceRefresh: refreshToken },
          );
          healthy = Date.now() - opened >= HEALTHY_STREAM_MS;
          refreshToken = false;
        } catch (error) {
          if (signal.aborted) return;
          const kind = streamFailureOf(error);
          if (kind === 'gone') {
            setStreamFailed(false);
            void client.invalidateQueries({ queryKey: cacheKey });
            return;
          }
          // One refreshed-token attempt per rejection; a second rejection is a failure.
          refreshToken = kind === 'auth' && !refreshToken;
        } finally {
          setStreaming(false);
        }
        const current = client.getQueryData<JobQuery>(cacheKey)?.job;
        if (signal.aborted || (current && isTerminal(current.status))) return;
        failures = healthy ? 0 : failures + 1;
        if (!healthy) setStreamFailed(true);
        if (failures >= MAX_STREAM_FAILURES) return;
        await sleep(refreshToken ? 0 : reconnectDelay(failures), signal);
      }
    })();
    return () => controller.abort();
  }, [client, jobId, eventsPath, terminal, visible]);

  const polling = streamFailed && !terminal && visible;
  const { refetch } = query;
  useEffect(() => {
    if (!polling) return;
    const timer = window.setInterval(() => void refetch(), POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [polling, refetch]);

  const connection: JobConnection = terminal
    ? 'done'
    : !visible
      ? 'paused'
      : polling
        ? 'polling'
        : streaming
          ? 'live'
          : 'connecting';
  return { query, job, connection };
}
