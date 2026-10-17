import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Badge } from '../../components/Badge/Badge';
import { Dialog } from '../../components/Dialog/Dialog';
import { Icon } from '../../components/Icon/Icon';
import { Spinner } from '../../components/Spinner/Spinner';
import { useOnlineStatus } from '../../lib/useOnlineStatus';
import { usePlanningSession } from '../../session/sessionContext';
import { pathForSessionStage } from '../../shell/stages';
import {
  PLANNING_MODE_OPTIONS,
  toSessionMode,
  usePreferredPlanningMode,
  type PlanningMode,
} from '../planning/planningMode';
import styles from './Workspace.module.scss';

interface NewReportDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * "New report": choose how to plan, Explorer or Copilot, stacked one above the other.
 * Choosing starts the plan straight away; there is no draft to continue or replace.
 */
export function NewReportDialog({ open, onClose }: NewReportDialogProps) {
  const { newReport } = usePlanningSession();
  const online = useOnlineStatus();
  const navigate = useNavigate();
  const [, setPreferredMode] = usePreferredPlanningMode();
  const [starting, setStarting] = useState<PlanningMode | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = async (mode: PlanningMode) => {
    if (starting || !online) return;
    setStarting(mode);
    setError(null);
    try {
      setPreferredMode(mode);
      const started = await newReport(toSessionMode(mode));
      onClose();
      navigate(pathForSessionStage(started.stage));
    } catch {
      setError('A new report could not be started. Check your connection and try again.');
    } finally {
      setStarting(null);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!starting) onClose();
      }}
      title="New report"
      description="How do you want to plan?"
      size="sm"
    >
      <ul className={styles.modes}>
        {PLANNING_MODE_OPTIONS.map((option) => (
          <li key={option.id}>
            <button
              type="button"
              className={styles.mode}
              disabled={starting !== null || !online}
              onClick={() => void start(option.id)}
            >
              <span className={styles.modeIcon}>
                {starting === option.id ? <Spinner size="sm" /> : <Icon name={option.icon} />}
              </span>
              <span>
                <span className={styles.modeTitle}>
                  {option.label}
                  {option.id === 'agent' && <Badge tone="neutral">Optional help</Badge>}
                </span>
                <span className={styles.modeText}>{option.description}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {!online && <p className={styles.modeText}>You are offline. Starting needs a connection.</p>}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </Dialog>
  );
}
