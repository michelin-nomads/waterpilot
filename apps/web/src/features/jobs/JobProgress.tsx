import { Badge } from '../../components/Badge/Badge';
import { Button } from '../../components/Button/Button';
import { Notice } from '../../components/Notice/Notice';
import type {
  ErrorCode,
  JobFieldsFragment,
  JobKind,
  JobStatus,
} from '../../graphql/generated/graphql';
import type { StatusTone } from '../../lib/status';
import { formatWhen } from '../../session/formatTime';
import styles from './JobProgress.module.scss';
import type { JobConnection } from './useJobProgress';

const STATUS: Record<JobStatus, { label: string; tone: StatusTone }> = {
  QUEUED: { label: 'Waiting to start', tone: 'neutral' },
  RUNNING: { label: 'In progress', tone: 'accent' },
  SUCCEEDED: { label: 'Finished', tone: 'success' },
  FAILED: { label: 'Could not finish', tone: 'danger' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
};

const KIND_LABEL: Record<JobKind, string> = {
  PROPOSAL_GENERATION: 'Funding proposal',
  FUNDING_MATCH: 'Funding match',
};

const STAGE: Record<string, string> = {
  started: 'Starting',
  assembling_inputs: 'Collecting the figures and details from your report',
  rendering: 'Preparing the document',
  retry_scheduled: 'A temporary problem interrupted this step; it will retry automatically',
  redispatched: 'Restarting after an interruption',
  completed: 'Done',
  failed: 'Stopped',
};

function failureText(kind: JobKind, code: ErrorCode | null): string {
  if (code === 'SERVICE_UNAVAILABLE' && kind === 'PROPOSAL_GENERATION') {
    return 'Proposal documents cannot be produced in this version yet. Nothing was created and your report is unchanged.';
  }
  switch (code) {
    case 'NOT_FOUND':
      return 'Something this task needed no longer exists, so it stopped without changing anything.';
    case 'SERVICE_UNAVAILABLE':
      return 'The service could not complete this task after several tries. Nothing was changed; you can start it again later.';
    case 'BUDGET_EXHAUSTED':
      return 'The usage allowance for this task is used up for now. Nothing was changed.';
    default:
      return 'This task stopped after an unexpected problem. Nothing was changed; you can start it again later.';
  }
}

const CONNECTION: Partial<Record<JobConnection, string>> = {
  connecting: 'Connecting for live updates…',
  live: 'Live updates on.',
  paused: 'Live updates pause while this tab is in the background.',
};

interface JobProgressProps {
  job: JobFieldsFragment;
  connection: JobConnection;
  onRefresh: () => void;
  refreshing: boolean;
}

/** The state of one durable job, announced politely as it changes. */
export function JobProgress({ job, connection, onRefresh, refreshing }: JobProgressProps) {
  const status = STATUS[job.status];
  const stage = job.stage ? (STAGE[job.stage] ?? 'Working') : null;
  const showAttempts = job.attempts > 1 || job.status === 'FAILED';
  return (
    <section className={styles.card} aria-labelledby={`job-${job.id}-title`}>
      <div className={styles.head}>
        <h2 id={`job-${job.id}-title`} className={styles.title}>
          {KIND_LABEL[job.kind]}
        </h2>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <div aria-live="polite" className={styles.body}>
        {job.status === 'FAILED' ? (
          <p>{failureText(job.kind, job.errorCode)}</p>
        ) : (
          stage && <p>{stage}.</p>
        )}
        {showAttempts && (
          <p className={styles.meta}>
            Attempt {job.attempts} of {job.maxAttempts}
          </p>
        )}
      </div>
      <p className={styles.meta}>Last update {formatWhen(job.updatedAt)}</p>
      {connection === 'polling' ? (
        <Notice
          kind="stale"
          action={
            <Button variant="secondary" size="sm" onClick={onRefresh} loading={refreshing}>
              Check now
            </Button>
          }
        >
          Live updates are unavailable; checking every few seconds instead.
        </Notice>
      ) : (
        CONNECTION[connection] && <p className={styles.meta}>{CONNECTION[connection]}</p>
      )}
    </section>
  );
}
