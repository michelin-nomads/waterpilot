import { StageNotBuilt, StagePage } from '../planning/StagePage';

export default function PlansPage() {
  return (
    <StagePage stageId="plans">
      <StageNotBuilt
        stageId="plans"
        capabilities={[
          'Show up to three feasible plans calculated by the deterministic engine, and fewer when fewer are feasible.',
          'Compare cost, implementation time, first benefit and projected change, with assumptions.',
          'Show neighbour impact only where coupled evidence exists, and flag false resilience.',
          'Include the What-if panel so you can test each plan against changed conditions (Phase 09).',
        ]}
      />
    </StagePage>
  );
}
