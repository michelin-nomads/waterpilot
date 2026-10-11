import { StageNotBuilt, StagePage } from '../planning/StagePage';

export default function FundingPage() {
  return (
    <StagePage stageId="funding">
      <StageNotBuilt
        stageId="funding"
        capabilities={[
          'Review the selected plan, with expected return calculated from stated assumptions, then finalize a report (permanent sign-in required).',
          'Show possible funding fits from a curated, verifiable catalogue: which listed criteria are met or need checking, never a guaranteed outcome.',
          'Generate a proposal you review before downloading it (Phase 14).',
        ]}
      />
    </StagePage>
  );
}
