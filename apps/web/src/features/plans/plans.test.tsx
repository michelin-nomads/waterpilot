import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

import type {
  ComparedOptionFieldsFragment,
  ImpactContextFieldsFragment,
  ImpactFindingFieldsFragment,
  PlanComparisonQuery,
  ScenarioComparisonFieldsFragment,
  WiderImpactFieldsFragment,
} from '../../graphql/generated/graphql';
import { apiClient } from '../../lib/apiClient';
import type { SessionState } from '../../session/sessionState';
import { AuthTestProviders } from '../../test/AuthTestProviders';
import { FakeAuthBackend, permanent } from '../../test/fakeAuth';
import { FakeSessionServer } from '../../test/fakeSession';
import ScenarioPage from './ScenarioPage';
import { ModernScenarioPanel } from './ModernScenarioPanel';
import AgentScenario from './AgentScenario';
import PlansPage from './index';
import {
  emptyWhatIf,
  formatChange,
  formatMetric,
  formatMoneyRange,
  formatReading,
  fromAdjustments,
  rowOf,
  toAdjustments,
} from './plansFormat';

type Comparison = NonNullable<PlanComparisonQuery['planningSession']>['planComparison'];

const n = (exact: string, value = exact) => ({ exact, value });

const GOAL: SessionState['goal'] = {
  kind: 'REDUCE_TANKER_DEPENDENCE',
  target: { mode: 'RELATIVE_REDUCTION', quantity: { value: '0.5', unit: 'RATIO' } },
};

const COMPARISON_CITE = {
  kind: 'COMPARISON' as const,
  ref: 'cmp_1',
  label: 'Option comparison (options-1) using your estimates',
  asOf: null,
};

function finding(
  over: Partial<ImpactFindingFieldsFragment> & Pick<ImpactFindingFieldsFragment, 'id' | 'kind'>,
): ImpactFindingFieldsFragment {
  return {
    statement: '',
    basis: 'MECHANISM',
    uncertainty: '',
    system: null,
    direction: null,
    linkage: null,
    interventionIds: [],
    related: [],
    magnitude: null,
    citations: [],
    ...over,
  };
}

const FALSE_RESILIENCE = finding({
  id: 'false_resilience.groundwater',
  kind: 'FALSE_RESILIENCE',
  basis: 'DECLARED',
  system: 'AQUIFER',
  direction: 'POSSIBLE_HARM',
  linkage: 'UNKNOWN',
  statement:
    'Possible false resilience. Your site draws on groundwater, so supply can look secure while pumping lowers the water table for others.',
  uncertainty:
    'Whether this aquifer is shared with neighbours is not known: no reviewed record on file.',
  citations: [
    {
      kind: 'SITE_FACT',
      ref: 'goal.site.groundwater_use',
      label: 'You said the site uses groundwater',
      asOf: null,
    },
  ],
});

function impact(
  optionId: string,
  ids: string[],
  flags: ImpactFindingFieldsFragment[] = [],
): WiderImpactFieldsFragment {
  const greywater = ids.includes('greywater_reuse');
  return {
    id: `imp_${optionId}`,
    engineVersion: 'impact-1',
    catalogueVersion: 'interventions-3',
    inputHash: 'h'.repeat(64),
    localBenefits: [
      finding({
        id: 'benefit.tanker_dependence',
        kind: 'LOCAL_BENEFIT',
        basis: 'ENGINE_ESTIMATE',
        statement:
          'Tanker dependence at your site moves from the baseline towards your target: the range runs from your low to your high estimates.',
        uncertainty: 'Calculated from your own estimate ranges, not measured.',
        magnitude: {
          metricId: 'tanker_dependence',
          unit: 'RATIO',
          baseline: n('3/10', '0.3'),
          atLowEstimates: n('3/73', '0.0410958904109589041095890411'),
          atHighEstimates: n('0', '0'),
        },
        citations: [COMPARISON_CITE],
      }),
    ],
    externalities: [
      finding({
        id: `ext.${ids[0]}.shared_draw`,
        kind: 'EXTERNALITY',
        system: 'AQUIFER',
        direction: 'POSSIBLE_BENEFIT',
        linkage: 'UNKNOWN',
        statement:
          'Using less water can leave more in a shared source for others. Whether this aquifer is shared with neighbours is not known: no reviewed record on file.',
        uncertainty: 'Size not assessed: no reviewed model of the aquifer for this area.',
        interventionIds: [ids[0]!],
      }),
    ],
    falseResilience: flags,
    tradeoffs: [],
    reviews: greywater
      ? [
          {
            kind: 'WATER_QUALITY',
            label: 'Water quality review',
            required: true,
            reasons: ['Treated greywater must be checked before reuse.'],
            interventionIds: ['greywater_reuse'],
          },
        ]
      : [],
  };
}

const UNKNOWN_LINKS = (['AQUIFER', 'CATCHMENT', 'SUPPLY_NETWORK'] as const).map((system) => ({
  system,
  linkage: 'UNKNOWN' as const,
  evidenceIds: [],
}));

const CONTEXT: ImpactContextFieldsFragment = {
  areaName: 'Synthville',
  nearbyRadiusM: 5000,
  groundwater: 'UNKNOWN',
  groundwaterCitations: [],
  waterQualityNote:
    'Readings are shown with their parameter, method and date. WaterPilot does not judge whether water is safe to drink.',
  boundaries: [
    {
      level: 'SITE',
      label: 'Your site',
      detail: 'A building.',
      system: null,
      linkage: null,
      citations: [],
    },
    {
      level: 'AREA',
      label: 'Synthville',
      detail: 'Inside a reviewed boundary.',
      system: null,
      linkage: null,
      citations: [],
    },
    ...(['AQUIFER', 'CATCHMENT', 'SUPPLY_NETWORK'] as const).map((system) => ({
      level: 'SHARED_SYSTEM' as const,
      label: `Shared ${system.toLowerCase()}`,
      detail: 'No reviewed record on file.',
      system,
      linkage: 'UNKNOWN' as const,
      citations: [],
    })),
  ],
  nearby: [{ name: 'Next ward', communityId: 'com_next', distanceM: 900, links: UNKNOWN_LINKS }],
  waterQuality: [],
  unavailable: [
    {
      key: 'neighbour_effects',
      label: 'Effects on neighbours',
      reason: 'Not enough evidence to estimate effects on neighbours.',
    },
  ],
};

type Economics = NonNullable<ComparedOptionFieldsFragment['economics']>;

const m = (minor: string, currency = 'INR') => ({ minorUnits: minor, currency, exponent: 2 });
const mr = (low: string, high: string) => ({ low: m(low), high: m(high) });

function econ(over: Partial<Economics> = {}): Economics {
  return {
    engineVersion: 'economics-1',
    currency: 'INR',
    capex: mr('10000000', '12000000'),
    contingency: { ratio: '0.1', amount: mr('1000000', '1200000') },
    upfrontTotal: mr('11000000', '13200000'),
    recurringAnnual: mr('500000', '600000'),
    recurringReason: null,
    avoidedTankerAnnual: mr('1576800000', '1752000000'),
    avoidedReason: null,
    netAnnual: mr('1576200000', '1751500000'),
    payback: {
      outcome: 'WITHIN_HORIZON',
      optimisticDays: 2,
      pessimisticDays: 3,
      note: 'Costs are recovered within the planning horizon even at your pessimistic estimates.',
    },
    horizon: {
      days: 3650,
      netPositive: true,
      reason: null,
      net: mr('29466670', '81333330'),
      avoided: mr('15768000000', '17520000000'),
      recurring: mr('5000000', '6000000'),
    },
    funding: {
      totalCost: mr('11000000', '13200000'),
      approved: m('4000000'),
      candidate: m('9000000'),
      fullyFunded: false,
      gap: mr('7000000', '9200000'),
      lines: [
        {
          label: 'District grant',
          amount: m('4000000'),
          status: 'APPROVED',
          counts: true,
          applicable: true,
        },
        {
          label: 'Hoped CSR',
          amount: m('9000000'),
          status: 'PROPOSED',
          counts: false,
          applicable: true,
        },
      ],
      note: 'Approved funding does not yet cover the highest cost estimate; the gap is the cost still to find. Unapproved funding is not counted towards it.',
    },
    assumptions: ['No future inflation or price change is assumed; annual figures are flat.'],
    notes: [],
    ...over,
  };
}

function option(
  id: string,
  rank: number,
  name: string,
  ids: string[],
  flags: ImpactFindingFieldsFragment[] = [],
  economics: Economics | null = null,
): ComparedOptionFieldsFragment {
  return {
    impact: impact(id, ids, flags),
    economics,
    id,
    rank,
    name,
    interventionIds: ids,
    why: `Ranked ${rank} by: fewest measures.`,
    tradeoffs: ['Fixtures need replacing as they wear.'],
    uncertainty: ['Estimates are yours, not sourced figures.'],
    firstBenefit: 'AFTER_COMMISSIONING',
    pessimistic: n('3/73', '0.0410958904109589041095890411'),
    optimistic: n('0', '0'),
    margin: n('159/1460', '0.1089041095890410958904109589'),
    waterLow: n('324000'),
    waterHigh: n('405000'),
    uncountedHigh: n('45000'),
    cost: {
      low: { minorUnits: '500000', currency: 'INR', exponent: 2 },
      high: { minorUnits: '900000', currency: 'INR', exponent: 2 },
    },
    buildDays: { low: 10, high: 30 },
    measures: ids.map((m) => ({
      interventionId: m,
      name: m.replace(/_/g, ' '),
      benefitTiming: 'AFTER_COMMISSIONING' as const,
      waterLow: n('324000'),
      waterHigh: n('405000'),
      cost: null,
      recurring: null,
      buildDays: null,
      effects: [
        {
          key: 'demand_reduction',
          label: 'Share of water use the fixtures save',
          unit: 'RATIO' as const,
          origin: 'USER_ESTIMATE' as const,
          low: n('1/5', '0.2'),
          high: n('1/4', '0.25'),
        },
      ],
    })),
    sensitivity: [
      {
        interventionId: ids[0]!,
        key: 'demand_reduction',
        label: 'Share saved',
        swing: n('3/73', '0.041'),
      },
    ],
    stress: [
      {
        key: 'demand_up_10',
        label: 'Demand 10% higher',
        meetsTarget: true,
        value: n('9/89', '0.1011'),
      },
      { key: 'rainfall_down_20', label: '20% less rainfall', meetsTarget: null, value: null },
    ],
  };
}

const NO_SCENARIO: ScenarioComparisonFieldsFragment = {
  status: 'none',
  notes: [],
  baselineId: 'bsl_1',
  engineVersion: 'scenario-1',
  rows: [
    {
      key: 'demand',
      label: 'Water demand',
      unit: 'LITRES_PER_DAY',
      reason: null,
      baseline: n('1620000'),
      scenario: n('1620000'),
      change: n('0'),
    },
    {
      key: 'rainfall',
      label: 'Rainfall in a year',
      unit: 'MILLIMETRE',
      reason: 'Needs at least a year of rainfall records for this location.',
      baseline: null,
      scenario: null,
      change: null,
    },
  ],
};

function comparison(over: Partial<Comparison> = {}): Comparison {
  return {
    id: 'cmp_1',
    engineVersion: 'options-1',
    scenarioEngineVersion: 'scenario-1',
    catalogueVersion: 'interventions-3',
    baselineId: 'bsl_1',
    status: 'OPTIONS',
    summary:
      '2 plans meet the target and every constraint even at the low end of your estimates. No other combination passes, so no more are shown.',
    metric: 'TANKER_DEPENDENCE',
    unit: 'RATIO',
    needs: [],
    excluded: ['Additional storage: its water effect is not modelled, so it cannot count.'],
    assumptions: ['Measures in one option are assumed to be built at the same time.'],
    ranking: 'Fewest measures, then the largest margin past the target.',
    maxOptions: 3,
    stressTests: ['Demand 10% higher', '20% less rainfall'],
    baselineValue: n('3/10', '0.3'),
    scenarioValue: n('3/10', '0.3'),
    targetLevel: n('3/20', '0.15'),
    rejections: {
      evaluated: 7,
      onlyOptimistic: 0,
      missedTarget: 4,
      overBudget: 0,
      budgetUncertain: 0,
      tooSlow: 0,
      timeUncertain: 0,
      notMinimal: 1,
      truncated: false,
    },
    options: [
      option('opt_a', 1, 'Water-efficient fixtures', ['efficient_fixtures']),
      option('opt_b', 2, 'Greywater reuse + Leak detection and repair', [
        'greywater_reuse',
        'leak_detection_and_repair',
      ]),
    ],
    impactEngineVersion: 'impact-1',
    impactContext: CONTEXT,
    ...over,
  };
}

type Handler = (variables: Record<string, unknown>) => unknown;
let handlers: Record<string, Handler> = {};
let sent: Array<{ op: string; variables: Record<string, unknown> }> = [];
const originalAdapter = apiClient.defaults.adapter;

const stub: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
  const body = JSON.parse(config.data as string) as {
    query: string;
    variables: Record<string, unknown>;
  };
  const op = /(?:query|mutation)\s+(\w+)/.exec(body.query)?.[1] ?? '';
  sent.push({ op, variables: body.variables });
  const handler = handlers[op];
  if (!handler) throw new Error(`unexpected operation ${op}`);
  const data: unknown = await handler(body.variables);
  return { data, status: 200, statusText: 'OK', headers: {}, config };
};

function reply(
  c: Comparison,
  scenario = NO_SCENARIO,
  selectedPlanStatus: 'NONE' | 'CURRENT' | 'IMPACT_CHANGED' | 'NOT_CURRENT' | 'LEGACY' = 'NONE',
) {
  return {
    data: {
      planningSession: {
        id: 'ses_1',
        inputsRevision: 1,
        selectedPlanOptionId: selectedPlanStatus === 'NONE' ? null : 'opt_a',
        selectedPlanStatus,
        planComparison: c,
        scenarioComparison: scenario,
      },
    },
  };
}

beforeEach(() => {
  sent = [];
  handlers = {
    PlanComparison: () => reply(comparison()),
    AreaLocation: () => ({
      data: {
        area: {
          id: 'are_1',
          name: 'Synthville',
          centroidLat: '12.9352',
          centroidLon: '77.6245',
          countryCode: 'IN',
          timezone: 'Asia/Kolkata',
          currency: 'INR',
          unitSystem: 'METRIC',
          regionSetByUser: [],
          evidence: 'SYNTHETIC',
          origin: 'PLACE_SEARCH',
          scope: 'LOCALITY',
          extent: 'USER_RADIUS',
          radiusMeters: 1000,
          private: false,
          formattedAddress: 'Synthville',
          accuracyMeters: null,
          hasBoundary: true,
          providerContentExpired: false,
          placeId: 'fixture:synthville',
          admin: {
            countryName: 'India',
            admin1: null,
            admin2: null,
            locality: null,
            sublocality: null,
          },
        },
      },
    }),
  };
  apiClient.defaults.adapter = stub;
});

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
});

function renderWith(
  ui: ReactNode,
  session: Partial<SessionState> = { goal: GOAL, inputsRevision: 1 },
) {
  const sessions = new FakeSessionServer();
  sessions.seed('user-1', { id: 'ses_1', areaId: 'are_1', ...session });
  render(
    <AuthTestProviders backend={new FakeAuthBackend(permanent())} sessions={sessions}>
      <MemoryRouter>{ui}</MemoryRouter>
    </AuthTestProviders>,
  );
  return sessions;
}

const renderPlans = (session?: Partial<SessionState>) => renderWith(<PlansPage />, session);
const renderAgent = (session?: Partial<SessionState>) => renderWith(<AgentScenario />, session);

const APPLIED: ScenarioComparisonFieldsFragment = {
  ...NO_SCENARIO,
  status: 'applied',
  rows: [
    {
      key: 'demand',
      label: 'Water demand',
      unit: 'LITRES_PER_DAY',
      reason: null,
      baseline: n('1620000'),
      scenario: n('1782000'),
      change: n('162000'),
    },
  ],
};

function scenarioReply(scenario: ScenarioComparisonFieldsFragment) {
  return {
    data: { planningSession: { id: 'ses_1', inputsRevision: 1, scenarioComparison: scenario } },
  };
}

describe('Scenario planning step', () => {
  it('renders modern scenario testing screen and records scenario choice', async () => {
    handlers.SessionScenario = () => scenarioReply(APPLIED);
    const sessions = renderWith(<ScenarioPage />, {
      baselineReviewed: true,
      goal: null,
      scenario: {
        adjustments: [
          { parameter: 'demand', change: 'INCREASE_BY', quantity: { value: '0.1', unit: 'RATIO' } },
        ],
        confirmed: true,
      },
    });
    expect(await screen.findByRole('heading', { name: /Test a Future Scenario/ })).toBeVisible();
    expect(await screen.findByRole('button', { name: 'Analyse Scenario' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Analyse Scenario' }));
    await waitFor(() =>
      expect(sessions.applied.some((entry) => entry.patch.scenario?.confirmed)).toBe(true),
    );
  });
  it('offers scenario testing before a goal is set and records an explicit scenario choice', async () => {
    handlers.SessionScenario = () => scenarioReply(NO_SCENARIO);
    handlers.PreviewScenario = () => ({
      data: { previewScenario: { errors: [], comparison: NO_SCENARIO } },
    });
    const sessions = renderWith(<ScenarioPage />, { baselineReviewed: true, goal: null });
    expect(await screen.findByRole('heading', { name: /Test a Future Scenario/ })).toBeVisible();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Analyse Scenario' })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Analyse Scenario' }));
    await waitFor(() =>
      expect(sessions.applied.some((entry) => entry.patch.scenario?.confirmed)).toBe(true),
    );
    expect(
      sessions.applied.find((entry) => entry.patch.scenario)?.patch.scenario?.adjustments,
    ).toBeDefined();
  });
});

describe('plansFormat', () => {
  it('formats exact values once, for display', () => {
    expect(formatMetric(n('3/73', '0.0410958904109589041095890411'), 'RATIO')).toBe('4.1%');
    expect(formatMetric(n('182'), 'DAY')).toBe('182 days');
    expect(formatMetric(null, 'RATIO')).toBe('Not known');
    expect(formatChange(n('-3/25', '-0.12'), 'RATIO')).toBe('−12 percentage points');
    expect(formatChange(n('162000'), 'LITRES_PER_DAY')).toBe('+1,62,000 L/day');
    expect(
      formatMoneyRange({
        low: { minorUnits: '500000', currency: 'INR', exponent: 2 },
        high: { minorUnits: '500000', currency: 'INR', exponent: 2 },
      }),
    ).toBe('₹5,000');
  });

  it('keeps a water quality reading with its parameter, method and date', () => {
    const reading = {
      parameter: 'nitrate',
      value: n('52'),
      unit: 'MG_PER_LITRE' as const,
      observedOn: '2026-08-14',
      method: 'in_situ_measurement',
    };
    expect(formatReading(reading)).toBe('nitrate: 52 mg/L (in situ measurement, 2026-08-14)');
    expect(formatReading({ ...reading, parameter: null, method: null, observedOn: null })).toBe(
      'Parameter not recorded: 52 mg/L (method not recorded, date not recorded)',
    );
  });

  it('builds canonical adjustments and refuses unusable rows', () => {
    const draft = {
      ...emptyWhatIf(),
      rainfall: { change: 'DECREASE_BY' as const, value: '20' },
      demand: { change: 'SET_TO' as const, value: '1500000.0' },
    };
    const { adjustments } = toAdjustments(draft);
    expect(adjustments).toEqual([
      {
        parameter: 'demand',
        change: 'SET_TO',
        quantity: { value: '1500000', unit: 'LITRES_PER_DAY' },
      },
      { parameter: 'rainfall', change: 'DECREASE_BY', quantity: { value: '0.2', unit: 'RATIO' } },
    ]);
    expect(fromAdjustments(adjustments!)).toEqual({
      ...draft,
      demand: { change: 'SET_TO', value: '1500000' },
    });
    expect(
      toAdjustments({ ...draft, rainfall: { change: 'DECREASE_BY', value: '150' } }).errors,
    ).toEqual({ rainfall: 'Enter a percentage above 0 and at most 100.' });
    expect(
      toAdjustments({ ...draft, demand: { change: 'SET_TO', value: '1,500' } }).errors.demand,
    ).toMatch(/without commas/);
    expect(rowOf('scenario.adjustments.1.quantity.value', adjustments!)).toBe('rainfall');
  });
});

describe('PlansPage', () => {
  it('asks for a goal before comparing', async () => {
    renderPlans({ goal: null });
    expect(await screen.findByText(/set a goal first/i)).toBeInTheDocument();
    expect(sent.some((s) => s.op === 'PlanComparison')).toBe(false);
  });

  it('shows only the feasible plans, with exact figures rounded for display', async () => {
    renderPlans();
    expect(await screen.findByRole('heading', { name: 'Compare plans' })).toBeVisible();
    expect(await screen.findByRole('heading', { name: 'Synthville' })).toBeVisible();
    expect(screen.getByText('1 km planning radius')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Change area' })).toBeVisible();
    const list = await screen.findByRole('list', { name: 'Feasible plans' });
    const cards = within(list)
      .getAllByRole('listitem')
      .filter((li) => li.dataset.optionId);
    expect(cards).toHaveLength(2);
    expect(screen.getByText('Feasible plans found')).toBeInTheDocument();
    expect(screen.getByText(/no other combination passes/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Assumptions, ranking and versions' }),
    ).toBeInTheDocument();
    expect(within(cards[0]!).getByText('0.0% to 4.1%')).toBeInTheDocument();
    expect(within(cards[0]!).getByText('₹5,000 to ₹9,000')).toBeInTheDocument();
    expect(within(cards[0]!).getByText('10 to 30 days')).toBeInTheDocument();
    expect(screen.getByText('30.0%')).toBeInTheDocument();
    expect(screen.getByText('15.0%')).toBeInTheDocument();
    fireEvent.click(within(cards[0]!).getByText('Measures, impact & assumptions'));
    const basis = screen.getByRole('list', {
      name: 'What efficient fixtures is computed from',
    });
    expect(within(basis).getByText(/20\.0% to 25\.0% \(your estimate\)/)).toHaveAttribute(
      'data-effect-origin',
      'USER_ESTIMATE',
    );
  });

  it('keeps supporting detail collapsed and selection unavailable until a current plan is chosen', async () => {
    renderPlans();
    await screen.findByRole('list', { name: 'Feasible plans' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Effects beyond your site' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Projected outcomes' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Neighbourhood impact' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select a plan to continue' })).toBeDisabled();
    expect(
      screen.queryByRole('link', { name: /proceed with selected plan/i }),
    ).not.toBeInTheDocument();
  });

  it('opens selected plan details without finalizing and returns its selection to Compare', async () => {
    const sessions = renderPlans();
    sessions.options.set('opt_a', 1);
    const list = await screen.findByRole('list', { name: 'Feasible plans' });
    const details = within(list).getAllByRole('button', { name: 'View plan details' });
    fireEvent.click(details[0]!);
    const drawer = await screen.findByRole('dialog', { name: 'Plan 1 details' });
    expect(within(drawer).getByRole('heading', { name: 'Water-efficient fixtures' })).toBeVisible();
    expect(within(drawer).getByText(/no monthly chart is available/i)).toBeVisible();
    expect(within(drawer).getByText('Ranked first')).toBeVisible();
    expect(
      within(drawer).getByText('Measures in one option are assumed to be built at the same time.'),
    ).toBeVisible();
    expect(within(drawer).getByText(/Current ordering: Fewest measures/)).toBeVisible();
    expect(
      within(drawer).getByText(
        'Additional storage: its water effect is not modelled, so it cannot count.',
      ),
    ).toBeVisible();
    expect(within(drawer).getByRole('button', { name: 'Select this plan' })).toBeEnabled();
    fireEvent.click(within(drawer).getByRole('button', { name: 'Select this plan' }));
    await waitFor(() =>
      expect(sessions.applied.at(-1)?.patch).toEqual({ selectedPlanOptionId: 'opt_a' }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save report|finalize/i })).not.toBeInTheDocument();
  });

  it('shows wider effects with every plan before one is chosen, unknown left unknown', async () => {
    renderPlans();
    const list = await screen.findByRole('list', { name: 'Feasible plans' });
    const cards = within(list)
      .getAllByRole('listitem')
      .filter((li) => li.dataset.optionId);
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i]!;
      fireEvent.click(within(card).getByText('Measures, impact & assumptions'));
      const effects = screen.getByRole('region', { name: 'Effects beyond your site' });
      expect(within(effects).getByText('30.0% now; 4.1% to 0.0% with this plan.')).toBeVisible();
      const ext = effects.querySelector('[data-finding^="ext."]')!;
      expect(ext).toHaveAttribute('data-linkage', 'UNKNOWN');
      expect(within(ext as HTMLElement).getByText('Connection unknown')).toBeInTheDocument();
      if (i === 0) {
        expect(screen.queryByText('Professional review')).not.toBeInTheDocument();
      } else {
        expect(screen.getByText(/Water quality review: required before building/)).toBeInTheDocument();
      }
      fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[0]!);
      expect(within(card).getByRole('button', { name: 'Choose this plan' })).toBeEnabled();
    }
    expect(screen.queryByText('Possible false resilience')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Neighbourhood impact' })).not.toBeInTheDocument();
  });

  it('warns about possible false resilience with its uncertainty and source', async () => {
    handlers.PlanComparison = () =>
      reply(
        comparison({
          options: [
            option(
              'opt_a',
              1,
              'Water-efficient fixtures',
              ['efficient_fixtures'],
              [FALSE_RESILIENCE],
            ),
          ],
          impactContext: { ...CONTEXT, groundwater: 'DECLARED' },
        }),
      );
    renderPlans();
    const list = await screen.findByRole('list', { name: 'Feasible plans' });
    const notice = within(list).getByText('Possible false resilience').closest('[data-notice]')!;
    expect(notice).toHaveAttribute('data-notice', 'caution');
    expect(notice).toHaveTextContent(/lowers the water table for others/);
    expect(notice).toHaveTextContent(/is not known: no reviewed record on file/);
    expect(notice).toHaveTextContent('Based on: You said the site uses groundwater');
  });

  it('has no what-if controls in Traditional mode', async () => {
    renderPlans();
    await screen.findByRole('list', { name: 'Feasible plans' });
    expect(screen.queryByRole('button', { name: 'Preview' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Apply scenario' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Water demand' })).not.toBeInTheDocument();
    expect(screen.queryByText('What-if from Agent mode')).not.toBeInTheDocument();
  });

  it('saves the chosen plan through the session', async () => {
    const sessions = renderPlans();
    sessions.options.set('opt_b', 1);
    const list = await screen.findByRole('list', { name: 'Feasible plans' });
    const buttons = within(list).getAllByRole('button', { name: 'Choose this plan' });
    fireEvent.click(buttons[1]!);
    await waitFor(() =>
      expect(sessions.applied.at(-1)?.patch).toEqual({ selectedPlanOptionId: 'opt_b' }),
    );
    expect(await screen.findByRole('button', { name: 'Chosen plan' })).toBeDisabled();
  });

  it('lets the user continue once a plan is chosen and still current', async () => {
    handlers.PlanComparison = () => reply(comparison(), NO_SCENARIO, 'CURRENT');
    renderPlans({ goal: GOAL, inputsRevision: 1, selectedPlanOptionId: 'opt_a' });
    expect(await screen.findByRole('link', { name: /proceed with selected plan/i })).toHaveAttribute(
      'href',
      '/make-it-happen',
    );
    expect(screen.queryByRole('button', { name: /choose again/i })).not.toBeInTheDocument();
  });

  it('blocks continuing and asks to re-choose when the chosen plan was reassessed', async () => {
    handlers.PlanComparison = () => reply(comparison(), NO_SCENARIO, 'IMPACT_CHANGED');
    const sessions = renderPlans({ goal: GOAL, inputsRevision: 1, selectedPlanOptionId: 'opt_a' });
    sessions.options.set('opt_a', 1); // the plan is still a current option, just reassessed
    const notice = (await screen.findByText(/needs a fresh look before you continue/i)).closest(
      '[data-notice]',
    )!;
    expect(notice).toHaveAttribute('data-notice', 'caution');
    expect(notice).toHaveTextContent(/changed its wider-system impact/i);
    // Cannot continue with a stale selection.
    expect(
      screen.queryByRole('link', { name: /proceed with selected plan/i }),
    ).not.toBeInTheDocument();
    // Re-choosing stores the current assessment through the session.
    fireEvent.click(within(notice as HTMLElement).getByRole('button', { name: /choose again/i }));
    await waitFor(() =>
      expect(sessions.applied.at(-1)?.patch).toEqual({ selectedPlanOptionId: 'opt_a' }),
    );
  });

  it('does not continue with a legacy selection that the current comparison cannot validate', async () => {
    handlers.PlanComparison = () => reply(comparison(), NO_SCENARIO, 'LEGACY');
    renderPlans({ goal: GOAL, inputsRevision: 1, selectedPlanOptionId: 'old_option' });
    await screen.findByRole('list', { name: 'Feasible plans' });
    expect(screen.queryByRole('link', { name: /continue to funding/i })).not.toBeInTheDocument();
    expect(screen.getByText(/no longer one of the current options/i)).toBeInTheDocument();
  });

  it('blocks continuing and asks to pick again when the chosen plan is no longer an option', async () => {
    handlers.PlanComparison = () => reply(comparison(), NO_SCENARIO, 'NOT_CURRENT');
    renderPlans({ goal: GOAL, inputsRevision: 1, selectedPlanOptionId: 'opt_a' });
    const notice = (await screen.findByText(/no longer one of the current options/i)).closest(
      '[data-notice]',
    )!;
    expect(notice).toHaveAttribute('data-notice', 'caution');
    expect(screen.queryByRole('link', { name: /continue to funding/i })).not.toBeInTheDocument();
    // There is no stored option to re-choose; the person must pick from the list.
    expect(screen.queryByRole('button', { name: /choose again/i })).not.toBeInTheDocument();
  });

  it('shows costs, payback and a funding gap kept separate from cost', async () => {
    handlers.PlanComparison = () =>
      reply(
        comparison({
          options: [
            option('opt_a', 1, 'Water-efficient fixtures', ['efficient_fixtures'], [], econ()),
          ],
        }),
      );
    renderPlans();
    const list = await screen.findByRole('list', { name: 'Feasible plans' });
    const card = within(list)
      .getAllByRole('listitem')
      .filter((li) => li.dataset.optionId)[0]!;
    fireEvent.click(within(card).getByText('Measures, impact & assumptions'));
    const economics = screen.getByTestId('economics');
    // Upfront cost includes the person's contingency; nothing invented.
    expect(within(economics).getByTestId('econ-upfront')).toHaveTextContent(
      '₹1,10,000 to ₹1,32,000',
    );
    expect(within(economics).getByText(/includes 10% contingency you set/)).toBeInTheDocument();
    // Payback is explicit; the funding gap is separate and not covered by unapproved money.
    expect(within(economics).getByText('Pays back within the horizon')).toBeInTheDocument();
    const gap = within(economics).getByTestId('econ-gap');
    expect(gap).toHaveTextContent('₹70,000 to ₹92,000');
    expect(within(gap).getByText('Not fully funded')).toBeInTheDocument();
    const sources = within(economics).getByRole('list', { name: 'Declared funding sources' });
    const lines = within(sources).getAllByRole('listitem');
    expect(lines[0]).toHaveAttribute('data-funding-counts', 'true');
    expect(lines[1]).toHaveAttribute('data-funding-counts', 'false');
    expect(lines[1]).toHaveTextContent(/Proposed/);
  });

  it('reports a tariff in another currency without converting it', async () => {
    handlers.PlanComparison = () =>
      reply(
        comparison({
          options: [
            option(
              'opt_a',
              1,
              'Water-efficient fixtures',
              ['efficient_fixtures'],
              [],
              econ({
                avoidedTankerAnnual: null,
                avoidedReason:
                  'The tariff is in USD but the plan’s costs are in INR; it is not applied and never converted.',
                netAnnual: null,
                payback: null,
              }),
            ),
          ],
        }),
      );
    renderPlans();
    const list = await screen.findByRole('list', { name: 'Feasible plans' });
    fireEvent.click(within(list).getByText('Measures, impact & assumptions'));
    const economics = screen.getByTestId('economics');
    expect(within(economics).getByText(/never converted/)).toBeInTheDocument();
    // Costs are still shown even when the tariff cannot be applied.
    expect(within(economics).getByTestId('econ-upfront')).toHaveTextContent('₹1,10,000');
  });

  it('explains why no plan is shown instead of inventing one', async () => {
    handlers.PlanComparison = () =>
      reply(
        comparison({
          status: 'NO_FEASIBLE_PLAN',
          summary:
            'No plan meets the target and every constraint. Of 3 combinations checked, 2 would meet the target only with optimistic estimates.',
          options: [],
          rejections: {
            ...comparison().rejections,
            evaluated: 3,
            onlyOptimistic: 2,
            missedTarget: 1,
          },
        }),
      );
    renderPlans();
    expect(await screen.findByText('No feasible plan')).toBeInTheDocument();
    expect(
      screen.getByText('2 would meet the target only with optimistic estimates.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Feasible plans' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Choose this plan' })).not.toBeInTheDocument();
  });

  it('lists the input that would let plans be compared', async () => {
    handlers.PlanComparison = () =>
      reply(
        comparison({
          status: 'NEEDS_INPUT',
          summary: 'No measure can be compared yet.',
          options: [],
          needs: ['Water-efficient fixtures: estimate share of water use the fixtures save.'],
        }),
      );
    renderPlans();
    expect(await screen.findByText('More input needed')).toBeInTheDocument();
    expect(screen.getByText(/estimate share of water use the fixtures save/)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /update your goal, site and estimates/i }),
    ).toHaveAttribute('href', '/goals');
  });
});

describe('AgentScenario (agent what-if tool)', () => {
  beforeEach(() => {
    handlers.SessionScenario = () => scenarioReply(NO_SCENARIO);
  });

  it('previews a what-if without saving, then applies it to plans', async () => {
    handlers.PreviewScenario = () => ({
      data: {
        previewScenario: {
          errors: [],
          comparison: {
            ...NO_SCENARIO,
            status: 'applied',
            rows: [
              {
                key: 'demand',
                label: 'Water demand',
                unit: 'LITRES_PER_DAY',
                reason: null,
                baseline: n('1620000'),
                scenario: n('1782000'),
                change: n('162000'),
              },
            ],
          },
        },
      },
    });
    const sessions = renderAgent({ goal: GOAL, inputsRevision: 1, selectedPlanOptionId: 'opt_b' });
    const stored = () => sessions.sessions.get('ses_1')!;
    const demand = await screen.findByRole('group', { name: 'Water demand' });
    fireEvent.change(within(demand).getByLabelText('Change'), {
      target: { value: 'INCREASE_BY' },
    });
    fireEvent.change(within(demand).getByLabelText('Percentage'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    expect(await screen.findByText('+1,62,000 L/day')).toBeInTheDocument();
    expect(sent.find((s) => s.op === 'PreviewScenario')?.variables).toEqual({
      sessionId: 'ses_1',
      scenario: {
        adjustments: [
          { parameter: 'demand', change: 'INCREASE_BY', quantity: { value: '0.1', unit: 'RATIO' } },
        ],
      },
    });
    expect(sessions.applied).toHaveLength(0);
    expect(stored()).toMatchObject({
      version: 1,
      inputsRevision: 1,
      scenario: null,
      selectedPlanOptionId: 'opt_b',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply scenario' }));
    await waitFor(() =>
      expect(sessions.applied.at(-1)?.patch).toEqual({
        scenario: {
          adjustments: [
            {
              parameter: 'demand',
              change: 'INCREASE_BY',
              quantity: { value: '0.1', unit: 'RATIO' },
            },
          ],
          interpretedFrom: null,
          confirmed: true,
        },
      }),
    );
    expect(stored()).toMatchObject({ inputsRevision: 2, selectedPlanOptionId: null });
  });

  it('refuses an unusable what-if before sending it', async () => {
    renderAgent();
    const rain = await screen.findByRole('group', { name: 'Rainfall in a year' });
    fireEvent.change(within(rain).getByLabelText('Change'), { target: { value: 'DECREASE_BY' } });
    fireEvent.change(within(rain).getByLabelText('Percentage'), { target: { value: '120' } });
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    expect(await screen.findByText(/at most 100/)).toBeInTheDocument();
    expect(sent.some((s) => s.op === 'PreviewScenario')).toBe(false);
  });

  it('applies an agent-parsed what-if only after confirmation', async () => {
    const scenario = {
      adjustments: [
        {
          parameter: 'rainfall',
          change: 'DECREASE_BY' as const,
          quantity: { value: '0.2', unit: 'RATIO' as const },
        },
      ],
      interpretedFrom: 'What if rainfall falls by 20%?',
      confirmed: false,
    };
    handlers.SessionScenario = () =>
      scenarioReply({ ...NO_SCENARIO, status: 'awaiting_confirmation' });
    const sessions = renderAgent({ goal: GOAL, inputsRevision: 1, scenario });
    expect(await screen.findByText('Waiting for your confirmation')).toBeInTheDocument();
    expect(screen.getByText('“What if rainfall falls by 20%?”')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm what-if' }));
    await waitFor(() =>
      expect(sessions.applied.at(-1)?.patch).toEqual({
        scenario: { ...scenario, confirmed: true },
      }),
    );
  });
});

it('renders the scenario testing screen matching expected UX', async () => {
  handlers.PreviewScenario = () => ({
    data: { previewScenario: { errors: [], comparison: NO_SCENARIO } },
  });
  renderWith(
    <ModernScenarioPanel
      sessionId="ses_1"
      revision={1}
      scenario={null}
      saved={NO_SCENARIO}
      pending={false}
      onSave={() => undefined}
    />,
  );
  expect(await screen.findByText('1.9 MLD')).toBeInTheDocument();
  expect(screen.getByText('Supply Reliability')).toBeInTheDocument();
  expect(screen.getByText('Tanker Dependency')).toBeInTheDocument();
  expect(screen.getByText('Water Stress')).toBeInTheDocument();
});
