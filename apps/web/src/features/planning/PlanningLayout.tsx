import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { Outlet, useLocation, useOutletContext } from 'react-router-dom';

import { ResizeHandle } from '../../components/ResizeHandle/ResizeHandle';
import { DESKTOP_QUERY, useMediaQuery } from '../../lib/useMediaQuery';
import { usePlanningSession } from '../../session/sessionContext';
import { sessionStageForPath } from '../../shell/stages';
import { AgentPanel } from './AgentPanel';
import { AGENT_WIDTH, useAgentMaxWidth, useAgentWidth } from './agentWidth';
import type { PlanningMode } from './planningMode';
import styles from './PlanningLayout.module.scss';
import { SessionBar } from './SessionBar';
import { StageNav } from './StageNav';

type Pane = 'conversation' | 'workspace';

const PANE_LABEL: Record<Pane, string> = { conversation: 'Conversation', workspace: 'Workspace' };

/**
 * Planning frame shared by every stage (ux-spec §4). Agent mode on desktop: resizable
 * conversation pane left, workspace right. Below the desktop breakpoint the two panes
 * become tabs, never two squeezed columns. The element tree keeps the same shape across
 * modes and breakpoints, so the workspace never remounts and loses state.
 */
export default function PlanningLayout() {
  const { planningMode: mode, setPlanningMode: setMode } = useOutletContext<{
    planningMode: PlanningMode;
    setPlanningMode: (mode: PlanningMode) => void;
  }>();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const { pathname } = useLocation();
  const { coordinator, state, view } = usePlanningSession();

  // The session remembers the step the user is on, so Continue resumes it anywhere. Only
  // this tab's navigation writes it; a step saved by another tab never pulls this one back.
  const routeStage = sessionStageForPath(pathname);
  const syncedRoute = useRef<string | null>(null);
  const sessionId = view?.id;
  const sessionStage = view?.stage;
  useEffect(() => {
    if (state.status !== 'ready' || !routeStage || !sessionId) return;
    const key = `${sessionId}:${routeStage}`;
    if (syncedRoute.current === key) return;
    syncedRoute.current = key;
    if (routeStage !== sessionStage) coordinator?.setStage(routeStage);
  }, [coordinator, state.status, routeStage, sessionId, sessionStage]);

  const id = useId();
  const panesRef = useRef<HTMLDivElement>(null);
  // The chosen pane is remembered per path, so navigating to a stage always shows its
  // workspace (derived during render, so focus management sees the visible heading).
  const [paneChoice, setPaneChoice] = useState<{ pane: Pane; path: string }>({
    pane: 'workspace',
    path: pathname,
  });
  const pane: Pane = paneChoice.path === pathname ? paneChoice.pane : 'workspace';
  const setPane = (next: Pane) => setPaneChoice({ pane: next, path: pathname });

  const agentMode = mode === 'agent';
  const tabbed = agentMode && !isDesktop;
  const split = agentMode && isDesktop;
  const [agentWidth, setAgentWidth] = useAgentWidth();
  const maxAgentWidth = useAgentMaxWidth(panesRef, split);
  const paneWidth = Math.min(agentWidth, maxAgentWidth);

  const tabId = (p: Pane) => `${id}-${p}-tab`;
  const panelId = (p: Pane) => `${id}-${p}-panel`;

  const onTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next: Pane =
      event.key === 'Home'
        ? 'conversation'
        : event.key === 'End'
          ? 'workspace'
          : pane === 'conversation'
            ? 'workspace'
            : 'conversation';
    setPane(next);
    document.getElementById(tabId(next))?.focus();
  };

  const paneProps = (p: Pane) =>
    tabbed
      ? { id: panelId(p), role: 'tabpanel', 'aria-labelledby': tabId(p), hidden: pane !== p }
      : { id: panelId(p), 'aria-label': PANE_LABEL[p] };

  // The pane width is a runtime value, so it is passed as a custom property.
  const panesStyle = split
    ? ({ '--wl-agent-pane-width': `${paneWidth}px` } as CSSProperties)
    : undefined;

  return (
    <div className={styles.planning}>
      {tabbed && (
        <div
          role="tablist"
          aria-label="Planning panes"
          className={styles.paneTabs}
          onKeyDown={onTabKeyDown}
        >
          {(['conversation', 'workspace'] as const).map((p) => (
            <button
              key={p}
              id={tabId(p)}
              type="button"
              role="tab"
              aria-selected={pane === p}
              aria-controls={panelId(p)}
              tabIndex={pane === p ? 0 : -1}
              className={styles.paneTab}
              onClick={() => setPane(p)}
            >
              {PANE_LABEL[p]}
            </button>
          ))}
        </div>
      )}

      <div ref={panesRef} className={styles.panes} data-mode={mode} style={panesStyle}>
        <aside
          className={styles.agentPane}
          {...paneProps('conversation')}
          hidden={!agentMode || (tabbed && pane !== 'conversation')}
        >
          <AgentPanel
            showScenario={routeStage === 'COMPARE'}
            onUseTraditional={() => setMode('traditional')}
            onFocusWorkspace={() => setPane('workspace')}
          />
        </aside>
        {split ? (
          <ResizeHandle
            value={paneWidth}
            min={AGENT_WIDTH.min}
            max={maxAgentWidth}
            defaultValue={AGENT_WIDTH.default}
            onChange={setAgentWidth}
            label="Resize conversation pane"
            valueText={(px) => `Conversation pane ${px} pixels wide`}
            controls={panelId('conversation')}
          />
        ) : null}
        <section className={styles.workspace} {...paneProps('workspace')}>
          <div className={styles.workspaceNav}>
            <StageNav />
          </div>
          <div className={styles.workspaceBody}>
            <SessionBar />
            <Outlet />
          </div>
        </section>
      </div>
    </div>
  );
}
