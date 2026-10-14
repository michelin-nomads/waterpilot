import { useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../auth/authContext';
import { ButtonLink } from '../../components/Button/Button';
import { EmptyState, ErrorState, PermissionState } from '../../components/StatePanel/StatePanel';
import { LoadingRegion, Skeleton } from '../../components/Skeleton/Skeleton';
import { ReportsDocument } from '../../graphql/generated/graphql';
import { useGraphQLQuery } from '../../graphql/hooks';
import { queryKeys } from '../../graphql/queryKeys';
import { usePlanningSession } from '../../session/sessionContext';
import { PageHeader } from '../../shell/PageHeader';
import styles from './Reports.module.scss';

const PAGE = { first: 50 };
const ACTIVE_FILTER = { status: 'FINALIZED' as const };
const ARCHIVED_FILTER = { status: 'ARCHIVED' as const };

export default function ReportsPage() {
  const auth = useAuth();
  const session = usePlanningSession();
  const [showArchived, setShowArchived] = useState(false);
  const permanent = auth.status === 'ready' && auth.user?.kind === 'permanent';
  const filter = showArchived ? ARCHIVED_FILTER : ACTIVE_FILTER;
  const variables = { filter, ...PAGE };
  const query = useGraphQLQuery(queryKeys.reports.list(filter, PAGE), ReportsDocument, variables, {
    enabled: permanent,
  });
  const current = session.state.status === 'ready' ? session.view : null;

  return (
    <main className={styles.page}>
      <PageHeader
        title="Review and reports"
        subtitle="Check a plan before finalizing, then return to its immutable report."
      />
      <div className={styles.actions}>
        <ButtonLink to="/start" endIcon="arrow-right">
          New report
        </ButtonLink>
        {current?.selectedPlanOptionId && (
          <ButtonLink to="/reports/review" variant="secondary">
            Review current plan
          </ButtonLink>
        )}
      </div>
      <section aria-labelledby="finalized-title" className={styles.section}>
        <div className={styles.sectionHeading}>
          <h2 id="finalized-title">{showArchived ? 'Archived reports' : 'Finalized reports'}</h2>
          {permanent && (
            <button
              type="button"
              className={styles.textButton}
              onClick={() => setShowArchived((value) => !value)}
            >
              {showArchived ? 'Show finalized' : 'Show archived'}
            </button>
          )}
        </div>
        {auth.status === 'loading' ? (
          <LoadingRegion label="Loading reports">
            <Skeleton />
            <Skeleton width="three-quarters" />
          </LoadingRegion>
        ) : !permanent ? (
          <PermissionState
            title="Sign in to view saved reports"
            actions={
              <button
                className={styles.textButton}
                onClick={() => void auth.openSignIn('Sign in to view your finalized reports.')}
              >
                Sign in
              </button>
            }
          >
            Planning is available as a guest. Sign in when you want to save and revisit a finalized
            report.
          </PermissionState>
        ) : query.isPending ? (
          <LoadingRegion label="Loading finalized reports">
            <Skeleton />
            <Skeleton width="three-quarters" />
          </LoadingRegion>
        ) : query.isError ? (
          <ErrorState
            title="Reports could not load"
            onRetry={() => void query.refetch()}
            retrying={query.isFetching}
          >
            Check your connection and retry. Your planning session is unchanged.
          </ErrorState>
        ) : query.data.reports.nodes.length === 0 ? (
          <EmptyState
            icon="file"
            title={showArchived ? 'No archived reports' : 'No finalized reports yet'}
          >
            {showArchived
              ? 'Archived reports will appear here.'
              : 'Finalize a reviewed plan to save its location, goal, impact assessment and exact economics as an immutable snapshot.'}
          </EmptyState>
        ) : (
          <ul className={styles.list}>
            {query.data.reports.nodes.map((report) => (
              <li key={report.id} className={styles.card}>
                <div>
                  <p className={styles.meta}>
                    {report.status === 'ARCHIVED' ? 'Archived' : 'Finalized'} ·{' '}
                    {new Date(report.finalizedAt).toLocaleDateString()}
                  </p>
                  <h3>
                    <Link to={`/reports/${report.id}`}>{report.title}</Link>
                  </h3>
                  <p>
                    {report.planName ?? 'Plan snapshot'} ·{' '}
                    {report.economics?.currency ?? 'economics unavailable'}
                  </p>
                </div>
                <Link className={styles.open} to={`/reports/${report.id}`}>
                  Open report
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
