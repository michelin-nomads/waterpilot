import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../auth/authContext';
import { Button, ButtonLink, Select } from '../../components';
import { Notice } from '../../components/Notice/Notice';
import { EmptyState, ErrorState } from '../../components/StatePanel/StatePanel';
import { LoadingRegion, Skeleton } from '../../components/Skeleton/Skeleton';
import {
  AreaLocationDocument,
  CommunitiesDocument,
  JoinCommunityDocument,
  MyMembershipsDocument,
  NearbyCommunitiesDocument,
} from '../../graphql/generated/graphql';
import { newIdempotencyKey, unwrapPayload } from '../../graphql/client';
import { useGraphQLMutation, useGraphQLQuery } from '../../graphql/hooks';
import { queryKeys } from '../../graphql/queryKeys';
import { usePlanningSession } from '../../session/sessionContext';
import { PageHeader } from '../../shell/PageHeader';
import styles from './Communities.module.scss';

const PAGE = { first: 50 };

export default function CommunitiesPage() {
  const auth = useAuth();
  const session = usePlanningSession();
  const current = session.state.status === 'ready' ? session.view : null;
  const areaId = current?.areaId ?? null;
  const permanent = auth.status === 'ready' && auth.user?.kind === 'permanent';
  const [search, setSearch] = useState('');
  const [radius, setRadius] = useState(5000);
  const [view, setView] = useState<'all' | 'mine' | 'nearby'>('all');
  const nearbyMode = view === 'nearby';
  const mineMode = view === 'mine';
  const [showArchived, setShowArchived] = useState(false);
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});
  const [actionError, setActionError] = useState<{ id: string; message: string } | null>(null);
  const communityVariables = {
    filter: { includeArchived: showArchived, archivedOnly: showArchived },
    ...PAGE,
  };
  const communities = useGraphQLQuery(
    queryKeys.communities.list(communityVariables.filter, PAGE),
    CommunitiesDocument,
    communityVariables,
  );
  const memberships = useGraphQLQuery(
    queryKeys.communities.memberships(PAGE),
    MyMembershipsDocument,
    PAGE,
    { enabled: mineMode && permanent },
  );
  const area = useGraphQLQuery(
    queryKeys.areas.detail(areaId ?? ''),
    AreaLocationDocument,
    { id: areaId ?? '' },
    { enabled: Boolean(areaId) },
  );
  const center = area.data?.area;
  const nearVariables = {
    near: {
      latitude: center?.centroidLat ?? '0',
      longitude: center?.centroidLon ?? '0',
      radiusMeters: radius,
    },
    ...PAGE,
  };
  const nearby = useGraphQLQuery(
    queryKeys.communities.nearby(nearVariables.near, PAGE),
    NearbyCommunitiesDocument,
    nearVariables,
    { enabled: nearbyMode && Boolean(center) },
  );
  const join = useGraphQLMutation('joinCommunity', JoinCommunityDocument);
  const rows = useMemo(() => {
    const source = mineMode
      ? (memberships.data?.myMemberships.nodes.map((n) => n.community) ?? []).filter((item) =>
          showArchived ? item.status === 'ARCHIVED' : item.status === 'ACTIVE',
        )
      : nearbyMode
        ? (nearby.data?.nearbyCommunities.nodes.map((n) => n.community) ?? [])
        : (communities.data?.communities.nodes ?? []);
    const query = search.trim().toLocaleLowerCase();
    return query
      ? source.filter((item) =>
          `${item.name} ${item.description}`.toLocaleLowerCase().includes(query),
        )
      : source;
  }, [communities.data, memberships.data, nearby.data, nearbyMode, mineMode, search, showArchived]);
  const resultsPending = mineMode
    ? permanent && memberships.isPending
    : nearbyMode
      ? Boolean(center) && nearby.isPending
      : communities.isPending;
  const resultsError = mineMode
    ? memberships.isError
    : nearbyMode
      ? nearby.isError
      : communities.isError;

  const joinCommunity = async (communityId: string, wasJoined: boolean) => {
    setActionError(null);
    setOptimistic((currentState) => ({ ...currentState, [communityId]: true }));
    let completed = false;
    try {
      if (
        !(await auth.ensurePermanent(
          'Sign in to join this community. Your join will continue after sign-in.',
        ))
      )
        return;
      const result = await join.mutateAsync({ communityId, idempotencyKey: newIdempotencyKey() });
      unwrapPayload(result.joinCommunity);
      completed = true;
    } catch {
      setActionError({
        id: communityId,
        message: 'Join failed. The membership change was rolled back; try again.',
      });
    } finally {
      if (completed) setOptimistic((currentState) => ({ ...currentState, [communityId]: true }));
      else setOptimistic((currentState) => ({ ...currentState, [communityId]: wasJoined }));
    }
  };

  return (
    <main className={styles.page}>
      <PageHeader
        title="Communities"
        subtitle="Find neighbours, share a safe plan summary, and work together."
      />
      <div className={styles.toolbar}>
        <div className={styles.actions}>
          <ButtonLink to="/communities/new">Create a community</ButtonLink>
          <Button
            variant="secondary"
            onClick={() => {
              if (nearbyMode) setView('all');
              setShowArchived((value) => !value);
            }}
          >
            {showArchived ? 'Show active communities' : 'Show archived communities'}
          </Button>
        </div>
        <label className={styles.label} htmlFor="community-search">
          Search communities
          <input
            id="community-search"
            className={styles.input}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name or description"
          />
        </label>
      </div>
      <Notice kind="info" title="Nearby means geographic distance only">
        Distance uses the selected planning location’s centroid. It does not establish a shared
        aquifer, catchment, supply network or other hydrological connection.
      </Notice>
      <section className={styles.section} aria-labelledby="discovery-title">
        <div className={styles.toolbar}>
          <h2 id="discovery-title">
            {nearbyMode
              ? 'Nearby communities'
              : mineMode
                ? showArchived
                  ? 'My archived communities'
                  : 'My communities'
                : showArchived
                  ? 'Archived communities'
                  : 'All communities'}
          </h2>
          <div className={styles.filters}>
            <Button
              variant={mineMode ? 'primary' : 'secondary'}
              onClick={() => {
                setView('mine');
                setShowArchived(false);
              }}
            >
              My communities
            </Button>
            <Button
              variant={nearbyMode ? 'primary' : 'secondary'}
              onClick={() => {
                setView('nearby');
                setShowArchived(false);
              }}
            >
              Discover nearby
            </Button>
            <Button
              variant={view === 'all' ? 'primary' : 'secondary'}
              onClick={() => setView('all')}
            >
              All communities
            </Button>
            {nearbyMode && (
              <label className={styles.label} htmlFor="radius">
                Radius
                <Select
                  id="radius"
                  value={radius}
                  onChange={(event) => setRadius(Number(event.target.value))}
                >
                  {[1000, 5000, 10000, 25000, 50000].map((meters) => (
                    <option value={meters} key={meters}>
                      {meters / 1000} km
                    </option>
                  ))}
                </Select>
              </label>
            )}
          </div>
        </div>
        {nearbyMode && (
          <Notice kind="partial" title="Map pins are unavailable">
            The community API provides approximate area names and distances, but no display
            coordinates. Results stay in this list so the app does not invent map locations.
          </Notice>
        )}
        {nearbyMode && !areaId && (
          <EmptyState title="Choose a planning location to search nearby">
            <Link to="/area">Choose a location</Link> to set the centre. The search uses its
            centroid and does not publish it.
          </EmptyState>
        )}
        {mineMode && !permanent && (
          <EmptyState title="Sign in to see your communities">
            <Button onClick={() => void auth.ensurePermanent('Sign in to view your communities.')}>
              Sign in
            </Button>
          </EmptyState>
        )}
        {nearbyMode && areaId && area.isError && (
          <ErrorState
            title="The selected area could not load"
            onRetry={() => void area.refetch()}
            retrying={area.isFetching}
          >
            Choose another location or retry. Nothing was shared.
          </ErrorState>
        )}
        {resultsPending ? (
          <LoadingRegion label="Loading communities">
            <Skeleton />
            <Skeleton width="three-quarters" />
          </LoadingRegion>
        ) : null}
        {resultsError && (
          <ErrorState
            title="Communities could not load"
            onRetry={() =>
              void (mineMode
                ? memberships.refetch()
                : nearbyMode
                  ? nearby.refetch()
                  : communities.refetch())
            }
            retrying={
              mineMode
                ? memberships.isFetching
                : nearbyMode
                  ? nearby.isFetching
                  : communities.isFetching
            }
          >
            Check your connection and try again.
          </ErrorState>
        )}
        {nearbyMode && nearby.data?.nearbyCommunities.candidatesTruncated && (
          <Notice kind="caution" title="Dense area: results may be incomplete">
            Reduce the radius to search fewer geospatial cells.
          </Notice>
        )}
        {!resultsPending &&
          !resultsError &&
          (!nearbyMode || Boolean(center)) &&
          (!mineMode || permanent) &&
          rows.length === 0 && (
            <EmptyState
              icon="users"
              title={
                search
                  ? 'No communities match this search'
                  : mineMode && showArchived
                    ? 'No archived communities you belong to'
                    : showArchived
                      ? 'No archived communities'
                      : 'No communities found'
              }
            >
              {search
                ? 'Try a shorter search.'
                : nearbyMode
                  ? 'No active communities were found within this radius.'
                  : mineMode
                    ? 'Join a community to see it here.'
                    : 'Create the first community or search a nearby area.'}
            </EmptyState>
          )}
        {rows.length > 0 && (
          <ul className={styles.list}>
            {rows.map((community) => {
              const joined = optimistic[community.id] ?? Boolean(community.viewerMembership);
              const distance = nearbyMode
                ? nearby.data?.nearbyCommunities.nodes.find((n) => n.community.id === community.id)
                    ?.distanceMeters
                : null;
              return (
                <li className={styles.card} key={community.id}>
                  <div>
                    <h3>
                      <Link to={`/communities/${community.id}`}>{community.name}</Link>
                    </h3>
                    <p>
                      {community.area?.name ?? 'Area not published'} · {community.memberCount}{' '}
                      {community.memberCount === 1 ? 'member' : 'members'}
                      {distance != null ? ` · ${distance.toLocaleString()} m away` : ''}
                    </p>
                    <p>{community.description || 'No description provided.'}</p>
                    {actionError?.id === community.id && (
                      <p className={styles.error} role="alert">
                        {actionError.message}
                      </p>
                    )}
                  </div>
                  <div className={styles.cardActions}>
                    <ButtonLink to={`/communities/${community.id}`} variant="secondary">
                      Details
                    </ButtonLink>
                    {!joined && community.status === 'ACTIVE' && (
                      <Button
                        loading={join.isPending}
                        onClick={() => void joinCommunity(community.id, false)}
                      >
                        Join
                      </Button>
                    )}
                    {joined && <span className={styles.meta}>Joined</span>}
                    {community.status === 'ARCHIVED' && (
                      <span className={styles.meta}>Archived · read-only</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {auth.user?.kind === 'guest' && (
        <p className={styles.meta}>
          You can browse as a guest. Sign-in is required to join; the action continues after you
          link or sign in.
        </p>
      )}
    </main>
  );
}
