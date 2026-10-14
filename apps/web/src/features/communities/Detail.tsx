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
  JoinCommunityDocument,
  LeaveCommunityDocument,
} from '../../graphql/generated/graphql';
import { newIdempotencyKey, unwrapPayload } from '../../graphql/client';
import { useGraphQLMutation, useGraphQLQuery } from '../../graphql/hooks';
import { queryKeys } from '../../graphql/queryKeys';
import { PageHeader } from '../../shell/PageHeader';
import styles from './Communities.module.scss';

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
  const community = query.data.community;
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
            : 'Community details and membership'
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
      <section className={styles.section} aria-labelledby="community-overview">
        <h2 id="community-overview">Overview</h2>
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
          {community.sharedReport && (
            <div>
              <dt>Sanitized shared report</dt>
              <dd>
                {community.sharedReport.goal.replaceAll('_', ' ').toLowerCase()} · finalized{' '}
                {new Date(community.sharedReport.finalizedAt).toLocaleDateString()}
              </dd>
            </div>
          )}
        </dl>
        <p className={styles.meta}>
          The shared summary contains only the goal category and finalized date. It does not expose
          the report title, addresses, applicant details, source documents or attachments.
        </p>
        {community.area && (
          <p className={styles.meta}>
            Approximate area is used for discovery only. Geographic proximity does not establish
            hydrological connectivity.
          </p>
        )}
      </section>
      <section className={styles.section} aria-labelledby="community-history">
        <h2 id="community-history">Linked history</h2>
        {community.viewerMembership ? (
          <p>
            Existing community-linked reports and projects retain their original member-only
            permissions. Archiving this group keeps that history read-only; the shared report
            remains a sanitized summary.
          </p>
        ) : (
          <p>
            Join to see member-only community history. The public summary does not link to private
            report files.
          </p>
        )}
        <Link to="/reports">Your reports</Link>
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
