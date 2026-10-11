import type { ReactNode } from 'react';

import { Icon, type IconName } from '../Icon/Icon';
import styles from './Notice.module.scss';

export type NoticeKind =
  'stale' | 'offline' | 'partial' | 'archived' | 'budget' | 'auth-cancelled' | 'restored' | 'info';

const KINDS: Record<NoticeKind, { icon: IconName; tone: 'neutral' | 'info' | 'warning' }> = {
  stale: { icon: 'history', tone: 'warning' },
  offline: { icon: 'wifi-off', tone: 'neutral' },
  partial: { icon: 'layers', tone: 'info' },
  archived: { icon: 'archive', tone: 'neutral' },
  budget: { icon: 'wallet', tone: 'warning' },
  'auth-cancelled': { icon: 'user', tone: 'neutral' },
  restored: { icon: 'history', tone: 'info' },
  info: { icon: 'info', tone: 'info' },
};

interface NoticeProps {
  kind: NoticeKind;
  title?: string;
  /** What happened, what is kept and what still works (ux-spec §6). */
  children: ReactNode;
  /** One related action, e.g. a Refresh or "Use Traditional mode" button. */
  action?: ReactNode;
  /**
   * Announce through a polite status region. Turn off for notices that are part of the
   * page as loaded (e.g. an archived record), where an announcement would be noise.
   */
  announce?: boolean;
}

/**
 * Inline banner for conditions that leave the current content usable: stale, offline,
 * partial data, archived, budget-blocked, cancelled sign-in, restored session.
 */
export function Notice({ kind, title, children, action, announce = true }: NoticeProps) {
  const { icon, tone } = KINDS[kind];
  return (
    <div
      className={`${styles.notice} ${styles[tone]}`}
      role={announce ? 'status' : undefined}
      data-notice={kind}
    >
      <span className={styles.icon}>
        <Icon name={icon} size="sm" />
      </span>
      <div className={styles.text}>
        {title && <p className={styles.title}>{title}</p>}
        <div className={styles.body}>{children}</div>
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
