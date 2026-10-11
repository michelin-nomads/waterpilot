import { StageNotBuilt, StagePage } from '../planning/StagePage';

export default function TrackingPage() {
  return (
    <StagePage stageId="tracking">
      <StageNotBuilt
        stageId="tracking"
        capabilities={[
          'Turn the selected plan into a project with phases, tasks and milestones.',
          'Record dated measurements with units and evidence.',
          'Compare observed results with the original forecast, without claiming causation.',
        ]}
      />
    </StagePage>
  );
}
