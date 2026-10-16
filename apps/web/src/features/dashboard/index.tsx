import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../auth/authContext';
import { Badge } from '../../components/Badge/Badge';
import { Button, ButtonLink } from '../../components/Button/Button';
import { Notice } from '../../components/Notice/Notice';
import { LoadingRegion, Skeleton } from '../../components/Skeleton/Skeleton';
import { EmptyState, ErrorState, PermissionState } from '../../components/StatePanel/StatePanel';
import {
  MyImplementationProjectsDocument,
  MyMembershipsDocument,
  ReportsDocument,
} from '../../graphql/generated/graphql';
import { useGraphQLQuery } from '../../graphql/hooks';
import { queryKeys } from '../../graphql/queryKeys';
import { formatWhen } from '../../session/formatTime';
import { usePlanningSession } from '../../session/sessionContext';
import { PageHeader } from '../../shell/PageHeader';
import { pathForSessionStage, stageForPath } from '../../shell/stages';
import styles from './Dashboard.module.scss';

const LATEST = { first: 5 };

function CurrentPlan() {
  const { state, view } = usePlanningSession();
  if (state.status === 'loading') {
    return (
      <LoadingRegion label="Loading your current plan">
        <Skeleton shape="title" width="half" />
        <Skeleton />
      </LoadingRegion>
    );
  }
  if (state.status !== 'ready' || !view) {
    return (
      <EmptyState
        icon="map"
        title="No plan in progress"
        headingLevel={3}
        actions={
          <ButtonLink to="/start" endIcon="arrow-right">
            New report
          </ButtonLink>
        }
      >
        {state.status === 'error'
          ? state.error
          : 'Start a plan to understand your area and compare options.'}
      </EmptyState>
    );
  }
  const stage = stageForPath(pathForSessionStage(view.stage));
  return (
    <div className={styles.plan}>
      {state.restoredFrom !== null && (
        <Notice kind="restored">
          Restored your session from {formatWhen(state.restoredFrom)}.
        </Notice>
      )}
      <dl className={styles.facts}>
        <div>
          <dt>Location</dt>
          <dd>{view.areaId ? (view.areaName ?? 'Selected') : 'Not chosen yet'}</dd>
        </div>
        <div>
          <dt>Goal</dt>
          <dd>{view.goal ? view.goal.description || 'Goal set' : 'Not set yet'}</dd>
        </div>
        <div>
          <dt>Mode</dt>
          <dd>{view.mode === 'AGENT' ? 'With the assistant' : 'Traditional'}</dd>
        </div>
      </dl>
      <div className={styles.actions}>
        <ButtonLink to={pathForSessionStage(view.stage)} endIcon="arrow-right">
          Continue {stage?.label ?? (view.stage === 'TRACK' ? 'implementation' : 'funding')}
        </ButtonLink>
        <ButtonLink to="/start" variant="ghost">
          New report
        </ButtonLink>
      </div>
    </div>
  );
}

interface ListSectionProps<T> {
  title: string;
  query: UseQueryResult<T>;
  items: (data: T) => ReadonlyArray<{ id: string; content: ReactNode }>;
  empty: ReactNode;
  more: { to: string; label: string };
}

/** One dashboard list with its own loading, empty and error state. */
function ListSection<T>({ title, query, items, empty, more }: ListSectionProps<T>) {
  const id = `dashboard-${title.toLowerCase().replace(/\W+/g, '-')}`;
  let body: ReactNode;
  if (query.isPending) {
    body = (
      <LoadingRegion label={`Loading ${title.toLowerCase()}`}>
        <Skeleton />
        <Skeleton width="three-quarters" />
      </LoadingRegion>
    );
  } else if (query.isError) {
    body = (
      <ErrorState
        title={`${title} could not load`}
        headingLevel={3}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      >
        The rest of your dashboard still works. Check your connection and try again.
      </ErrorState>
    );
  } else {
    const list = items(query.data);
    body = list.length ? (
      <ul className={styles.list}>
        {list.map((item) => (
          <li key={item.id}>{item.content}</li>
        ))}
      </ul>
    ) : (
      <p className={styles.empty}>{empty}</p>
    );
  }
  return (
    <section aria-labelledby={id} className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 id={id} className={styles.sectionTitle}>
          {title}
        </h2>
        <Link to={more.to}>{more.label}</Link>
      </div>
      {query.isError || query.isPending ? null : query.isStale && query.isFetching ? (
        <p className={styles.refreshing} role="status">
          Refreshing…
        </p>
      ) : null}
      {body}
    </section>
  );
}

/** S10 Dashboard for signed-in accounts: current plan, reports, communities and projects. */
export default function DashboardPage() {
  const auth = useAuth();
  const permanent = auth.status === 'ready' && auth.user?.kind === 'permanent';
  const reports = useGraphQLQuery(queryKeys.reports.list({}, LATEST), ReportsDocument, LATEST, {
    enabled: permanent,
  });
  const memberships = useGraphQLQuery(
    queryKeys.communities.mine(LATEST),
    MyMembershipsDocument,
    LATEST,
    { enabled: permanent },
  );
  const projects = useGraphQLQuery(
    queryKeys.projects.mine(LATEST),
    MyImplementationProjectsDocument,
    LATEST,
    { enabled: permanent },
  );

  if (auth.status === 'loading') {
    return (
      <>
        <PageHeader title="Dashboard" />
        <LoadingRegion label="Loading your dashboard">
          <Skeleton shape="block" />
        </LoadingRegion>
      </>
    );
  }

  if (!permanent) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <PermissionState
          title="Sign in to see your dashboard"
          actions={
            <>
              <Button onClick={() => void auth.openSignIn('Sign in to see your dashboard.')}>
                Sign in
              </Button>
              <ButtonLink to="/" variant="ghost">
                Back to Welcome
              </ButtonLink>
            </>
          }
        >
          Your dashboard lists your reports, communities and projects, which belong to a signed-in
          account. Guests can keep planning without one.
        </PermissionState>
      </>
    );
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title="Dashboard"
        subtitle={`Signed in as ${auth.user?.displayName ?? auth.user?.email ?? 'you'}.`}
      />
      <div className={styles.actions}>
        <ButtonLink to="/tracking/new">Start a Project</ButtonLink>
        <ButtonLink to="/reports" variant="secondary">
          View Reports
        </ButtonLink>
      </div>
      <section aria-labelledby="dashboard-plan" className={styles.section}>
        <h2 id="dashboard-plan" className={styles.sectionTitle}>
          Current plan
        </h2>
        <CurrentPlan />
      </section>
      <div className={styles.grid}>
        <ListSection
          title="Reports"
          query={reports}
          items={(data) =>
            data.reports.nodes.map((report) => ({
              id: report.id,
              content: (
                <span className={styles.row}>
                  <span>{report.title}</span>
                  {report.status === 'ARCHIVED' ? (
                    <Badge tone="neutral">Archived</Badge>
                  ) : (
                    <span className={styles.meta}>
                      Finalized {report.finalizedAt ? formatWhen(report.finalizedAt) : ''}
                    </span>
                  )}
                </span>
              ),
            }))
          }
          empty="No finalized reports yet. Finish a plan to create your first one."
          more={{ to: '/reports', label: 'All reports' }}
        />
        <ListSection
          title="Communities"
          query={memberships}
          items={(data) =>
            data.myMemberships.nodes.map((membership) => ({
              id: membership.id,
              content: (
                <span className={styles.row}>
                  <span>{membership.community?.name ?? 'Community'}</span>
                  {membership.role === 'COORDINATOR' && <Badge tone="info">Coordinator</Badge>}
                  {membership.community?.status === 'ARCHIVED' && (
                    <Badge tone="neutral">Archived</Badge>
                  )}
                </span>
              ),
            }))
          }
          empty="You have not joined a community yet."
          more={{ to: '/communities', label: 'Find communities' }}
        />
        <ListSection
          title="Projects"
          query={projects}
          items={(data) =>
            data.myImplementationProjects.nodes.map((project) => ({
              id: project.id,
              content: (
                <span className={styles.row}>
                  <span>{project.title}</span>
                  <Badge tone={project.status === 'ACTIVE' ? 'info' : 'neutral'}>
                    {project.status === 'ACTIVE'
                      ? 'Active'
                      : project.status === 'COMPLETED'
                        ? 'Completed'
                        : 'Archived'}
                  </Badge>
                </span>
              ),
            }))
          }
          empty="No projects yet. Projects start from a finalized report."
          more={{ to: '/tracking', label: 'Tracking' }}
        />
      </div>
    </div>
  );
}
