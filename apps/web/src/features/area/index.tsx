import { ButtonLink, LoadingRegion, Skeleton } from '../../components';
import { env } from '../../config/env';
import { usePlanningSession } from '../../session/sessionContext';
import { SavedAreaUnderstanding } from './SavedAreaUnderstanding';
import { StagePage } from '../planning/StagePage';

function Body() {
  const { state, view } = usePlanningSession();
  if (state.status === 'loading' || !view) {
    return (
      <LoadingRegion label="Loading your planning session">
        <Skeleton shape="block" />
      </LoadingRegion>
    );
  }
  return <SavedAreaUnderstanding areaId={view.areaId ?? null} sessionId={view.id} />;
}

export default function AreaPage() {
  return (
    <StagePage
      stageId="area"
      title="Understand your area"
      subtitle="Get a clear view of your community’s water situation. Select an area to explore local conditions."
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
