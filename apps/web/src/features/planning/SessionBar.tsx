import { useState } from 'react';

import { Button, ButtonLink } from '../../components/Button/Button';
import { Icon } from '../../components/Icon/Icon';
import { Notice } from '../../components/Notice/Notice';
import { Spinner } from '../../components/Spinner/Spinner';
import type { CoordinatorState } from '../../session/coordinator';
import { formatWhen } from '../../session/formatTime';
import { usePlanningSession } from '../../session/sessionContext';
import type { SessionField } from '../../session/sessionState';
import { dismissRestoredNotice, restoredNoticeDismissed } from '../../session/tabHints';
import styles from './SessionBar.module.scss';

const FIELD_LABEL: Record<SessionField, string> = {
  mode: 'planning mode',
  stage: 'step',
  areaId: 'location',
  goal: 'goal',
  scenario: 'what-if changes',
  selectedPlanOptionId: 'chosen plan',
};

function listFields(fields: readonly SessionField[]): string {
  const labels = fields.map((field) => FIELD_LABEL[field]);
  return labels.length > 1
    ? `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
    : (labels[0] ?? '');
}

/** "Changes saved" appears only after the server acknowledged the save. */
function SaveStatus({ state, onRetry }: { state: CoordinatorState; onRetry: () => void }) {
  const content = (() => {
    switch (state.save) {
      case 'saving':
        return (
          <>
            <Spinner size="sm" /> Saving…
          </>
        );
      case 'saved':
        return (
          <>
            <Icon name="check" size="sm" /> Changes saved
            {state.savedAt !== null && (
              <span className={styles.muted}> at {formatWhen(state.savedAt)}</span>
            )}
          </>
        );
      case 'offline':
        return (
          <>
            <Icon name="wifi-off" size="sm" /> Offline · changes kept on this device
          </>
        );
      case 'failed':
        return (
          <>
            <Icon name="alert-circle" size="sm" /> Not saved
            <Button variant="ghost" size="sm" startIcon="refresh" onClick={onRetry}>
              Try again
            </Button>
          </>
        );
      case 'conflict':
        return (
          <>
            <Icon name="alert" size="sm" /> Not saved · choose a version below
          </>
        );
      default:
        return null;
    }
  })();
  return (
    <p className={styles.status} role="status" data-save={state.save}>
      {content}
    </p>
  );
}

/**
 * Save status and the session notices for every planning stage: unsaved edits restored
 * from this device, a conflict with another tab or device, a plan replaced elsewhere, or
 * no plan yet.
 */
export function SessionBar() {
  const { coordinator, state, view } = usePlanningSession();
  const [, rerender] = useState(0);

  if (state.status === 'loading') {
    return (
      <p className={styles.status} role="status">
        <Spinner size="sm" /> Loading your plan…
      </p>
    );
  }

  if (!coordinator || state.status === 'none') {
    return (
      <Notice
        kind="info"
        announce={false}
        action={
          <ButtonLink to="/start" size="sm" endIcon="arrow-right">
            Start planning
          </ButtonLink>
        }
      >
        No plan in progress. Start one to save what you enter here.
        {state.message && <> {state.message}</>}
      </Notice>
    );
  }

  if (state.status === 'error') {
    return (
      <Notice
        kind="offline"
        action={
          <Button
            variant="ghost"
            size="sm"
            startIcon="refresh"
            onClick={() => void coordinator.reload()}
          >
            Try again
          </Button>
        }
      >
        {state.error ?? 'Your plan could not be loaded.'}
      </Notice>
    );
  }

  if (state.status === 'closed') {
    return (
      <Notice
        kind="archived"
        title="This plan is no longer the current one"
        action={
          <Button variant="secondary" size="sm" onClick={() => void coordinator.reload()}>
            Open current plan
          </Button>
        }
      >
        {state.message} Changes made here since then were not saved.
      </Notice>
    );
  }

  const restoredFrom = state.restoredFrom;
  const showRestored = restoredFrom !== null && !restoredNoticeDismissed(restoredFrom);

  return (
    <div className={styles.bar}>
      <SaveStatus state={state} onRetry={() => void coordinator.retry()} />
      {state.conflict && (
        <Notice
          kind="stale"
          title="This plan changed in another tab or on another device"
          action={
            <div className={styles.choices}>
              <Button size="sm" onClick={() => coordinator.resolveConflict('mine')}>
                Keep my changes
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => coordinator.resolveConflict('theirs')}
              >
                Use the saved version
              </Button>
            </div>
          }
        >
          Your {listFields(state.conflict.fields)} also changed there, saved at{' '}
          {formatWhen(state.conflict.theirs.updatedAt)}. Keep your changes to replace the saved
          ones, or use the saved version and discard yours. Everything else you changed is saved.
        </Notice>
      )}
      {state.offlineCopy && (
        <Notice kind="offline">
          WaterLens cannot reach the server, so you are seeing the copy of your plan saved on this
          device. Your changes will be saved when the connection returns.
        </Notice>
      )}
      {showRestored && view && (
        <Notice
          kind="restored"
          action={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                dismissRestoredNotice(restoredFrom);
                rerender((n) => n + 1);
              }}
            >
              Dismiss
            </Button>
          }
        >
          Restored your unsaved changes from {formatWhen(restoredFrom)}.
        </Notice>
      )}
      {state.message && !state.offlineCopy && state.save !== 'conflict' && (
        <p className={styles.message} role="alert">
          {state.message}
        </p>
      )}
    </div>
  );
}
