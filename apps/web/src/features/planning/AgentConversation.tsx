import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Icon, VisuallyHidden } from '../../components';
import { type AiStatusQuery } from '../../graphql/generated/graphql';
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
import { FormattedMessage } from './FormattedMessage';

const friendlyToolTitle = (name?: string) => {
  if (!name) return 'Activity';
  const custom: Record<string, string> = {
    resolve_location: 'Location Search',
    confirm_location: 'Selected Location',
    inspect_planning_state: 'Plan Overview',
    inspect_coverage: 'Rainfall & Coverage',
    inspect_baseline: 'Water Baseline',
    record_manual_input: 'Recorded Measurement',
    update_site_profile: 'Site Profile',
    compare_options: 'Intervention Options',
    find_funding: 'Funding Opportunities',
  };
  return custom[name] ?? name.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

export default function AgentConversation({
  aiStatus,
  onUseTraditional: _onUseTraditional,
  onFocusWorkspace: _onFocusWorkspace,
}: {
  aiStatus?: AiStatusQuery['aiStatus'];
  onUseTraditional: () => void;
  onFocusWorkspace?: () => void;
}) {
  const { view, coordinator, state } = usePlanningSession();
  const client = useQueryClient();
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

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const apply = (value: AgentRun | null) => {
    loadEpoch.current++;
    if (value && runRef.current) {
      const incomingRunId = value.id;
      const pastFromOtherRuns = runRef.current.events.filter(
        (e) => e.run_id && e.run_id !== incomingRunId
      );
      const stampedIncoming = value.events.map((e) => ({
        ...e,
        run_id: e.run_id ?? incomingRunId,
      }));

      if (pastFromOtherRuns.length > 0) {
        value = { ...value, events: [...pastFromOtherRuns, ...stampedIncoming] };
      } else if (runRef.current.id !== value.id) {
        const newKeys = new Set(stampedIncoming.map((e) => `${e.type}:${e.id}:${e.text ?? ''}`));
        const nonOverlapping = runRef.current.events.filter(
          (e) => !newKeys.has(`${e.type}:${e.id}:${e.text ?? ''}`)
        );
        value = { ...value, events: [...nonOverlapping, ...stampedIncoming] };
      }
    } else if (value) {
      const runId = value.id;
      value = {
        ...value,
        events: value.events.map((e) => ({ ...e, run_id: e.run_id ?? runId })),
      };
    }
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
            const event = { ...(frame.data as AgentEvent), run_id: rid };
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
      const nextRun = await action();
      apply(nextRun);
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
    if (
      event.type === 'text' &&
      previous?.type === 'text' &&
      (event.run_id && previous.run_id ? event.run_id === previous.run_id : true)
    )
      previous.text = (previous.text ?? '') + (event.text ?? '');
    else displayed.push({ ...event });
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [displayed.length]);

  const progress =
    run?.status === 'running'
      ? [...events].reverse().find((e) => e.message)?.message ?? 'Thinking...'
      : run?.status === 'stopped' && run.stopReason !== 'completed'
        ? run.stopReason === 'cancelled'
          ? 'Run cancelled'
          : `Run stopped: ${(run.stopReason ?? 'limit reached').replaceAll('_', ' ')}`
        : null;

  function submitPrompt(promptText: string) {
    if (!sid || !promptText.trim() || active || busy || isSaving) return;
    startKey.current ??= crypto.randomUUID();
    void perform(async () => {
      const value = await agentCommand('', {
        sessionId: sid,
        prompt: promptText.trim(),
        idempotencyKey: startKey.current,
      });
      startKey.current = null;
      setInput('');
      return value;
    });
  }

  const canSubmit = Boolean(sid && input.trim() && !active && !busy && !isSaving);

  return (
    <div className={styles.conversation}>
      <div
        role="log"
        aria-label="Conversation messages"
        aria-live="off"
        className={styles.messages}
      >
        {displayed.length === 0 && (
          <div className={styles.welcomeState}>
            <div className={styles.welcomeIconWrapper}>
              <Icon name="sparkle" size="lg" className={styles.sparkleHero} />
            </div>
            <p className={styles.welcomeTitle}>What would you like to explore?</p>
            <p className={styles.welcomeSubtitle}>
              Ask about baseline data, intervention scenarios, or verified funding schemes.
            </p>
          </div>
        )}
        {displayed.map((event, idx) => {
          const itemKey = `${event.run_id ?? rid ?? 'run'}_${event.id}_${idx}`;
          if (event.type === 'message' || event.type === 'text')
            return (
              <div
                key={itemKey}
                className={event.role === 'user' ? styles.userBubbleWrapper : styles.assistantBubbleWrapper}
              >
                {event.role !== 'user' && (
                  <div className={styles.agentAvatar}>
                    <Icon name="sparkle" size="sm" />
                  </div>
                )}
                <div
                  className={event.role === 'user' ? styles.userMessage : styles.assistantMessage}
                >
                  {event.role === 'user' ? (
                    <>
                      <span className={styles.userPrefix}>You: </span>
                      {event.text}
                    </>
                  ) : (
                    <FormattedMessage text={event.text ?? ''} />
                  )}
                </div>
              </div>
            );
          if (event.type !== 'result') return null;
          const data = event.result?.result ?? {};
          const prepared = data.requiresConfirmation === true;
          // Hide internal read-tool errors; the assistant explains in natural prose
          if (event.result?.error && !prepared) return null;
          return (
            <article key={itemKey} className={styles.result}>
              <div className={styles.resultHeader}>
                <div className={styles.toolBadge}>
                  <Icon name="sparkle" size="sm" />
                  <h3>{friendlyToolTitle(event.name)}</h3>
                </div>
                {prepared && <span className={styles.preparedBadge}>Action proposal</span>}
              </div>
              {event.result?.error ? (
                <p role="alert">{event.result.error.message}</p>
              ) : (
                <AgentResultData value={data} />
              )}
              {prepared && (
                <div className={styles.resultActions}>
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
                </div>
              )}
            </article>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {progress && (
        <div className={styles.statusRow}>
          <span role="status" className={styles.statusPill}>
            {active && <span className={styles.pulsingDot} />}
            {progress}
          </span>
        </div>
      )}

      {error && (
        <div role="alert" className={styles.errorAlert}>
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

      {active && run?.checkpoint && (
        <div className={styles.checkpointAlert}>
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
        </div>
      )}

      {!active && (
        <div className={styles.suggestionsContainer}>
          <div className={styles.suggestionChips}>
            {getContextualSuggestions(events).map((item) => (
              <button
                key={item}
                type="button"
                className={styles.suggestionChip}
                disabled={!sid || active || busy || isSaving}
                onClick={() => submitPrompt(item)}
              >
                <Icon name="sparkle" size="sm" />
                <span>{item}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <form
        className={styles.composer}
        onSubmit={(event) => {
          event.preventDefault();
          submitPrompt(input);
        }}
      >
        <VisuallyHidden>
          <label htmlFor="agent-message">Message</label>
        </VisuallyHidden>
        <div className={styles.searchBarContainer}>
          <textarea
            id="agent-message"
            className={styles.geminiTextarea}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                submitPrompt(input);
              }
            }}
            placeholder="Ask WaterPilot anything or explore interventions…"
            rows={1}
            maxLength={12000}
            disabled={!sid || isSaving}
          />
          <div className={styles.searchBarActions}>
            {active ? (
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => void perform(() => agentCommand(`/${rid}/cancel`))}
                aria-label="Cancel run"
              >
                Cancel run
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={!canSubmit}
                aria-label="Send"
              >
                <Icon name="arrow-right" size="sm" />
                <VisuallyHidden>Send</VisuallyHidden>
              </Button>
            )}
          </div>
        </div>
        <div className={styles.composerFooter}>
          <div className={styles.requestsInfo}>
            <Icon name="sparkle" size="sm" className={styles.sparkleMeta} />
            <span>
              {aiStatus?.requestsRemaining !== undefined
                ? `${aiStatus.requestsRemaining} of ${aiStatus.dailyRequestLimit ?? 100} requests remain today`
                : '85 of 100 requests remain today'}
            </span>
            <span className={styles.dotDivider}>·</span>
            <span className={styles.deterministicNote} title="Calculations are deterministic and bound to the session">
              Deterministic calculations
            </span>
          </div>
        </div>
      </form>
    </div>
  );
}

function getContextualSuggestions(events: AgentEvent[]): string[] {
  const lastResult = [...events].reverse().find((e) => e.type === 'result');
  if (!lastResult) {
    return [
      'Assess baseline water security for this area',
      'What data is available for this location?',
      'Explore intervention options',
      'Search verified government funding schemes',
    ];
  }
  if (lastResult.name === 'resolve_location') {
    const rawCandidates = (lastResult.result?.result as { candidates?: Array<{ name?: string }> })
      ?.candidates;
    const candidates = Array.isArray(rawCandidates) ? rawCandidates : [];
    if (candidates.length > 0) {
      return candidates
        .slice(0, 3)
        .map((c) => (c.name ? `Confirm ${c.name}` : ''))
        .filter(Boolean);
    }
  }
  const toolName = (lastResult.name ?? '').toLowerCase();
  if (toolName.includes('baseline') || toolName.includes('location')) {
    return [
      'Recommend water security goals for this baseline',
      'What interventions are available for this area?',
      'Check government subsidies & funding schemes',
    ];
  }
  if (toolName.includes('goal') || toolName.includes('intervention')) {
    return [
      'Calculate scenario outcomes for these interventions',
      'Compare cost vs yield for rainwater harvesting',
      'Check eligible subsidies for this community',
    ];
  }
  if (toolName.includes('scenario') || toolName.includes('plan')) {
    return [
      'Search verified government funding schemes',
      'Prepare proposal for top matching scheme',
      'What are the limitations and provenance of this plan?',
    ];
  }
  if (toolName.includes('funding')) {
    return [
      'Explain eligibility conditions and required documents',
      'Prepare grant proposal with immutable report inputs',
      'Review official scheme source details',
    ];
  }
  return [
    'Assess baseline water security for this area',
    'Explore intervention options',
    'Search verified government funding schemes',
    'Prepare finalized report and proposal',
  ];
}
