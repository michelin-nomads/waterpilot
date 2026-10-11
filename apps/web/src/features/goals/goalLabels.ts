import type { IconName } from '../../components';
import type {
  GoalKind,
  GoalOutcome,
  Priority,
  SiteRestriction,
  SiteScale,
  TargetMode,
  Unit,
} from '../../graphql/generated/graphql';
import type { StatusTone } from '../../lib/status';

export const OUTCOME: Record<GoalOutcome, { label: string; tone: StatusTone; icon: IconName }> = {
  FEASIBLE: { label: 'Can be planned', tone: 'success', icon: 'check' },
  INFEASIBLE: { label: 'Cannot be met as set', tone: 'danger', icon: 'alert' },
  NOT_ASSESSABLE: { label: 'Not yet assessable', tone: 'warning', icon: 'info' },
};

export const FIT_LABEL: Record<GoalOutcome, string> = {
  FEASIBLE: 'Fits',
  INFEASIBLE: 'Ruled out',
  NOT_ASSESSABLE: 'Unknown',
};

export const KIND_LABEL: Record<GoalKind, string> = {
  REDUCE_SHORTAGE: 'Reduce water shortage',
  REDUCE_TANKER_DEPENDENCE: 'Reduce tanker dependence',
  IMPROVE_GROUNDWATER: 'Improve groundwater',
  REDUCE_WATER_BILLS: 'Reduce water bills',
  REDUCE_FLOOD_RISK: 'Reduce flooding',
  IMPROVE_WATER_QUALITY: 'Improve water quality',
  CUSTOM: 'Custom goal',
};

export const STANDARD_KINDS: readonly GoalKind[] = [
  'REDUCE_SHORTAGE',
  'REDUCE_TANKER_DEPENDENCE',
  'IMPROVE_GROUNDWATER',
  'REDUCE_WATER_BILLS',
  'REDUCE_FLOOD_RISK',
  'IMPROVE_WATER_QUALITY',
];

/** Target forms the server accepts per goal (it re-checks; this only shapes the form). */
export const MODES: Record<GoalKind, readonly TargetMode[]> = {
  REDUCE_SHORTAGE: ['ABSOLUTE_LEVEL', 'RELATIVE_REDUCTION'],
  REDUCE_TANKER_DEPENDENCE: ['RELATIVE_REDUCTION', 'ABSOLUTE_LEVEL'],
  IMPROVE_GROUNDWATER: ['ABSOLUTE_LEVEL'],
  REDUCE_WATER_BILLS: ['RELATIVE_REDUCTION'],
  REDUCE_FLOOD_RISK: ['ABSOLUTE_LEVEL'],
  IMPROVE_WATER_QUALITY: ['ABSOLUTE_LEVEL'],
  CUSTOM: ['RELATIVE_REDUCTION', 'ABSOLUTE_LEVEL'],
};

export const MODE_LABEL: Record<TargetMode, string> = {
  RELATIVE_REDUCTION: 'Reduce by a percentage',
  ABSOLUTE_LEVEL: 'Reach a level',
};

export const UNITS: Record<GoalKind, readonly Unit[]> = {
  REDUCE_SHORTAGE: ['DAY'],
  REDUCE_TANKER_DEPENDENCE: ['RATIO'],
  IMPROVE_GROUNDWATER: ['METRES_BELOW_GROUND'],
  REDUCE_WATER_BILLS: ['RATIO'],
  REDUCE_FLOOD_RISK: ['COUNT'],
  IMPROVE_WATER_QUALITY: ['NTU', 'MG_PER_LITRE', 'MICROSIEMENS_PER_CM', 'PH', 'CFU_PER_100ML'],
  CUSTOM: ['COUNT', 'DAY', 'RATIO', 'LITRES_PER_DAY', 'LITRE', 'MILLIMETRE', 'METRES_BELOW_GROUND'],
};

export const UNIT_LABEL: Partial<Record<Unit, string>> = {
  DAY: 'days a year',
  RATIO: '%',
  METRES_BELOW_GROUND: 'm below ground',
  COUNT: 'events a year',
  NTU: 'NTU (turbidity)',
  MG_PER_LITRE: 'mg/L',
  MICROSIEMENS_PER_CM: 'µS/cm (conductivity)',
  PH: 'pH',
  CFU_PER_100ML: 'CFU/100 mL (bacteria)',
  LITRES_PER_DAY: 'litres a day',
  LITRE: 'litres',
  MILLIMETRE: 'mm',
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  LOWEST_COST: 'Lowest cost',
  FASTEST_BENEFIT: 'Fastest benefit',
  LARGEST_IMPACT: 'Largest impact',
  LOWEST_NEIGHBOUR_EFFECT: 'Least effect on neighbours',
};

export const SCALE_LABEL: Record<SiteScale, string> = {
  HOUSEHOLD: 'A household',
  BUILDING: 'A building or apartment complex',
  NEIGHBOURHOOD: 'A neighbourhood',
  UTILITY: 'A utility network',
};

export const RESTRICTION_LABEL: Record<SiteRestriction, string> = {
  NO_EXCAVATION: 'No digging or excavation',
  NO_STRUCTURAL_CHANGES: 'No structural or plumbing changes',
  NO_RECHARGE: 'No sending water into the ground',
  NO_GREYWATER_REUSE: 'No greywater reuse',
  NO_PERMIT_WORKS: 'No works that need a permit',
};
