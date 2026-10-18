import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button, LoadingRegion, Notice, Skeleton, StepActions } from '../../components';
import { AreaLocationDocument } from '../../graphql/generated/graphql';
import { useGraphQLQuery } from '../../graphql/hooks';
import { queryKeys } from '../../graphql/queryKeys';
import { LocationStep } from '../location/LocationStep';
import { LocationSummary } from '../location/LocationSummary';
import { usePlanningSession } from '../../session/sessionContext';

/** Keep one editor mounted while confirmation updates the session's area. */
export function SavedAreaUnderstanding({
  areaId,
  sessionId,
}: {
  areaId: string | null;
  sessionId: string;
}) {
  const [initialAreaId] = useState(areaId);
  const [ready, setReady] = useState(false);
  const [refresh, setRefresh] = useState(false);
  const { inputsPending } = usePlanningSession();
  const navigate = useNavigate();
  const location = useGraphQLQuery(
    queryKeys.areas.detail(initialAreaId ?? ''),
    AreaLocationDocument,
    { id: initialAreaId ?? '' },
    { enabled: Boolean(initialAreaId) },
  );
  if (initialAreaId && location.isPending)
    return (
      <LoadingRegion label="Loading your area">
        <Skeleton shape="block" />
      </LoadingRegion>
    );
  if (initialAreaId && (!location.data?.area || location.isError) && !refresh)
    return <LocationSummary areaId={initialAreaId} onChange={() => setRefresh(true)} />;
  const area = location.data?.area;
  return (
    <>
      {area?.providerContentExpired && (
        <Notice kind="stale" title="Place details need refreshing">
          Place details are kept for at most 30 days. Search for your place again to refresh them.
        </Notice>
      )}
      <LocationStep
        initialArea={area && !area.providerContentExpired ? area : undefined}
        sessionId={sessionId}
        onConfirmed={() => undefined}
        onResultsChange={setReady}
      />
      {ready && !inputsPending && (
        <StepActions
          primary={
            <Button onClick={() => navigate('/baseline')} endIcon="arrow-right">
              Continue to baseline
            </Button>
          }
        />
      )}
    </>
  );
}
