import { StageNotBuilt, StagePage } from '../planning/StagePage';

export default function GoalsPage() {
  return (
    <StagePage stageId="goals">
      <StageNotBuilt
        stageId="goals"
        capabilities={[
          'Offer quick goals and a custom goal that is interpreted, then confirmed by you before use.',
          'Capture budget (INR), implementation deadline and priority as explicit constraints.',
          'Mark goals that need data the location does not have (for example water quality) as unavailable.',
        ]}
      />
    </StagePage>
  );
}
