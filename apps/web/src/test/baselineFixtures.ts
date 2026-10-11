import type {
  AreaBaselineQuery,
  BaselineFieldsFragment,
  UnitSystem,
} from '../graphql/generated/graphql';

type Baseline = BaselineFieldsFragment;
type Metric = Baseline['metrics'][number];
type Link = Metric['evidence'][number];

const DEFINITIONS: Record<string, [string, string, Metric['unit'], boolean]> = {
  demand: [
    'Demand',
    'demand_day = population * per_capita_lpcd + non_domestic_demand_day',
    'LITRES_PER_DAY',
    false,
  ],
  delivered_supply: [
    'Delivered supply',
    'delivered_supply_day = sum(contribution_source_day) over sources',
    'LITRES_PER_DAY',
    true,
  ],
  reliable_supply: [
    'Reliable supply (dependable yield)',
    'max{ v : P(delivered_supply_day >= v) >= p }',
    'LITRES_PER_DAY',
    true,
  ],
  deficit: [
    'Deficit (reliable-supply basis)',
    'max(0, demand - reliable_supply)',
    'LITRES_PER_DAY',
    true,
  ],
  dependable_supply_ratio: ['Dependable-supply ratio', 'reliable_supply / demand', 'RATIO', true],
  volume_reliability: [
    'Volume reliability',
    'sum(min(delivered_supply_day, demand_day)) / sum(demand_day)',
    'RATIO',
    true,
  ],
  time_reliability: [
    'Time reliability',
    'count{ day : delivered_supply_day >= demand_day } / count{ day in window }',
    'RATIO',
    true,
  ],
  shortage_days: [
    'Shortage-day count',
    'count{ day in [start,end) : delivered_supply_day < demand_day }',
    'DAY',
    true,
  ],
  tanker_dependence: [
    'Tanker dependence',
    'sum(tanker_contribution_day) / sum(delivered_supply_day)',
    'RATIO',
    true,
  ],
  days_until_shortage: [
    'Days until shortage (lead time)',
    'min{ day - reference_date : day >= reference_date, delivered_supply_day < demand_day }',
    'DAY',
    true,
  ],
};

export const METRIC_IDS = Object.keys(DEFINITIONS);

export function unavailableMetric(id: string, reason = 'A value it needs is missing.'): Metric {
  const [name, formula, unit, daily] = DEFINITIONS[id] ?? ['?', '?', 'RATIO', false];
  return {
    metric: id,
    name,
    formula,
    unit,
    availability: 'UNAVAILABLE',
    exact: null,
    value: null,
    reason: 'MISSING_INPUT',
    reasons: [reason],
    origin: null,
    daily,
    asOf: null,
    assumptions: [],
    demo: false,
    recordedDays: null,
    periodDays: null,
    evidence: [],
    supporting: [],
  };
}

export function valueMetric(id: string, value: string, over: Partial<Metric> = {}): Metric {
  return {
    ...unavailableMetric(id),
    availability: 'PROVISIONAL',
    exact: value,
    value,
    reason: null,
    reasons: [],
    origin: 'USER_ESTIMATE',
    asOf: '2026-10-01',
    ...over,
  };
}

export const manualLink = (title: string): Link => ({
  input: 'POPULATION',
  capability: null,
  snapshotId: null,
  manualInputId: `min_${title.length}`,
  title: `${title} (entered by you)`,
  publisher: null,
  url: null,
  asOf: '2026-10-01',
  quality: null,
  method: null,
  uncertainty: 'Not quantified: a value you entered.',
  note: '12000 people — Ward census table',
  demo: false,
});

export const demoLink: Link = {
  input: 'DELIVERED_SUPPLY',
  capability: 'UTILITY_SUPPLY',
  snapshotId: 'synthetic-utility-supply-demo-abc',
  manualInputId: null,
  title: 'Synthville daily utility and tanker supply (SYNTHETIC DEMO — not a real source)',
  publisher: 'WaterLens test fixtures',
  url: 'https://example.invalid/synthetic-demo',
  asOf: '2026-01-10',
  quality: 'SYNTHETIC',
  method: 'ADMINISTRATIVE_RECORD',
  uncertainty: 'Not quantified: Synthetic values have no measurement process.',
  note: null,
  demo: true,
};

const INDICATORS: Baseline['indicators'] = [
  ['rainfall_total', 'Rainfall over the reporting window', 'RAINFALL', 'WINDOW_TOTAL'],
  ['groundwater_level', 'Latest groundwater level', 'GROUNDWATER_LEVEL', 'LATEST'],
  ['flood_risk', 'Flood-risk category', 'FLOOD_RISK', 'LATEST'],
].map(([indicator, name, capability, statistic]) => ({
  indicator: indicator as string,
  name: name as string,
  capability: capability as Baseline['indicators'][number]['capability'],
  statistic: statistic as Baseline['indicators'][number]['statistic'],
  variable: null,
  parameter: null,
  unit: null,
  availability: 'UNAVAILABLE',
  exact: null,
  value: null,
  observedOn: null,
  reason: 'MISSING_INPUT',
  reasons: ['No source is registered for this capability.'],
  origin: null,
  demo: false,
  window: null,
  evidence: [],
}));

export function baseline(over: Partial<Baseline> = {}): Baseline {
  return {
    id: 'bsl_EMPTY',
    areaId: 'are_TESTAREA0000000000000000000',
    sessionId: 'ses_1',
    asOf: '2026-10-10',
    engineVersion: 'baseline-1',
    exceedanceP: '0.9',
    windowDays: 365,
    demo: false,
    basis: 'USER_INPUT',
    window: null,
    missingEssentials: ['POPULATION', 'PER_CAPITA_STANDARD', 'DELIVERED_SUPPLY'],
    missingOptional: ['NON_DOMESTIC_DEMAND', 'TANKER_SUPPLY'],
    notes: [],
    metrics: METRIC_IDS.map((id) => unavailableMetric(id)),
    indicators: INDICATORS,
    chart: null,
    ...over,
  };
}

/** Typed-in values only: population 12,000 × 135 L, 1.2 MLD delivered, 0.36 MLD tanker. */
export function manualBaseline(): Baseline {
  const needsDaily = 'It is defined day by day; one average does not show how supply varies.';
  return baseline({
    id: 'bsl_MANUAL',
    missingEssentials: [],
    missingOptional: ['NON_DOMESTIC_DEMAND'],
    metrics: [
      valueMetric('demand', '1620000', {
        assumptions: ['Non-domestic use was not provided, so it is not included.'],
        reasons: ['Population served: a value you entered.'],
        evidence: [manualLink('Population served'), manualLink('Per-person daily water need')],
      }),
      valueMetric('delivered_supply', '1200000', { daily: false }),
      ...[
        'reliable_supply',
        'deficit',
        'dependable_supply_ratio',
        'volume_reliability',
        'time_reliability',
        'shortage_days',
      ].map((id) => ({
        ...unavailableMetric(id, needsDaily),
        reason: 'NEEDS_DAILY_SERIES' as const,
      })),
      valueMetric('tanker_dependence', '0.3', { exact: '3/10', daily: false }),
      {
        ...unavailableMetric(
          'days_until_shortage',
          'It needs a forward projection, which comes with scenarios.',
        ),
        reason: 'NEEDS_FORWARD_SERIES',
      },
    ],
  });
}

const DAYS = Array.from({ length: 10 }, (_, i) => `2026-01-${String(i + 1).padStart(2, '0')}`);

/** The SYNTHETIC golden fixture through the demo source (docs/domain/fixtures). */
export function demoBaseline(gapAt: number | null = null): Baseline {
  const measured = {
    origin: 'MEASURED' as const,
    demo: true,
    evidence: [demoLink],
    recordedDays: 10,
    periodDays: 10,
  };
  const estimate = { origin: 'USER_ESTIMATE' as const, demo: true, evidence: [demoLink] };
  const supply = ['11', '11', '11', '11', '11', '11', '11', '8', '8', '8'].map((m) => `${m}000000`);
  return baseline({
    id: 'bsl_DEMO',
    demo: true,
    basis: 'LIMITED',
    asOf: '2026-01-11',
    window: { start: '2026-01-01', endExclusive: '2026-01-11', days: 10 },
    missingEssentials: [],
    missingOptional: ['NON_DOMESTIC_DEMAND'],
    notes: ['Daily records cover 10 of the last 365 days (2026-01-01 to 2026-01-10).'],
    metrics: [
      valueMetric('demand', '10000000', { daily: false }),
      valueMetric('delivered_supply', '10100000', measured),
      valueMetric('reliable_supply', '8000000', measured),
      valueMetric('deficit', '2000000', estimate),
      valueMetric('dependable_supply_ratio', '0.8', { ...estimate, exact: '4/5' }),
      valueMetric('volume_reliability', '0.94', { ...estimate, exact: '47/50' }),
      valueMetric('time_reliability', '0.7', { ...estimate, exact: '7/10' }),
      valueMetric('shortage_days', '3', {
        ...estimate,
        supporting: [
          { key: 'daily_deficit_total', exact: '6000000', value: '6000000', unit: 'LITRE' },
        ],
      }),
      valueMetric('tanker_dependence', '0.2673267326732673267326732673', {
        ...measured,
        exact: '27/101',
      }),
      unavailableMetric('days_until_shortage'),
    ],
    chart: {
      monthly: false,
      buckets: DAYS.map((start, i) => ({
        start,
        endExclusive: DAYS[i + 1] ?? '2026-01-11',
        days: 1,
      })),
      series: [
        {
          key: 'delivered_supply',
          values: supply.map((v, i) => (i === gapAt ? null : v)),
          origin: 'MEASURED',
          demo: true,
        },
        {
          key: 'demand',
          values: DAYS.map(() => '10000000'),
          origin: 'USER_ESTIMATE',
          demo: false,
        },
        {
          key: 'tanker_supply',
          values: ['3', '3', '3', '3', '3', '3', '3', '2', '2', '2'].map((m) => `${m}000000`),
          origin: 'MEASURED',
          demo: true,
        },
      ],
    },
  });
}

export function baselineReply(
  b: Baseline = baseline(),
  unitSystem: UnitSystem = 'METRIC',
): { data: AreaBaselineQuery } {
  return { data: { area: { id: b.areaId, name: 'Test ward', unitSystem, baseline: b } } };
}
