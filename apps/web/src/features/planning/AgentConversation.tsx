import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { sessionStageForPath } from '../../shell/stages';
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
import { agentSuggestions } from './agentSuggestions';
import {
  useLocationInteraction,
  useLocationConfirmation,
  planningInteraction,
} from './planningInteraction';
import { AgentResultData } from './AgentResultData';
import { FormattedMessage } from './FormattedMessage';
import { LocationSearch } from '../location/LocationSearch';
import { usePlaces } from '../location/placesContext';
import { useLocationSelection } from './planningInteraction';
import { agentNavigation } from './agentNavigation';
import { stageForPath } from '../../shell/stages';

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
  onUseTraditional,
  onFocusWorkspace,
}: {
  aiStatus?: AiStatusQuery['aiStatus'];
  onUseTraditional: () => void;
  onFocusWorkspace?: () => void;
}) {
  const { view, coordinator, state } = usePlanningSession();
  const client = useQueryClient();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const pageStage = sessionStageForPath(pathname);
  const locationInteraction = useLocationInteraction(view?.id);
  const confirmSuggestedLocation = useLocationConfirmation(view?.id);
  const selectLocation = useLocationSelection(view?.id);
  const places = usePlaces();
  const [locationSearchOpen, setLocationSearchOpen] = useState(false);
  const [navigationMessage, setNavigationMessage] = useState<string | null>(null);
  const interaction = planningInteraction(
    state.server,
    pageStage,
    locationInteraction,
    state.status === 'ready' && !['idle', 'saved'].includes(state.save),
  );
  const suggestedLocation = interaction.location.status === 'suggested';
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
        (e) => e.run_id && e.run_id !== incomingRunId,
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
          (e) => !newKeys.has(`${e.type}:${e.id}:${e.text ?? ''}`),
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
      if (changed?.sessionId === sid) {
        void coordinator?.refresh();
        void client.invalidateQueries({ queryKey: ['session', sid, 'derived'] });
      }
      if (changed?.sessionId === sid && rid && runRef.current?.status === 'running') {
        void agentCommand(`/${rid}/workspace`).catch((err) => setError(err.message));
      }
    };
    window.addEventListener('waterpilot:workspace-edit', notify);
    return () => window.removeEventListener('waterpilot:workspace-edit', notify);
  }, [sid, rid, coordinator, client]);

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
              for (const rawKey of (event.keys ?? []) as (string[] | string)[]) {
                const key = Array.isArray(rawKey)
                  ? rawKey
                  : typeof rawKey === 'string'
                    ? rawKey.split(':')
                    : [rawKey];
                await client.cancelQueries({ queryKey: key });
                await client.invalidateQueries({ queryKey: key });
              }
              await coordinator?.refresh();
              const editPage: Record<string, string> = {
                set_goal: '/goals',
                confirm_location: '/area',
                set_area: '/area',
                update_community_baseline: '/baseline/inputs',
                select_option: '/reports/review',
                update_constraints: '/scenarios',
              };
              if (event.name && editPage[event.name]) navigate(editPage[event.name]);
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
  }, [rid, sid, retry, client, coordinator, navigate]);

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
    if (event.type !== 'text' && event.type !== 'message' && event.type !== 'result') {
      continue;
    }
    const previous = displayed.at(-1);
    if (
      event.type === 'text' &&
      previous?.type === 'text' &&
      (event.run_id && previous.run_id ? event.run_id === previous.run_id : true)
    ) {
      previous.text = (previous.text ?? '') + (event.text ?? '');
    } else if (
      event.type === 'message' &&
      previous?.type === 'message' &&
      event.role === previous.role &&
      event.text?.trim() === previous.text?.trim()
    ) {
      continue;
    } else {
      displayed.push({ ...event });
    }
  }

  const lastEdit = [...events].reverse().find((event) => event.type === 'invalidate' && event.name);
  const editAcknowledgments: Record<string, string> = {
    set_goal: 'Goal saved in the workspace.',
    update_site_profile: 'Community profile updated.',
    update_community_baseline: 'Baseline inputs updated. Dependent results are recalculated.',
    record_manual_input: 'Measurement recorded. Dependent results are recalculated.',
    update_constraints: 'Comparison constraints updated.',
    select_option: 'Plan selected for review.',
    confirm_location: 'Location confirmed.',
    set_area: 'Location updated.',
  };
  const progress =
    run?.status === 'running'
      ? ([...events].reverse().find((e) => e.message)?.message ?? 'Thinking...')
      : run?.status === 'stopped' && run.stopReason !== 'completed'
        ? run.stopReason === 'cancelled'
          ? 'Run cancelled'
          : `Run stopped: ${(run.stopReason ?? 'limit reached').replaceAll('_', ' ')}`
        : null;

  function submitPrompt(promptText: string) {
    if (!sid || !promptText.trim() || active || busy || isSaving) return;
    const navigation = agentNavigation(promptText, pathname, state.server);
    if (navigation) {
      setNavigationMessage(navigation.message);
      setInput('');
      if (navigation.path) navigate(navigation.path);
      return;
    }
    setNavigationMessage(null);
    startKey.current ??= crypto.randomUUID();
    void perform(async () => {
      await coordinator?.refresh();
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
              {state.server?.areaId
                ? 'Explore the next step for your saved plan. Missing evidence remains unknown.'
                : suggestedLocation
                  ? 'Your suggested location is ready on the right. Review it before continuing.'
                  : interaction.location.status === 'confirming'
                    ? 'Confirming your area and checking available data.'
                    : interaction.location.status === 'resolving'
                      ? 'Finding a location suggestion for you to review.'
                      : 'Start by choosing a location in the workspace. Then we can check available data.'}
            </p>
          </div>
        )}
        {displayed.map((event, idx) => {
          const itemKey = `${event.run_id ?? rid ?? 'run'}_${event.id}_${idx}`;
          if (event.type === 'message' || event.type === 'text')
            return (
              <div
                key={itemKey}
                className={
                  event.role === 'user' ? styles.userBubbleWrapper : styles.assistantBubbleWrapper
                }
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
              {prepared && (
                <div className={styles.resultHeader}>
                  <div className={styles.toolBadge}>
                    <Icon name="sparkle" size="sm" />
                    <h3>{friendlyToolTitle(event.name)}</h3>
                  </div>
                  {prepared && <span className={styles.preparedBadge}>Action proposal</span>}
                </div>
              )}
              {event.result?.error ? (
                <p role="alert">{event.result.error.message}</p>
              ) : prepared ? (
                <AgentResultData value={data} toolName={prepared ? undefined : event.name} />
              ) : (
                <details>
                  <summary className={styles.activitySummary}>
                    <Icon name="check" size="sm" />
                    <span>{friendlyToolTitle(event.name)}</span>
                  </summary>
                  <AgentResultData value={data} toolName={prepared ? undefined : event.name} />
                </details>
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
        {navigationMessage && (
          <div className={styles.assistantBubbleWrapper}>
            <div className={styles.agentAvatar}>
              <Icon name="sparkle" size="sm" />
            </div>
            <div className={styles.assistantMessage} role="status">
              {navigationMessage}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {!active && lastEdit?.name && editAcknowledgments[lastEdit.name] && (
        <p role="status">
          {editAcknowledgments[lastEdit.name]}{' '}
          <Button variant="ghost" onClick={onFocusWorkspace ?? onUseTraditional}>
            View change
          </Button>
        </p>
      )}
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
            size="sm"
            className={styles.sendButton}
            disabled={busy || isSaving}
            aria-label="Continue run"
            title="Continue run"
            onClick={() =>
              void perform(async () => {
                const latest: AgentRun = await (await agentFetch(`/${rid}`)).json();
                return agentCommand(`/${rid}/continue`, { version: latest.version });
              })
            }
          >
            <Icon name="play" size="sm" />
          </Button>
          <Button
            size="sm"
            variant="danger"
            className={styles.sendButton}
            disabled={busy || isSaving}
            aria-label="Stop chat"
            title="Stop chat"
            onClick={() => void perform(() => agentCommand(`/${rid}/cancel`))}
          >
            <Icon name="stop" size="sm" />
          </Button>
        </div>
      )}

      {(selectLocation ||
        !state.server?.areaId ||
        suggestedLocation ||
        interaction.location.status === 'resolving' ||
        interaction.location.status === 'confirming') && (
        <section className={styles.locationPrompt} aria-label="Location guidance">
          <Icon name="map" size="sm" />
          <div className={styles.locationPromptCopy}>
            <strong>
              {suggestedLocation
                ? 'Review location'
                : interaction.location.status === 'resolving'
                  ? 'Finding location…'
                  : interaction.location.status === 'confirming'
                    ? 'Confirming area…'
                    : state.server?.areaId
                      ? 'Selected location'
                      : 'Choose a location'}
            </strong>
            <p>
              {suggestedLocation
                ? (interaction.location.candidateName ?? 'Suggested location')
                : interaction.location.status === 'resolving'
                  ? 'Search or pick a point while we check.'
                  : interaction.location.status === 'confirming'
                    ? 'Saving your area and checking data.'
                    : (interaction.location.candidateName ??
                      state.server?.areaName ??
                      'Select an area to begin your assessment.')}
            </p>
            {suggestedLocation && <span>Check pin and radius.</span>}
          </div>
          <div className={styles.locationPromptActions}>
            {suggestedLocation && confirmSuggestedLocation && (
              <Button
                size="sm"
                className={styles.sendButton}
                onClick={confirmSuggestedLocation}
                disabled={active || busy}
                aria-label="Confirm area and check data"
                title="Confirm area and check data"
              >
                <Icon name="check" size="sm" />
              </Button>
            )}
          </div>
        </section>
      )}
      {locationSearchOpen && selectLocation && (
        <LocationSearch
          adapter={places}
          showHint={false}
          onSelect={(place) => {
            selectLocation(place);
            setLocationSearchOpen(false);
          }}
        />
      )}
      {!active && (
        <div className={styles.suggestionsContainer}>
          <div className={styles.suggestionChips}>
            {(['suggested', 'resolving', 'confirming'].includes(interaction.location.status)
              ? []
              : agentSuggestions(state.server, pageStage)
            ).map((item) => (
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
        <div className={styles.composerFooter} role="status">
          <span>{`Working on: ${stageForPath(pathname)?.label ?? 'your water plan'}`}</span>
          {isSaving && <span>Saving workspace changes…</span>}
        </div>
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
            placeholder={
              state.server?.areaId ? 'Ask about your current water plan…' : 'Ask about a location…'
            }
            rows={1}
            maxLength={12000}
            disabled={!sid || isSaving}
          />
          <div className={styles.searchBarActions}>
            {selectLocation && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={styles.sendButton}
                aria-label="Search another location"
                title="Search another location"
                aria-expanded={locationSearchOpen}
                disabled={active || busy}
                onClick={() => setLocationSearchOpen((open) => !open)}
              >
                <Icon name="search" size="sm" />
              </Button>
            )}
            {active ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className={styles.sendButton}
                disabled={busy}
                aria-label="Cancel run"
                title="Cancel run"
                onClick={() => void perform(() => agentCommand(`/${rid}/cancel`))}
              >
                <Icon name="close" size="sm" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="sm"
                className={styles.sendButton}
                disabled={!canSubmit}
                aria-label="Send"
                title="Send message (Enter)"
              >
                <Icon name="arrow-right" size="sm" />
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
                : 'Usage allowance unavailable'}
            </span>
            <span className={styles.dotDivider}>·</span>
            <span
              className={styles.deterministicNote}
              title="Calculations are deterministic and bound to the session"
            >
              Deterministic calculations
            </span>
          </div>
        </div>
      </form>
    </div>
  );
}
