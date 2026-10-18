import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button, LoadingRegion, Notice, Skeleton, StepActions } from '../../components';
import { AreaLocationDocument } from '../../graphql/generated/graphql';
import { useGraphQLQuery } from '../../graphql/hooks';
import { queryKeys } from '../../graphql/queryKeys';
import { LocationStep } from '../location/LocationStep';
import { LocationSummary } from '../location/LocationSummary';
import { SHOW_COMMUNITY_BASELINE } from '../planning/visibility';
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
  const { view, inputsPending, coordinator } = usePlanningSession();
  const isResuming = Boolean(view?.baselineReviewed || (view?.stage && view.stage !== 'UNDERSTAND'));
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
  // Retrieve previously confirmed area from sessionStorage if query is empty
  const storedArea = (() => {
    try {
      const raw =
        (initialAreaId ? sessionStorage.getItem(`waterpilot.confirmed_area.${initialAreaId}`) : null) ??
        (sessionId && isResuming ? sessionStorage.getItem(`waterpilot.confirmed_area.${sessionId}`) : null);
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  })();

  const area = location.data?.area ?? storedArea ?? undefined;
  if (initialAreaId && !area && location.isError && !refresh)
    return <LocationSummary areaId={initialAreaId} onChange={() => setRefresh(true)} />;
  return (
    <>
      {area?.providerContentExpired && (
        <Notice kind="stale" title="Place details need refreshing">
          Place details are kept for at most 30 days. Search for your place again to refresh them.
        </Notice>
      )}
      <LocationStep
        suggestDeviceLocation={!initialAreaId}
        initialArea={area && !area.providerContentExpired ? area : undefined}
        sessionId={sessionId}
        isResuming={isResuming}
        onConfirmed={(confirmedArea) => {
          try {
            sessionStorage.setItem(`waterpilot.confirmed_area.${sessionId}`, JSON.stringify(confirmedArea));
            sessionStorage.setItem(`waterpilot.confirmed_area.${confirmedArea.id}`, JSON.stringify(confirmedArea));
          } catch {}
        }}
        onResultsChange={setReady}
      />
      {ready && !inputsPending && (
        <StepActions
          primary={
            <Button
              onClick={() => {
                coordinator?.markBaselineReviewed();
                navigate(SHOW_COMMUNITY_BASELINE ? '/baseline' : '/scenarios');
              }}
              endIcon="arrow-right"
            >
              {SHOW_COMMUNITY_BASELINE ? 'Continue to baseline' : 'Test a Future Scenario'}
            </Button>
          }
        />
      )}
    </>
  );
}
