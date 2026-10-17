import { useParams } from 'react-router-dom';

import { useAuth } from '../../auth/authContext';
import { Button, ButtonLink } from '../../components/Button/Button';
import { Notice } from '../../components/Notice/Notice';
import { LoadingRegion, Skeleton } from '../../components/Skeleton/Skeleton';
import { EmptyState, ErrorState, PermissionState } from '../../components/StatePanel/StatePanel';
import { GraphQLRequestError } from '../../graphql/client';
import { useOnlineStatus } from '../../lib/useOnlineStatus';
import { PageHeader } from '../../shell/PageHeader';
import { JobProgress } from './JobProgress';
import { useJobProgress } from './useJobProgress';

const SUBTITLE =
  'Progress is kept on the server, so you can refresh, close this tab or come back later.';

function JobBody({ jobId }: { jobId: string }) {
  const auth = useAuth();
  const online = useOnlineStatus();
  const { query, job, connection } = useJobProgress(jobId);

  if (query.isPending) {
    return (
      <LoadingRegion label="Loading task progress">
        <Skeleton shape="title" width="half" />
        <Skeleton width="three-quarters" />
      </LoadingRegion>
    );
  }

  const code = query.error instanceof GraphQLRequestError ? query.error.code : null;
  if (code === 'UNAUTHENTICATED') {
    return (
      <PermissionState
        title="Sign in to see this task"
        actions={
          <Button onClick={() => void auth.openSignIn('Sign in to see this task.')}>Sign in</Button>
        }
      >
        Tasks belong to the account that started them.
      </PermissionState>
    );
  }
  if (code === 'NOT_FOUND' || code === 'VALIDATION_FAILED' || (query.isSuccess && !job)) {
    return (
      <EmptyState
        icon="list"
        title="We could not find this task"
        actions={
          <ButtonLink to="/reports" variant="secondary">
            Go to your workspace
          </ButtonLink>
        }
      >
        The link may be wrong, or the task was started from a different account.
      </EmptyState>
    );
  }
  if (!job) {
    return (
      <ErrorState
        title="Task progress could not load"
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
        requestId={
          query.error instanceof GraphQLRequestError
            ? (query.error.requestId ?? undefined)
            : undefined
        }
      >
        The task keeps running on the server. Check your connection and try again.
      </ErrorState>
    );
  }

  return (
    <>
      {!online && (
        <Notice kind="offline">
          You are offline. The task keeps running on the server; progress will update when you
          reconnect.
        </Notice>
      )}
      <JobProgress
        job={job}
        connection={connection}
        onRefresh={() => void query.refetch()}
        refreshing={query.isFetching}
      />
    </>
  );
}

/** Restores a durable job by the id in the URL, e.g. after a refresh or from a link. */
export default function JobPage() {
  const { jobId = '' } = useParams();
  return (
    <>
      <PageHeader title="Task progress" subtitle={SUBTITLE} />
      <JobBody key={jobId} jobId={jobId} />
    </>
  );
}
