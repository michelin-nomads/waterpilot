import type { ReactElement, ReactNode } from 'react';

import styles from './StepActions.module.scss';

interface StepActionsProps {
  /** The step's single primary action (a primary Button or ButtonLink). */
  primary: ReactElement;
  /** Secondary or ghost actions shown before the primary. */
  secondary?: ReactNode;
  /** A backwards action, placed at the start (e.g. "Back to goal"). */
  back?: ReactNode;
  /**
   * Context for the primary action, such as why it is unavailable. Give it an id and
   * reference that id from the primary's aria-describedby.
   */
  note?: ReactNode;
}

/**
 * Action row placed at the foot of the result or review it acts on (ux-spec §1). Holds
 * exactly one primary action; below tablet width the actions stack and the primary
 * spans the full width.
 */
export function StepActions({ primary, secondary, back, note }: StepActionsProps) {
  return (
    <div className={styles.actions}>
      {back && <div className={styles.back}>{back}</div>}
      <div className={styles.forward}>
        {secondary}
        <span className={styles.primary}>{primary}</span>
      </div>
      {note && <div className={styles.note}>{note}</div>}
    </div>
  );
}
