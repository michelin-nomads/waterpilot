import type {
  CanonicalUnit,
  Capability,
  ReadinessInput,
  ReadinessState,
  TechnicalSupport,
} from '../../graphql/generated/graphql';
import type { StatusTone } from '../../lib/status';

export const STATE_LABEL: Record<ReadinessState, { label: string; tone: StatusTone }> = {
  AVAILABLE: { label: 'Available', tone: 'success' },
  USER_ENTERED: { label: 'Entered by you', tone: 'accent' },
  PARTIAL: { label: 'Partial', tone: 'warning' },
  STALE: { label: 'Out of date', tone: 'warning' },
  UNAVAILABLE: { label: 'Unavailable', tone: 'neutral' },
};

export const CAPABILITY_LABEL: Record<Capability, string> = {
  RAINFALL: 'Rainfall',
  GROUNDWATER_ABSTRACTION: 'Groundwater pumping',
  GROUNDWATER_LEVEL: 'Groundwater level',
  SURFACE_WATER: 'Surface water',
  WATER_QUALITY: 'Water quality',
  FLOOD_RISK: 'Flood risk',
  LAND_COVER: 'Land cover',
  UTILITY_SUPPLY: 'Utility and tanker supply',
  SHARED_AQUIFER_NEIGHBOUR: 'Shared aquifer effects',
};

export const SUPPORT_LABEL: Record<TechnicalSupport, string> = {
  SUPPORTED: 'Method exists',
  PROVISIONAL: 'Method provisional',
  UNAVAILABLE: 'No method yet',
};

/** Metric ids from docs/domain/metrics.registry.json, in user terms. */
export const METRIC_LABEL: Record<string, string> = {
  demand: 'Water demand',
  delivered_supply: 'Delivered supply',
  reliable_supply: 'Reliable supply',
  dependable_supply_ratio: 'Dependable supply',
  deficit: 'Supply gap',
  shortage_days: 'Shortage days',
  days_until_shortage: 'Days until shortage',
  volume_reliability: 'Volume reliability',
  time_reliability: 'Time reliability',
  tanker_dependence: 'Tanker dependence',
  project_cost: 'Project cost',
  avoided_cost: 'Avoided cost',
  net_benefit: 'Net benefit',
  payback_period: 'Payback period',
};

interface EntryUnit {
  /** Sent to the server, which converts it exactly to the canonical unit. */
  value: string;
  label: string;
}

const RATE_UNITS: readonly EntryUnit[] = [
  { value: 'MLD', label: 'MLD (million litres per day)' },
  { value: 'kL/day', label: 'kilolitres per day' },
  { value: 'm3/day', label: 'cubic metres per day' },
  { value: 'L/day', label: 'litres per day' },
];

/** Units offered when typing each input. Inputs not listed cannot be typed in. */
export const ENTRY_UNITS: Partial<Record<ReadinessInput, readonly EntryUnit[]>> = {
  POPULATION: [{ value: 'people', label: 'people' }],
  PER_CAPITA_STANDARD: [{ value: 'L/day', label: 'litres per person per day' }],
  NON_DOMESTIC_DEMAND: RATE_UNITS,
  DELIVERED_SUPPLY: RATE_UNITS,
  TANKER_SUPPLY: RATE_UNITS,
};

/** Canonical unit names for values the server returns. */
export const UNIT_SHORT: Partial<Record<CanonicalUnit, string>> = {
  COUNT: 'people',
  LITRES_PER_DAY: 'L/day',
};
