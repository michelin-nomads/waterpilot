import { vi, describe, it, expect, afterEach } from 'vitest';
import { setAuthTokenProvider } from '../../lib/authToken';
import { agentFetch, EventParser, readAgentStream } from './agentTransport';

afterEach(() => {
  vi.unstubAllGlobals();
  setAuthTokenProvider(async () => null);
});

describe('authenticated event stream', () => {
  it('parses split frames, multiline JSON and heartbeat without losing ordered IDs', () => {
    const parser = new EventParser();
    expect(parser.push(': heartbeat\n\nid: 1\nevent: text\ndata: {"text":')).toEqual([]);
    expect(
      parser.push('"rainfall"}\n\nid: 2\nevent: tool\ndata: {\ndata: "status":"running"}\n\n'),
    ).toEqual([
      { id: 1, event: 'text', data: { text: 'rainfall' } },
      { id: 2, event: 'tool', data: { status: 'running' } },
    ]);
  });
  it('refreshes a rejected token once in headers, retaining the same run and cursor', async () => {
    const provider = vi.fn(async (options?: { forceRefresh?: boolean }) =>
      options?.forceRefresh ? 'refreshed-secret' : 'old-secret',
    );
    setAuthTokenProvider(provider);
    const calls: Array<{ url: string; headers: Headers }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, headers: new Headers(init.headers) });
        return calls.length === 1
          ? new Response('', { status: 401 })
          : new Response('id: 8\nevent: text\ndata: {"text":"result"}\n\n', {
              headers: { 'content-type': 'text/event-stream' },
            });
      }),
    );
    const frames: unknown[] = [];
    await readAgentStream('agr_existing', 7, new AbortController().signal, async (frame) => {
      frames.push(frame);
    });
    expect(calls).toHaveLength(2);
    expect(calls.map((c) => c.headers.get('Last-Event-ID'))).toEqual(['7', '7']);
    expect(calls[1].headers.get('Authorization')).toBe('Bearer refreshed-secret');
    expect(
      calls.every((c) => !c.url.includes('secret') && c.url.endsWith('/agr_existing/events')),
    ).toBe(true);
    expect(frames).toHaveLength(1);
  });
  it('refuses signed-out requests without transmission', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(agentFetch('/session/ses_1')).rejects.toThrow('Sign in');
    expect(fetch).not.toHaveBeenCalled();
  });
});
