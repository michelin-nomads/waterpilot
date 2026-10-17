import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button, Textarea } from '../../components';
import { usePlanningSession } from '../../session/sessionContext';
import {
  agentCommand,
  agentFetch,
  readAgentStream,
  type AgentRun,
  type AgentEvent,
} from './agentTransport';
import styles from './AgentPanel.module.scss';
import { AgentResultData } from './AgentResultData';

export default function AgentConversation({
  onUseTraditional,
  onFocusWorkspace,
}: {
  onUseTraditional: () => void;
  onFocusWorkspace?: () => void;
}) {
  const { view, coordinator, state } = usePlanningSession();
  const client = useQueryClient();
  const navigate = useNavigate();
  const sid = view?.id;
  const [run, setRun] = useState<AgentRun | null>(null);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const cursor = useRef(0);
  const loadEpoch = useRef(0);
  const runRef = useRef<AgentRun | null>(null);
  const startKey = useRef<string | null>(null);
  const lastVersion = useRef<number | null>(null);
  const isSaving = state.status === 'ready' && !['idle', 'saved'].includes(state.save);
  const apply = (value: AgentRun | null) => {
    loadEpoch.current++;
    runRef.current = value;
    cursor.current = value?.cursor ?? 0;
    setRun(value);
  };

  useEffect(() => {
    const control = new AbortController();
    apply(null);
    const epoch = loadEpoch.current;
    lastVersion.current = null;
    startKey.current = null;
    if (sid)
      void agentFetch(`/session/${sid}`, { signal: control.signal })
        .then((r) => r.json())
        .then((value) => {
          if (!control.signal.aborted && loadEpoch.current === epoch) {
            apply(value);
            setError(null);
          }
        })
        .catch((err) => {
          if (!control.signal.aborted && loadEpoch.current === epoch) setError(String(err.message));
        });
    return () => control.abort();
  }, [sid]);

  const rid = run?.id;
  useEffect(() => {
    const notify = (event: Event) => {
      const changed = (event as CustomEvent<{ sessionId: string }>).detail;
      if (changed?.sessionId === sid) void coordinator?.refresh();
      if (changed?.sessionId === sid && rid && runRef.current?.status === 'running') {
        void agentCommand(`/${rid}/workspace`).catch((err) => setError(err.message));
      }
    };
    window.addEventListener('waterpilot:workspace-edit', notify);
    return () => window.removeEventListener('waterpilot:workspace-edit', notify);
  }, [sid, rid, coordinator]);
  useEffect(() => {
    if (!rid || !sid) return;
    const control = new AbortController();
    const runLoop = async () => {
      let attempts = 0;
      while (
        !control.signal.aborted &&
        runRef.current?.status === 'running' &&
        !runRef.current?.checkpoint
      ) {
        try {
          await readAgentStream(rid, cursor.current, control.signal, async (frame) => {
            if (control.signal.aborted) return;
            if (frame.event === 'state' || frame.event === 'reset') {
              apply(frame.data as AgentRun);
              if (frame.event === 'reset') await coordinator?.refresh();
              await client.invalidateQueries({ queryKey: ['ai', 'status'] });
              return;
            }
            const event = frame.data as AgentEvent;
            if (frame.id === null || frame.id <= cursor.current) return;
            if (frame.id !== cursor.current + 1)
              throw new Error('Event gap; reconnecting to saved results');
            cursor.current = frame.id;
            const current = runRef.current;
            if (!current) return;
            const next = {
              ...current,
              events: [...current.events, event].slice(-200),
              cursor: frame.id,
            };
            runRef.current = next;
            setRun(next);
            if (event.type === 'invalidate') {
              for (const key of event.keys ?? []) {
                await client.cancelQueries({ queryKey: key });
                await client.invalidateQueries({ queryKey: key });
              }
              await coordinator?.refresh();
            }
          });
          attempts = 0;
          if (!control.signal.aborted) setError(null);
        } catch (err) {
          if (control.signal.aborted) return;
          setError(err instanceof Error ? err.message : 'Disconnected');
          if (++attempts >= 3) return;
        }
        if (!control.signal.aborted)
          await new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, 1000 * Math.max(1, attempts));
            control.signal.addEventListener(
              'abort',
              () => {
                clearTimeout(timer);
                resolve();
              },
              { once: true },
            );
          });
      }
    };
    void runLoop();
    return () => control.abort();
  }, [rid, sid, retry, client, coordinator]);

  useEffect(() => {
    const version = state.status === 'ready' ? state.server?.version : undefined;
    if (version === undefined) return;
    if (
      lastVersion.current !== null &&
      lastVersion.current !== version &&
      rid &&
      runRef.current?.status === 'running'
    ) {
      void agentCommand(`/${rid}/workspace`).catch((err) => setError(err.message));
    }
    lastVersion.current = version;
  }, [state, rid]);

  async function perform(action: () => Promise<AgentRun>) {
    loadEpoch.current++;
    setBusy(true);
    setError(null);
    try {
      apply(await action());
      setRetry((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversation failed');
    } finally {
      setBusy(false);
    }
  }
  const active = run?.status === 'running';
  const events = run?.events ?? [];
  const displayed: AgentEvent[] = [];
  for (const event of events) {
    const previous = displayed.at(-1);
    if (event.type === 'text' && previous?.type === 'text')
      previous.text = (previous.text ?? '') + (event.text ?? '');
    else displayed.push({ ...event });
  }
  const progress =
    run?.status === 'completed'
      ? 'Completed'
      : run?.status === 'stopped'
        ? run.stopReason === 'cancelled'
          ? 'Run cancelled'
          : `Run stopped: ${(run.stopReason ?? 'limit reached').replaceAll('_', ' ')}`
        : [...events].reverse().find((e) => e.message)?.message;
  return (
    <div className={styles.conversation}>
      <p>Local demonstration · fake inference</p>
      <div
        role="log"
        aria-label="Conversation messages"
        aria-live="off"
        className={styles.messages}
      >
        {displayed.map((event) => {
          if (event.type === 'message' || event.type === 'text')
            return (
              <p
                key={event.id}
                className={event.role === 'user' ? styles.userMessage : styles.assistantMessage}
              >
                {event.role === 'user' ? 'You: ' : ''}
                {event.text}
              </p>
            );
          if (event.type !== 'result') return null;
          const data = event.result?.result ?? {};
          const prepared = data.requiresConfirmation === true;
          return (
            <article key={event.id} className={styles.result}>
              <h3>{event.name?.replaceAll('_', ' ')}</h3>
              {event.result?.error ? (
                <p role="alert">{event.result.error.message}</p>
              ) : (
                <AgentResultData value={data} />
              )}
              <Button
                variant="secondary"
                onClick={() => {
                  navigate(event.action ?? '/area');
                  onFocusWorkspace?.();
                  requestAnimationFrame(() =>
                    document.querySelector<HTMLElement>('main h1, h1')?.focus(),
                  );
                }}
              >
                Edit in workspace
              </Button>
              {prepared && (
                <Button
                  disabled={busy}
                  onClick={() => {
                    const { kind, resourceId, expectedVersion, parameters, confirmationToken } =
                      data;
                    void perform(async () => {
                      const confirmation = await agentFetch(`/${rid}/confirm`, {
                        method: 'POST',
                        body: JSON.stringify({
                          kind,
                          resource_id: resourceId,
                          expected_version: expectedVersion,
                          parameters,
                          confirmation_token: confirmationToken,
                          idempotency_key: `confirm-${rid}-${event.id}`,
                        }),
                      });
                      const confirmed: { keys: string[][] } = await confirmation.json();
                      for (const queryKey of confirmed.keys) {
                        await client.cancelQueries({ queryKey });
                        await client.invalidateQueries({ queryKey });
                      }
                      await coordinator?.refresh();
                      return (await agentFetch(`/${rid}`)).json();
                    });
                  }}
                >
                  Confirm: {String(data.summary ?? data.kind)}
                </Button>
              )}
            </article>
          );
        })}
      </div>
      <p role="status">{progress ?? 'Ask about the current planning session'}</p>
      {error && (
        <div role="alert">
          <p>{error}</p>
          <Button
            variant="secondary"
            onClick={() => {
              if (rid) {
                void agentFetch(`/${rid}`)
                  .then((r) => r.json())
                  .then((value) => {
                    apply(value);
                    setRetry((n) => n + 1);
                  })
                  .catch((err) => setError(err.message));
              } else if (sid) {
                void agentFetch(`/session/${sid}`)
                  .then((r) => r.json())
                  .then((value) => {
                    apply(value);
                    setError(null);
                    setRetry((n) => n + 1);
                  })
                  .catch((err) => setError(err.message));
              }
            }}
          >
            Retry connection
          </Button>
        </div>
      )}
      {active && (
        <Button
          disabled={busy}
          variant="secondary"
          onClick={() => void perform(() => agentCommand(`/${rid}/cancel`))}
        >
          Cancel run
        </Button>
      )}
      {active && run?.checkpoint && (
        <Button
          disabled={busy || isSaving}
          onClick={() =>
            void perform(async () => {
              const latest: AgentRun = await (await agentFetch(`/${rid}`)).json();
              return agentCommand(`/${rid}/continue`, { version: latest.version });
            })
          }
        >
          Continue
        </Button>
      )}
      <form
        className={styles.composer}
        onSubmit={(event) => {
          event.preventDefault();
          if (!sid || !input.trim() || active || busy || isSaving) return;
          startKey.current ??= crypto.randomUUID();
          void perform(async () => {
            const value = await agentCommand('', {
              sessionId: sid,
              prompt: input.trim(),
              idempotencyKey: startKey.current,
            });
            startKey.current = null;
            setInput('');
            return value;
          });
        }}
      >
        <label htmlFor="agent-message">Message</label>
        <Textarea
          id="agent-message"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          maxLength={12000}
          rows={3}
        />
        <Button type="submit" disabled={!sid || active || busy || isSaving || !input.trim()}>
          Send
        </Button>
      </form>
      <Button variant="secondary" onClick={onUseTraditional}>
        Open normal mode
      </Button>
    </div>
  );
}
