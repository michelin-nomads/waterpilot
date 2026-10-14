import { env } from '../../config/env';
import { getAuthToken } from '../../lib/authToken';

export interface AgentEvent {
  id: number;
  type: string;
  text?: string;
  role?: string;
  message?: string;
  name?: string;
  status?: string;
  action?: string;
  result?: {
    result?: Record<string, unknown>;
    requiresConfirmation?: boolean;
    error?: { message: string };
  };
  keys?: unknown[][];
}
export interface AgentRun {
  id: string;
  sessionId: string;
  version: number;
  status: string;
  stopReason?: string | null;
  checkpoint: boolean;
  events: AgentEvent[];
  cursor: number;
}
export const agentPath = '/v1/agent-conversations';

/** Token in Authorization only. Retry one rejection with a fresh Firebase ID token. */
export async function agentFetch(path: string, init: RequestInit = {}): Promise<Response> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await getAuthToken({ forceRefresh: attempt === 1 });
    if (!token) throw new Error('Sign in to continue');
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    if (init.body) headers.set('Content-Type', 'application/json');
    const response = await fetch(`${env.apiBaseUrl}${agentPath}${path}`, {
      ...init,
      headers: Object.fromEntries(headers.entries()),
      cache: 'no-store',
    });
    if (response.status === 401 && attempt === 0) continue;
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.detail?.message ?? 'Conversation connection failed');
    }
    return response;
  }
  throw new Error('Authentication refresh failed');
}
export async function agentCommand(path: string, body?: unknown): Promise<AgentRun> {
  return (await agentFetch(path, { method: 'POST', body: JSON.stringify(body ?? {}) })).json();
}

export interface StreamFrame {
  event: string;
  id: number | null;
  data: unknown;
}
/** Incremental parser: UTF-8 is decoded by the caller; comments never become events. */
export class EventParser {
  private buffer = '';
  push(chunk: string): StreamFrame[] {
    this.buffer += chunk;
    this.buffer = this.buffer.replace(/\r\n/g, '\n');
    if (this.buffer.length > 1024 * 1024) throw new Error('Stream frame too large');
    const frames: StreamFrame[] = [];
    let end: number;
    while ((end = this.buffer.indexOf('\n\n')) >= 0) {
      const block = this.buffer.slice(0, end);
      this.buffer = this.buffer.slice(end + 2);
      let event = 'message';
      let id: number | null = null;
      const data: string[] = [];
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        if (line.startsWith('id:')) id = Number(line.slice(3).trim());
        if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
      }
      if (data.length) frames.push({ event, id, data: JSON.parse(data.join('\n')) });
    }
    return frames;
  }
}
export async function readAgentStream(
  runId: string,
  cursor: number,
  signal: AbortSignal,
  onFrame: (frame: StreamFrame) => Promise<void>,
): Promise<void> {
  const response = await agentFetch(`/${runId}/events`, {
    headers: { 'Last-Event-ID': String(cursor), Accept: 'text/event-stream' },
    signal,
  });
  if (!response.body) throw new Error('Event stream unavailable');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const parser = new EventParser();
  try {
    while (!signal.aborted) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          void reader.cancel();
          reject(new Error('Connection idle; reconnect to this run'));
        }, 25000);
      });
      let next: ReadableStreamReadResult<Uint8Array>;
      try {
        next = await Promise.race([reader.read(), timeout]);
      } finally {
        clearTimeout(timer);
      }
      if (next.done) return;
      for (const frame of parser.push(decoder.decode(next.value, { stream: true })))
        await onFrame(frame);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}
