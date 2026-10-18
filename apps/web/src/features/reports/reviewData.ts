import type {
  ComparedOptionFieldsFragment,
  PlanComparisonQuery,
} from '../../graphql/generated/graphql';
import type { SessionState } from '../../session/sessionState';

export type ReviewPanel = 'area' | 'goal' | 'plan' | 'funding' | 'impact' | 'evidence';
export type ReviewComparison = NonNullable<
  PlanComparisonQuery['planningSession']
>['planComparison'];
export interface ReviewData {
  current: SessionState;
  comparison: ReviewComparison;
  selected: ComparedOptionFieldsFragment;
}
export function areaExtent(current: SessionState): string {
  if (current.areaExtent === 'USER_RADIUS')
    return current.areaRadiusMeters == null
      ? 'Circle · radius not recorded'
      : `${current.areaRadiusMeters / 1000} km planning radius`;
  if (current.areaExtent === 'REVIEWED_BOUNDARY') return 'Confirmed catalogue boundary';
  if (current.areaExtent === 'REFERENCE_POINT') return 'Reference point · no area boundary';
  return 'Planning extent not recorded';
}
