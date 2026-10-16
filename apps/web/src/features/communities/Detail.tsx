import { useState } from 'react';
import { useParams } from 'react-router-dom';

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
import { PageHeader } from '../../shell/PageHeader';
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
  const [tab, setTab] = useState<'overview' | 'reports' | 'members' | 'settings'>('overview');
  const community = query.data?.community ?? null;
  const members = useGraphQLQuery(
    queryKeys.communities.members(community?.id ?? '', PAGE),
    CommunityMembersDocument,
    { id: community?.id ?? '', ...PAGE },
    { enabled: Boolean(community?.viewerMembership) && (tab === 'members' || tab === 'settings') },
  );

  if (query.isPending)
    return (
      <main className={styles.page}>
        <LoadingRegion label="Loading community">
          <Skeleton />
          <Skeleton width="three-quarters" />
        </LoadingRegion>
      </main>
    );
  if (query.isError)
    return (
      <main className={styles.page}>
        <ErrorState
          title="Community could not load"
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        >
          This community may have been removed or is unavailable.
        </ErrorState>
      </main>
    );
  if (!community)
    return (
      <main className={styles.page}>
        <EmptyState
          title="Community not found"
          actions={<ButtonLink to="/communities">All communities</ButtonLink>}
        >
          The community may no longer be available.
        </EmptyState>
      </main>
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
    <main className={styles.page}>
      <PageHeader
        title={community.name}
        subtitle={
          community.status === 'ARCHIVED'
            ? 'Archived community · read-only history'
            : `${community.memberCount} ${community.memberCount === 1 ? 'member' : 'members'} · ${community.area ? `${community.area.name}, ${community.area.countryCode}` : 'area not shared'}`
        }
      />
      <div className={styles.actions}>
        <ButtonLink to="/communities" variant="secondary">
          Back to communities
        </ButtonLink>
        {community.status === 'ACTIVE' && !isJoined && (
          <Button loading={join.isPending} onClick={() => void runJoin()}>
            Join community
          </Button>
        )}
        {community.status === 'ACTIVE' && isJoined && (
          <Button variant="secondary" loading={leave.isPending} onClick={() => void runLeave()}>
            Leave community
          </Button>
        )}
        {community.status === 'ACTIVE' && isCoordinator && (
          <Button variant="danger" loading={archive.isPending} onClick={() => void runArchive()}>
            Archive community
          </Button>
        )}
      </div>
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
      <div className={styles.filters} role="tablist" aria-label="Community details">
        {(
          [
            ['overview', 'Overview'],
            ['reports', 'Shared reports'],
            ['members', 'Members'],
            ...(isCoordinator ? ([['settings', 'Settings']] as const) : []),
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            role="tab"
            id={`community-tab-${value}`}
            aria-selected={tab === value}
            aria-controls="community-tab-panel"
            variant={tab === value ? 'primary' : 'secondary'}
            onClick={() => setTab(value)}
          >
            {label}
          </Button>
        ))}
      </div>
      <section
        className={styles.section}
        id="community-tab-panel"
        role="tabpanel"
        aria-labelledby={`community-tab-${tab}`}
        tabIndex={0}
      >
        {tab === 'overview' && (
          <>
            <h2>Overview</h2>
            <p>{community.description || 'No description provided.'}</p>
            <dl className={styles.detailGrid}>
              <div>
                <dt>Approximate area</dt>
                <dd>
                  {community.area
                    ? `${community.area.name}, ${community.area.countryCode}`
                    : 'Not shared'}
                </dd>
              </div>
              <div>
                <dt>Members</dt>
                <dd>{community.memberCount}</dd>
              </div>
              <div>
                <dt>Your role</dt>
                <dd>{community.viewerMembership?.role ?? 'Visitor'}</dd>
              </div>
              {community.contactName && (
                <div>
                  <dt>Consented contact name</dt>
                  <dd>{community.contactName}</dd>
                </div>
              )}
              {community.contactEmail && (
                <div>
                  <dt>Consented contact email</dt>
                  <dd>
                    <a href={`mailto:${community.contactEmail}`}>{community.contactEmail}</a>
                  </dd>
                </div>
              )}
            </dl>
            {community.area && (
              <p className={styles.meta}>
                Area is approximate and used for discovery only. Distance does not establish
                hydrological connectivity.
              </p>
            )}
            <p className={styles.meta}>
              Join to access member-only history. The public summary never links to private report
              files.
            </p>
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
        {tab === 'members' && (
          <>
            <h2>Members</h2>
            {!isJoined ? (
              <p>Join this community to view member-only details.</p>
            ) : members.isPending ? (
              <LoadingRegion label="Loading community members">
                <Skeleton />
              </LoadingRegion>
            ) : members.isError ? (
              <ErrorState
                title="Members could not load"
                onRetry={() => void members.refetch()}
                retrying={members.isFetching}
              >
                Retry to view the community member list.
              </ErrorState>
            ) : members.data.community?.members.nodes.length ? (
              <ul className={styles.list}>
                {members.data.community.members.nodes.map((member) => (
                  <li className={styles.card} key={member.id}>
                    <span>
                      {member.isViewer ? 'You' : 'Community member · identity not shared'}
                    </span>
                    <span>{member.role === 'COORDINATOR' ? 'Coordinator' : 'Member'}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No active members were returned.</p>
            )}
            <p className={styles.meta}>
              The member directory contains role and membership status only; private contact details
              are shown only when separately consented.
            </p>
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
    </main>
  );
}
