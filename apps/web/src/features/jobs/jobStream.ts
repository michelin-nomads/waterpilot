import axios from 'axios';

import type { ErrorCode, JobFieldsFragment, JobStatus } from '../../graphql/generated/graphql';
import { apiClient, getAuthToken } from '../../lib/apiClient';

/** One `event: state` payload from `GET /v1/jobs/{id}/events`. */
export interface JobStreamState {
  id: string;
  version: number;
  status: string;
  stage: string | null;
  attempts: number;
  maxAttempts?: number;
  errorCode: ErrorCode | null;
  updatedAt: string;
}

export type ServerEvent = { event: string; data: string };

/**
 * Incremental `text/event-stream` parser: feed decoded chunks, get complete events.
 * Handles events split across chunks and CRLF line endings; ignores comments.
 */
export function createEventParser(): (chunk: string) => ServerEvent[] {
  let buffer = '';
  return (chunk) => {
    buffer += chunk.replace(/\r\n/g, '\n');
    const events: ServerEvent[] = [];
    let end = buffer.indexOf('\n\n');
    while (end !== -1) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      let event = 'message';
      const data: string[] = [];
      for (const line of block.split('\n')) {
        if (line.startsWith(':')) continue;
        const [field, ...rest] = line.split(':');
        const value = rest.join(':').replace(/^ /, '');
        if (field === 'event') event = value;
        else if (field === 'data') data.push(value);
      }
      if (data.length > 0) events.push({ event, data: data.join('\n') });
      end = buffer.indexOf('\n\n');
    }
    return events;
  };
}

/** Merge a streamed state into the cached GraphQL job, ignoring out-of-order updates. */
export function mergeJobState(job: JobFieldsFragment, state: JobStreamState): JobFieldsFragment {
  if (state.id !== job.id || state.version < job.version) return job;
  return {
    ...job,
    version: state.version,
    status: state.status.toUpperCase() as JobStatus,
    stage: state.stage,
    attempts: state.attempts,
    maxAttempts: state.maxAttempts ?? job.maxAttempts,
    errorCode: state.errorCode,
    updatedAt: state.updatedAt,
  };
}

/**
 * Why a stream ended badly. `auth`: the token was rejected (retry once with a refreshed
 * token). `gone`: the job does not exist for this account; reconnecting cannot help.
 * `transient`: network or server trouble; retry with backoff.
 */
export type StreamFailure = 'auth' | 'gone' | 'transient';

export class JobStreamError extends Error {
  readonly kind: StreamFailure;

  constructor(kind: StreamFailure, message = `job stream failed (${kind})`) {
    super(message);
    this.name = 'JobStreamError';
    this.kind = kind;
  }
}

export function streamFailureOf(error: unknown): StreamFailure {
  if (error instanceof JobStreamError) return error.kind;
  const status = axios.isAxiosError(error) ? error.response?.status : undefined;
  if (status === 401) return 'auth';
  if (status === 403 || status === 404) return 'gone';
  return 'transient';
}

/**
 * Read the authenticated job event stream through the shared Axios client (fetch adapter,
 * so the body arrives incrementally) until the server closes it or `signal` aborts. The
 * server ends a stream at a terminal state or after its time cap; callers reconnect.
 * `forceRefresh` sends a freshly minted ID token, after the previous one was rejected.
 */
export async function streamJobEvents(
  eventsPath: string,
  onState: (state: JobStreamState) => void,
  signal: AbortSignal,
  options: { forceRefresh?: boolean } = {},
): Promise<void> {
  const headers: Record<string, string> = { Accept: 'text/event-stream' };
  if (options.forceRefresh) {
    const token = await getAuthToken({ forceRefresh: true });
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const response = await apiClient.get<ReadableStream<Uint8Array>>(eventsPath, {
    adapter: 'fetch',
    responseType: 'stream',
    timeout: 0,
    signal,
    headers,
  });
  const reader = response.data.getReader();
  const decoder = new TextDecoder();
  const parse = createEventParser();
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;
      for (const event of parse(decoder.decode(value, { stream: true }))) {
        if (event.event === 'error') throw new JobStreamError('gone');
        if (event.event === 'state') onState(JSON.parse(event.data) as JobStreamState);
      }
    }
  } finally {
    reader.releaseLock();
  }
}
