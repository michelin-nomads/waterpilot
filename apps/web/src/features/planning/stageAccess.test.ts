import { PLANNING_STAGES } from '../../shell/stages';
import { FakeSessionServer } from '../../test/fakeSession';
import { canOpenStage, unlockedStageIndex } from './stageAccess';

it('unlocks one step at a time from saved completion, irrespective of the visited route', () => {
  const session = new FakeSessionServer().seed('owner');
  expect(unlockedStageIndex(session)).toBe(0);
  session.stage = 'REVIEW';
  expect(unlockedStageIndex(session)).toBe(0);
  session.areaId = 'area';
  expect(unlockedStageIndex(session)).toBe(1);
  session.baselineReviewed = true;
  expect(unlockedStageIndex(session)).toBe(1);
  session.scenario = { adjustments: [], confirmed: true };
  expect(unlockedStageIndex(session)).toBe(2);
  session.goal = { kind: 'REDUCE_SHORTAGE' };
  expect(unlockedStageIndex(session)).toBe(3);
  session.selectedPlanOptionId = 'plan';
  expect(unlockedStageIndex(session)).toBe(5);
  session.baselineReviewed = false;
  expect(canOpenStage(PLANNING_STAGES[2]!, session)).toBe(true);
});
