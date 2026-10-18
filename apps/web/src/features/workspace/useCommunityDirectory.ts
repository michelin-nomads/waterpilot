import { useMemo, useState } from 'react';

import { useAuth } from '../../auth/authContext';
import { MutationFailure, newIdempotencyKey, unwrapPayload } from '../../graphql/client';
import {
  CommunitiesDocument,
  JoinCommunityDocument,
  LeaveCommunityDocument,
  MyMembershipsDocument,
  NearbyCommunitiesDocument,
  ReportsDocument,
  type CommunitiesQuery,
} from '../../graphql/generated/graphql';
import { useGraphQLMutation, useGraphQLQuery } from '../../graphql/hooks';
import { queryKeys } from '../../graphql/queryKeys';

export type CommunityItem = CommunitiesQuery['communities']['nodes'][number];
export type DirectoryView = 'all' | 'mine' | 'nearby';

const PAGE = { first: 50 };
const ALL_REPORTS = {};

export interface NearbyCentre {
  areaId: string;
  label: string;
  latitude: string;
  longitude: string;
}

/**
 * Everything the Communities tab shows: the directory for the chosen view (all, mine or
 * near one of your reports' locations), search, archived filter and joining. Nearby needs
 * a centre, so it is offered the locations of the person's own reports; without a report
 * there is nothing to search around and the view says so.
 */
export function useCommunityDirectory() {
  const auth = useAuth();
  const [view, setView] = useState<DirectoryView>('all');
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [radius, setRadius] = useState(5000);
  const [centreId, setCentreId] = useState<string | null>(null);
  const [selectedCentre, setSelectedCentre] = useState<NearbyCentre | null>(null);
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});
  const [actionError, setActionError] = useState<{ id: string; message: string } | null>(null);

  const nearbyMode = view === 'nearby';
  const mineMode = view === 'mine';

  const filter = { includeArchived: showArchived, archivedOnly: showArchived };
  const all = useGraphQLQuery(queryKeys.communities.list(filter, PAGE), CommunitiesDocument, {
    filter,
    ...PAGE,
  });
  const memberships = useGraphQLQuery(
    queryKeys.communities.memberships(PAGE),
    MyMembershipsDocument,
    PAGE,
    { enabled: mineMode },
  );
  const reports = useGraphQLQuery(
    queryKeys.reports.list(ALL_REPORTS, PAGE),
    ReportsDocument,
    { filter: ALL_REPORTS, ...PAGE },
    { enabled: nearbyMode && selectedCentre === null },
  );

  const centres = useMemo<NearbyCentre[]>(() => {
    const seen = new Map<string, NearbyCentre>();
    for (const report of reports.data?.reports.nodes ?? []) {
      const area = report.area;
      if (area && !seen.has(area.id)) {
        seen.set(area.id, {
          areaId: area.id,
          label: area.name,
          latitude: area.centroidLat,
          longitude: area.centroidLon,
        });
      }
    }
    return [...seen.values()];
  }, [reports.data]);
  const centre =
    selectedCentre ?? centres.find((item) => item.areaId === centreId) ?? centres[0] ?? null;

  const near = {
    latitude: centre?.latitude ?? '0',
    longitude: centre?.longitude ?? '0',
    radiusMeters: radius,
  };
  const nearby = useGraphQLQuery(
    queryKeys.communities.nearby(near, PAGE),
    NearbyCommunitiesDocument,
    { near, ...PAGE },
    { enabled: nearbyMode && centre !== null },
  );
  const join = useGraphQLMutation('joinCommunity', JoinCommunityDocument);
  const leave = useGraphQLMutation('leaveCommunity', LeaveCommunityDocument);

  const rows = useMemo(() => {
    const source: CommunityItem[] = mineMode
      ? (memberships.data?.myMemberships.nodes.map((node) => node.community) ?? []).filter(
          (item) => (showArchived ? item.status === 'ARCHIVED' : item.status === 'ACTIVE'),
        )
      : nearbyMode
        ? (nearby.data?.nearbyCommunities.nodes.map((node) => node.community) ?? [])
        : (all.data?.communities.nodes ?? []);
    const term = search.trim().toLocaleLowerCase();
    return term
      ? source.filter((item) =>
          `${item.name} ${item.description} ${item.area?.name ?? ''} ${item.area?.countryCode ?? ''}`
            .toLocaleLowerCase()
            .includes(term),
        )
      : source;
  }, [all.data, memberships.data, nearby.data, nearbyMode, mineMode, search, showArchived]);

  const active = mineMode ? memberships : nearbyMode ? nearby : all;
  const loadingReports = selectedCentre === null && reports.isPending;
  const waitingForCentre = nearbyMode && (loadingReports || centre === null);
  const pending = nearbyMode
    ? loadingReports || (centre !== null && nearby.isPending)
    : active.isPending;
  const failed = nearbyMode
    ? (selectedCentre === null && reports.isError) || nearby.isError
    : active.isError;

  const distanceMeters = (communityId: string): number | null =>
    nearbyMode
      ? (nearby.data?.nearbyCommunities.nodes.find((node) => node.community.id === communityId)
          ?.distanceMeters ?? null)
      : null;

  const joinCommunity = async (communityId: string, wasJoined: boolean) => {
    setActionError(null);
    setOptimistic((state) => ({ ...state, [communityId]: true }));
    let completed = false;
    try {
      if (!(await auth.ensurePermanent('Sign in to join this community.'))) return;
      const result = await join.mutateAsync({ communityId, idempotencyKey: newIdempotencyKey() });
      unwrapPayload(result.joinCommunity);
      completed = true;
    } catch {
      setActionError({
        id: communityId,
        message: 'Join failed. The membership change was rolled back; try again.',
      });
    } finally {
      setOptimistic((state) => ({ ...state, [communityId]: completed ? true : wasJoined }));
    }
  };

  const leaveCommunity = async (community: CommunityItem) => {
    if (
      !community.viewerMembership ||
      !window.confirm(`Leave ${community.name}? Member-only history will no longer be accessible.`)
    )
      return;
    setActionError(null);
    setOptimistic((state) => ({ ...state, [community.id]: false }));
    try {
      const result = await leave.mutateAsync({
        communityId: community.id,
        expectedVersion: community.viewerMembership.version,
      });
      unwrapPayload(result.leaveCommunity);
    } catch (error) {
      setOptimistic((state) => ({ ...state, [community.id]: true }));
      setActionError({
        id: community.id,
        message:
          error instanceof MutationFailure
            ? error.message
            : 'Could not leave this community. Your membership was restored; try again.',
      });
    }
  };

  const changeView = (next: DirectoryView) => {
    setView(next);
    // Archived communities are listed under All and Mine only.
    if (next === 'nearby') setShowArchived(false);
  };

  return {
    view,
    changeView,
    search,
    setSearch,
    showArchived,
    setShowArchived: (value: boolean) => {
      setShowArchived(value);
      if (value && nearbyMode) setView('all');
    },
    radius,
    setRadius,
    centres,
    centre,
    setCentreId,
    rows,
    pending,
    failed,
    waitingForCentre,
    noCentre: nearbyMode && !loadingReports && centre === null,
    selectSearchCentre: (next: NearbyCentre) => {
      setSelectedCentre(next);
      setSearch('');
      setShowArchived(false);
      setView('nearby');
    },
    truncated: nearbyMode && Boolean(nearby.data?.nearbyCommunities.candidatesTruncated),
    retry: () =>
      void (nearbyMode ? Promise.all([reports.refetch(), nearby.refetch()]) : active.refetch()),
    retrying: active.isFetching,
    distanceMeters,
    isJoined: (community: CommunityItem) =>
      optimistic[community.id] ?? Boolean(community.viewerMembership),
    joinCommunity,
    leaveCommunity,
    joining: join.isPending || leave.isPending,
    actionError,
  };
}
