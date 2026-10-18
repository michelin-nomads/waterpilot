import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { Navigate, Outlet, useLocation, useOutletContext } from 'react-router-dom';

import { Icon } from '../../components/Icon/Icon';
import { Button } from '../../components/Button/Button';
import { ResizeHandle } from '../../components/ResizeHandle/ResizeHandle';
import { DESKTOP_QUERY, useMediaQuery } from '../../lib/useMediaQuery';
import { usePlanningSession } from '../../session/sessionContext';
import { PLANNING_STAGES, stageForPath, sessionStageForPath } from '../../shell/stages';
import { canOpenStage, unlockedStageIndex } from './stageAccess';
import { AgentPanel } from './AgentPanel';
import { AGENT_WIDTH, useAgentMaxWidth, useAgentWidth } from './agentWidth';
import { PlanExitGuard } from './PlanExitGuard';
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
  // Planning screens belong to a plan. Arriving without one (a reload, a pasted link) goes
  // back to the start; a plan that ends while the person is here (finalized, left on
  // purpose) must not bounce them, so only a plan that never existed redirects.
  const [hadPlan, setHadPlan] = useState(false);
  if (state.status === 'ready' && !hadPlan) setHadPlan(true);

  // The session remembers the step the user is on, so Continue resumes it anywhere. Only
  // this tab's navigation writes it; a step saved by another tab never pulls this one back.
  const requestedStage = stageForPath(pathname);
  const blockedStage =
    state.status === 'ready' &&
    requestedStage !== null &&
    !canOpenStage(requestedStage, state.server);
  const routeStage = blockedStage ? undefined : sessionStageForPath(pathname);
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
  const [agentCollapsed, setAgentCollapsed] = useState(false);
  const collapsed = split && agentCollapsed;
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
    ? ({ '--wp-agent-pane-width': `${paneWidth}px` } as CSSProperties)
    : undefined;

  if (state.status === 'none' && !hadPlan) return <Navigate to="/" replace />;

  if (blockedStage)
    return <Navigate to={PLANNING_STAGES[unlockedStageIndex(state.server)]!.path} replace />;

  return (
    <div className={styles.planning}>
      <PlanExitGuard />
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

      <div
        ref={panesRef}
        className={styles.panes}
        data-mode={mode}
        data-agent-collapsed={collapsed}
        style={panesStyle}
      >
        <aside
          className={styles.agentPane}
          {...paneProps('conversation')}
          hidden={!agentMode || (tabbed && pane !== 'conversation')}
        >
          <div
            id={`${id}-agent-content`}
            inert={collapsed}
            aria-hidden={collapsed || undefined}
            className={styles.agentContent}
          >
            <AgentPanel
              onCollapse={split ? () => setAgentCollapsed(true) : undefined}
              showScenario={false}
              onUseTraditional={() => setMode('traditional')}
              onFocusWorkspace={() => setPane('workspace')}
            />
          </div>
        </aside>
        {split ? (
          <div className={styles.resizeSlot} hidden={collapsed}>
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
          </div>
        ) : null}
        {collapsed && (
          <Button
            variant="secondary"
            size="sm"
            className={styles.expandButton}
            aria-label="Expand WaterPilot Agent"
            title="Expand WaterPilot Agent"
            aria-expanded={false}
            aria-controls={`${id}-agent-content`}
            onClick={() => setAgentCollapsed(false)}
          >
            <Icon name="chevrons-right" size="sm" />
          </Button>
        )}
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
