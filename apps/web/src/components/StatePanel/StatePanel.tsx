import type { ReactNode } from 'react';

import { Button } from '../Button/Button';
import { Icon, type IconName } from '../Icon/Icon';
import { Notice } from '../Notice/Notice';
import styles from './StatePanel.module.scss';

interface PanelProps {
  icon: IconName;
  tone: 'neutral' | 'danger' | 'warning';
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  role?: 'alert' | 'status';
  headingLevel?: 2 | 3;
}

function StatePanel({ icon, tone, title, children, actions, role, headingLevel = 2 }: PanelProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <div className={`${styles.panel} ${styles[tone]}`} role={role}>
      <span className={styles.icon}>
        <Icon name={icon} size="lg" />
      </span>
      <Heading className={styles.title}>{title}</Heading>
      {children && <div className={styles.body}>{children}</div>}
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  children?: ReactNode;
  icon?: IconName;
  actions?: ReactNode;
  headingLevel?: 2 | 3;
}

/** Nothing to show yet — explain why and what the user can do next. */
export function EmptyState({ icon = 'layers', ...rest }: EmptyStateProps) {
  return <StatePanel icon={icon} tone="neutral" {...rest} />;
}

interface ErrorStateProps {
  title?: string;
  /** Actionable message: what failed and what to try. */
  children: ReactNode;
  onRetry?: () => void;
  retrying?: boolean;
  /** Correlation id to quote to support; never a token or internal stack trace. */
  requestId?: string;
  headingLevel?: 2 | 3;
}

export function ErrorState({
  title = 'Something went wrong',
  children,
  onRetry,
  retrying = false,
  requestId,
  headingLevel,
}: ErrorStateProps) {
  return (
    <StatePanel
      icon="alert-circle"
      tone="danger"
      title={title}
      role="alert"
      headingLevel={headingLevel}
      actions={
        onRetry && (
          <Button variant="secondary" startIcon="refresh" loading={retrying} onClick={onRetry}>
            Try again
          </Button>
        )
      }
    >
      {children}
      {requestId && (
        <p className={styles.meta}>
          Reference: <code>{requestId}</code>
        </p>
      )}
    </StatePanel>
  );
}

interface PermissionStateProps {
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
  headingLevel?: 2 | 3;
}

/** The user is identified but not allowed to see or do this. */
export function PermissionState({
  title = 'You do not have access to this',
  ...rest
}: PermissionStateProps) {
  return <StatePanel icon="lock" tone="warning" title={title} {...rest} />;
}

interface StaleBannerProps {
  /** e.g. "Showing results from 10 Oct 2026, 11:42". */
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}

/** Keeps current data visible while telling the user it may be out of date. */
export function StaleBanner({ children, refreshing = false, onRefresh }: StaleBannerProps) {
  return (
    <Notice
      kind="stale"
      action={
        onRefresh && (
          <Button
            variant="ghost"
            size="sm"
            startIcon="refresh"
            loading={refreshing}
            onClick={onRefresh}
          >
            Refresh
          </Button>
        )
      }
    >
      {children}
    </Notice>
  );
}
