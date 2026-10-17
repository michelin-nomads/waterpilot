import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button, ButtonLink, LoadingRegion, Notice, Skeleton, StepActions } from '../../components';
import { env } from '../../config/env';
import { usePlanningSession } from '../../session/sessionContext';
import { LocationStep } from '../location/LocationStep';
import { LocationSummary } from '../location/LocationSummary';
import { StagePage } from '../planning/StagePage';

function Body() {
  const navigate = useNavigate();
  const { state, view, inputsPending } = usePlanningSession();
  const [changing, setChanging] = useState(false);
  if (state.status === 'loading') {
    return (
      <LoadingRegion label="Loading your planning session">
        <Skeleton shape="block" />
      </LoadingRegion>
    );
  }
  const areaId = view?.areaId ?? null;
  const savedArea = state.server?.areaId ?? null;
  if (!areaId || changing) {
    return (
      <LocationStep
        onConfirmed={() => {
          setChanging(false);
          navigate('/baseline');
        }}
        onCancel={areaId ? () => setChanging(false) : undefined}
      />
    );
  }
  const saved = savedArea === areaId;
  return (
    <>
      {!saved && (
        <Notice kind="stale">
          Saving your location change; the baseline and readiness will update.
        </Notice>
      )}
      <LocationSummary areaId={areaId} onChange={() => setChanging(true)} />
      {saved && !inputsPending && (
        <StepActions
          primary={<Button onClick={() => navigate('/baseline')}>Confirm location</Button>}
        />
      )}
    </>
  );
}

export default function AreaPage() {
  return (
    <StagePage
      stageId="area"
      title="Confirm your location"
      subtitle="Choose the area for your water plan. You can change it before confirming."
    >
      <Body />
      {env.appMode === 'local' && (
        <ButtonLink to="/simulations/sjr-parkway-homes" variant="ghost">
          Explore SJR Parkway Homes — synthetic simulation
        </ButtonLink>
      )}
    </StagePage>
  );
}
