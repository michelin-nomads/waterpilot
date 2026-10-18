import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useAuth } from '../../auth/authContext';
import { Button, ButtonLink } from '../../components/Button/Button';
import { Notice } from '../../components/Notice/Notice';
import { EmptyState, ErrorState } from '../../components/StatePanel/StatePanel';
import { LoadingRegion, Skeleton } from '../../components/Skeleton/Skeleton';
import {
  ArchiveCommunityDocument,
  CommunityDocument,
  CommunityMembersDocument,
  JoinCommunityDocument,
  LeaveCommunityDocument,
} from '../../graphql/generated/graphql';
import { newIdempotencyKey, unwrapPayload } from '../../graphql/client';
import { useGraphQLMutation, useGraphQLQuery } from '../../graphql/hooks';
import { queryKeys } from '../../graphql/queryKeys';
import { Icon } from '../../components/Icon/Icon';
import detail from './CommunityDetail.module.scss';
import styles from './Communities.module.scss';

const PAGE = { first: 50 };

export default function CommunityDetailPage() {
  const { communityId = '' } = useParams();
  const auth = useAuth();
  const query = useGraphQLQuery(
    queryKeys.communities.detail(communityId),
    CommunityDocument,
    { id: communityId },
    { enabled: Boolean(communityId) },
  );
  const join = useGraphQLMutation('joinCommunity', JoinCommunityDocument);
  const leave = useGraphQLMutation('leaveCommunity', LeaveCommunityDocument);
  const archive = useGraphQLMutation('archiveCommunity', ArchiveCommunityDocument);
  const [optimisticJoined, setOptimisticJoined] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'overview' | 'reports' | 'settings'>('overview');
  const community = query.data?.community ?? null;
  const members = useGraphQLQuery(
    queryKeys.communities.members(community?.id ?? '', PAGE),
    CommunityMembersDocument,
    { id: community?.id ?? '', ...PAGE },
    { enabled: Boolean(community?.viewerMembership) && tab === 'settings' },
  );

  if (query.isPending)
    return (
      <div className={detail.page}>
        <LoadingRegion label="Loading community">
          <Skeleton />
          <Skeleton width="three-quarters" />
        </LoadingRegion>
      </div>
    );
  if (query.isError)
    return (
      <div className={detail.page}>
        <ErrorState
          title="Community could not load"
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        >
          This community may have been removed or is unavailable.
        </ErrorState>
      </div>
    );
  if (!community)
    return (
      <div className={detail.page}>
        <EmptyState
          title="Community not found"
          actions={<ButtonLink to="/communities">All communities</ButtonLink>}
        >
          The community may no longer be available.
        </EmptyState>
      </div>
    );

  const isJoined = optimisticJoined ?? Boolean(community.viewerMembership);
  const isCoordinator = community.viewerMembership?.role === 'COORDINATOR';
  const runJoin = async () => {
    setError(null);
    setOptimisticJoined(true);
    let complete = false;
    try {
      if (
        !(await auth.ensurePermanent(
          'Sign in to join this community. Your join will continue after sign-in.',
        ))
      )
        return;
      const result = await join.mutateAsync({
        communityId: community.id,
        idempotencyKey: newIdempotencyKey(),
      });
      unwrapPayload(result.joinCommunity);
      complete = true;
      setOptimisticJoined(null);
    } catch {
      setError('Join failed. Your membership state was restored; try again.');
    } finally {
      if (!complete) setOptimisticJoined(false);
    }
  };
  const runLeave = async () => {
    if (
      !community.viewerMembership ||
      !window.confirm(
        'Leave this community? Its archived history remains visible only to current members.',
      )
    )
      return;
    const previous = isJoined;
    setError(null);
    setOptimisticJoined(false);
    let complete = false;
    try {
      const result = await leave.mutateAsync({
        communityId: community.id,
        expectedVersion: community.viewerMembership.version,
      });
      unwrapPayload(result.leaveCommunity);
      complete = true;
      setOptimisticJoined(null);
    } catch {
      setError('Leave failed. Your membership state was restored; refresh and try again.');
    } finally {
      if (!complete) setOptimisticJoined(previous);
    }
  };
  const runArchive = async () => {
    if (
      !window.confirm(
        'Archive this community? It will disappear from nearby search, reject new members and planning sessions, and keep its linked report summary and member history read-only.',
      )
    )
      return;
    setError(null);
    try {
      const result = await archive.mutateAsync({
        id: community.id,
        expectedVersion: community.version,
      });
      unwrapPayload(result.archiveCommunity);
      await query.refetch();
    } catch {
      setError('The community could not be archived. Refresh to check its current state.');
    }
  };

  return (
    <div className={detail.page}>
      <Link to="/communities" className={detail.back}>
        <Icon name="chevron-right" size="sm" />
        All communities
      </Link>
      <header className={detail.hero}>
        <div className={detail.art} aria-hidden="true">
          <Icon name="users" size="lg" />
        </div>
        <div className={detail.summary}>
          <h1>{community.name}</h1>
          <p>{community.description || 'No public description.'}</p>
          <div className={detail.facts}>
            {community.sharedReport && (
              <span>
                <Icon name="target" />
                {community.sharedReport.goal.replaceAll('_', ' ').toLowerCase()}
              </span>
            )}
            <span>
              <Icon name="users" />
              {community.memberCount} {community.memberCount === 1 ? 'member' : 'members'}
            </span>
            <span>
              <Icon name="map" />
              {community.area?.name ?? 'Area not shared'}
            </span>
          </div>
        </div>
        <div className={detail.membership}>
          {community.status === 'ARCHIVED' ? (
            <span>Archived</span>
          ) : isJoined ? (
            <details
              className={detail.joinedMenu}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget))
                  event.currentTarget.removeAttribute('open');
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.currentTarget.removeAttribute('open');
                  event.currentTarget.querySelector('summary')?.focus();
                }
              }}
            >
              <summary>
                Joined <Icon name="check" size="sm" />
                <Icon name="chevron-down" size="sm" />
              </summary>
              <div className={detail.menuPanel}>
                <button type="button" onClick={() => setTab('overview')}>
                  <Icon name="check" size="sm" />
                  View community
                </button>
                <Button
                  variant="danger"
                  size="sm"
                  loading={leave.isPending}
                  onClick={() => void runLeave()}
                >
                  Leave community
                </Button>
                {isCoordinator && (
                  <Button
                    variant="danger"
                    size="sm"
                    loading={archive.isPending}
                    onClick={() => void runArchive()}
                  >
                    Archive community
                  </Button>
                )}
              </div>
            </details>
          ) : (
            <Button loading={join.isPending} onClick={() => void runJoin()}>
              Join community
            </Button>
          )}
        </div>
      </header>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {community.status === 'ARCHIVED' && (
        <Notice kind="archived" title="This community is archived" announce={false}>
          It no longer appears in active or nearby discovery. New joins and community planning
          sessions are closed. Existing memberships and already-linked history remain read-only; its
          sanitized report summary remains available here.
        </Notice>
      )}
      <div
        className={detail.tabs}
        onKeyDown={(event) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          const tabs = Array.from(
            event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
          );
          const current = tabs.indexOf(event.target as HTMLButtonElement);
          if (current < 0) return;
          event.preventDefault();
          const next =
            event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? tabs.length - 1
                : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
          tabs[next]?.focus();
          tabs[next]?.click();
        }}
        role="tablist"
        aria-label="Community details"
      >
        {(
          [
            ['overview', 'Overview'],
            ['reports', 'Shared reports'],
            ...(isCoordinator ? ([['settings', 'Settings']] as const) : []),
          ] as const
        ).map(([value, label]) => (
          <button
            type="button"
            key={value}
            role="tab"
            id={`community-tab-${value}`}
            aria-selected={tab === value}
            aria-controls="community-tab-panel"
            tabIndex={tab === value ? 0 : -1}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <section
        className={tab === 'overview' ? detail.overview : styles.section}
        id="community-tab-panel"
        role="tabpanel"
        aria-labelledby={`community-tab-${tab}`}
        tabIndex={0}
      >
        {tab === 'overview' && (
          <>
            <article className={detail.panel}>
              <h2>About this community</h2>
              <p>{community.description || 'No description provided.'}</p>
              <ul className={detail.aboutFacts}>
                <li>
                  <Icon name="map" />
                  {community.area
                    ? `${community.area.name}, ${community.area.countryCode}`
                    : 'Area not shared'}
                </li>
                <li>
                  <Icon name="users" />
                  {community.status === 'ACTIVE'
                    ? 'Open to new members · joining is immediate'
                    : 'Archived · no new memberships'}
                </li>
                <li>
                  <Icon name="user" />
                  Your role: {community.viewerMembership?.role.toLowerCase() ?? 'visitor'}
                </li>
                {community.contactName && (
                  <li>
                    <Icon name="user" />
                    {community.contactName}
                  </li>
                )}
                {community.contactEmail && (
                  <li>
                    <Icon name="mail" />
                    <a href={`mailto:${community.contactEmail}`}>{community.contactEmail}</a>
                  </li>
                )}
              </ul>
              <p className={styles.meta}>
                Only consented contact details are public. Area references are approximate;
                proximity does not establish hydrological connectivity.
              </p>
            </article>
            <div className={detail.rightColumn}>
              <article className={detail.panel}>
                <div className={detail.panelHeading}>
                  <h2>Recent shared reports</h2>
                  <button type="button" onClick={() => setTab('reports')}>
                    View all
                  </button>
                </div>
                {community.sharedReport ? (
                  <div className={detail.reportRow}>
                    <Icon name="file" size="lg" />
                    <div>
                      <h3>{community.sharedReport.goal.replaceAll('_', ' ').toLowerCase()}</h3>
                      <p>
                        Finalized{' '}
                        {new Date(community.sharedReport.finalizedAt).toLocaleDateString()}
                      </p>
                      <span className={detail.summaryLabel}>Public summary</span>
                    </div>
                    <button
                      type="button"
                      aria-label="View shared report summary"
                      onClick={() => setTab('reports')}
                    >
                      <Icon name="chevron-right" />
                    </button>
                  </div>
                ) : (
                  <p>No report summary has been shared yet.</p>
                )}
                <p className={styles.meta}>
                  Only the goal and finalized date are shared. Report titles, source documents,
                  applicants and private downloads stay private.
                </p>
              </article>
              <article className={detail.goalPanel}>
                <Icon name="target" size="lg" />
                <div>
                  <h2>Community goal</h2>
                  <p>
                    {community.sharedReport?.goal.replaceAll('_', ' ').toLowerCase() ??
                      'A community goal has not been shared.'}
                  </p>
                </div>
              </article>
            </div>
          </>
        )}
        {tab === 'reports' && (
          <>
            <h2>Shared reports</h2>
            {community.sharedReport ? (
              <article className={styles.card}>
                <div>
                  <h3>{community.sharedReport.goal.replaceAll('_', ' ').toLowerCase()}</h3>
                  <p>
                    Finalized {new Date(community.sharedReport.finalizedAt).toLocaleDateString()}
                  </p>
                </div>
              </article>
            ) : (
              <p>No report summary has been shared.</p>
            )}
            <p className={styles.meta}>
              Only the goal category and finalized date are shown. Titles, addresses, applicants,
              source documents and attachments remain private.
            </p>
            {isJoined && (
              <p>Other linked report and project history stays visible only to active members.</p>
            )}
          </>
        )}
        {tab === 'settings' && isCoordinator && (
          <>
            <h2>Settings</h2>
            <h3>Community details</h3>
            <p>{community.name}</p>
            <p>{community.description || 'No public description.'}</p>
            <h3>Published contact</h3>
            <p>
              {community.contactName || community.contactEmail
                ? 'Only fields already approved for public sharing are returned here.'
                : 'No contact field is currently published.'}
            </p>
            <p className={styles.meta}>
              Editing details or consent settings is not supported by the current API, so changes
              cannot be made on this screen.
            </p>
            {members.data?.community &&
              members.data.community.members.nodes.filter((member) => member.role === 'COORDINATOR')
                .length <= 1 && (
                <Notice kind="caution" title="You are the last coordinator">
                  Coordinator transfer is not supported by the current API. You can archive this
                  community instead; its memberships and linked history remain read-only.
                  {community.status === 'ACTIVE' && (
                    <div className={styles.actions}>
                      <Button
                        variant="danger"
                        loading={archive.isPending}
                        onClick={() => void runArchive()}
                      >
                        Archive instead
                      </Button>
                    </div>
                  )}
                </Notice>
              )}
          </>
        )}
      </section>
      {community.status === 'ACTIVE' && isCoordinator && (
        <p className={styles.meta}>
          A coordinator cannot leave if that would leave this community without an administrator.
          Archive the community instead; its member history remains read-only.
        </p>
      )}
    </div>
  );
}
