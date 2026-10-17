import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import { MemoryRouter } from 'react-router-dom';

import type {
  CheckGoalQuery,
  GoalAssessmentFieldsFragment,
  GoalInput,
} from '../../graphql/generated/graphql';
import { apiClient } from '../../lib/apiClient';
import type { SessionState } from '../../session/sessionState';
import { AuthTestProviders } from '../../test/AuthTestProviders';
import { FakeAuthBackend, permanent } from '../../test/fakeAuth';
import { FakeSessionServer } from '../../test/fakeSession';
import { AgentPanel } from '../planning/AgentPanel';
import { draftField, emptyDraft, fromGoalInput, PRESETS, toGoalInput } from './goalDraft';
import GoalsPage from './index';

const AREA = 'are_0000000000000000000000AREA';

type Assessment = GoalAssessmentFieldsFragment;
type Fit = Assessment['interventions'][number];

function fit(id: string, name: string, site: Fit['site']['outcome'], over: Partial<Fit> = {}): Fit {
  return {
    interventionId: id,
    name,
    family: 'RAINWATER_HARVESTING',
    relevant: true,
    outcome: site === 'FEASIBLE' ? 'NOT_ASSESSABLE' : site,
    benefit: 'Benefit only after rain falls on a working system.',
    preferred: false,
    site: {
      outcome: site,
      message:
        site === 'FEASIBLE'
          ? 'Your site has what this measure needs.'
          : site === 'INFEASIBLE'
            ? 'Needs open or unpaved ground, which your site does not have.'
            : 'Tell us your roof area.',
    },
    cost: { outcome: 'NOT_ASSESSABLE', message: 'No sourced cost for this location.' },
    time: { outcome: 'NOT_ASSESSABLE', message: 'No sourced build time for this location.' },
    ...over,
  };
}

function assessment(over: Partial<Assessment> = {}): Assessment {
  return {
    outcome: 'NOT_ASSESSABLE',
    summary: 'This goal cannot be assessed yet.',
    nextSteps: ['Record tanker deliveries so the target can be compared with a baseline.'],
    catalogueVersion: 'interventions-3',
    baselineId: null,
    target: {
      outcome: 'NOT_ASSESSABLE',
      message: 'There is no baseline for tanker dependence yet, so the target cannot be checked.',
      metric: 'tanker_share',
      unit: 'RATIO',
      baseline: null,
      targetLevel: null,
      caveats: [],
    },
    constraints: [],
    conflicts: [],
    interventions: [
      fit('rooftop_rainwater_harvesting', 'Rooftop rainwater harvesting', 'FEASIBLE'),
      fit('recharge_well', 'Recharge well', 'INFEASIBLE'),
    ],
    ...over,
  };
}

function checkReply(
  a: Assessment | null,
  errors: CheckGoalQuery['checkGoal']['errors'] = [],
): { data: CheckGoalQuery } {
  return { data: { checkGoal: { errors, assessment: a } } };
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

beforeEach(() => {
  sent = [];
  handlers = {
    GoalArea: () => ({ data: { area: { id: AREA, name: 'Test ward', currency: 'INR' } } }),
    InterventionCatalogue: () => ({
      data: { interventionCatalogue: { version: 'interventions-3', interventions: [] } },
    }),
    CheckGoal: () => checkReply(assessment()),
    GoalAssessment: () => ({
      data: {
        planningSession: { id: 'ses_1', inputsRevision: 1, goalAssessment: assessment() },
      },
    }),
    AiStatus: () => ({
      data: {
        aiStatus: {
          available: false,
          reason: 'DISABLED',
          modelId: 'gemini-2.5-flash',
          requestsRemaining: 100,
          dailyRequestLimit: 100,
          budgetConfigured: false,
          suggestedDailyBudgetUsd: '5',
        },
      },
    }),
  };
  apiClient.defaults.adapter = stub;
});

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
});

function renderGoals(session: Partial<SessionState> = { areaId: AREA }) {
  const sessions = new FakeSessionServer();
  sessions.seed('user-1', { id: 'ses_1', ...session });
  render(
    <AuthTestProviders backend={new FakeAuthBackend(permanent())} sessions={sessions}>
      <MemoryRouter>
        <GoalsPage />
      </MemoryRouter>
    </AuthTestProviders>,
  );
  return sessions;
}

const checks = () => sent.filter((s) => s.op === 'CheckGoal');
const lastGoal = () => checks().at(-1)?.variables.goal as GoalInput;

async function choose(preset: RegExp) {
  fireEvent.click(await screen.findByRole('radio', { name: preset }));
}

describe('goal draft', () => {
  const tanker = () => PRESETS.find((p) => p.id === 'tanker')?.apply(emptyDraft('INR'));

  it('stores percentages as exact ratios and budgets as integer minor units', () => {
    const draft = { ...tanker()!, budgetAmount: '1000000.5', targetValue: '12.5' };
    const { input, errors } = toGoalInput(draft);
    expect(errors).toEqual({});
    expect(input?.target).toEqual({
      mode: 'RELATIVE_REDUCTION',
      quantity: { value: '0.125', unit: 'RATIO' },
    });
    expect(input?.budget).toEqual({ minorUnits: '100000050', currency: 'INR' });
  });

  it('uses each currency’s own minor unit and never converts between currencies', () => {
    const yen = toGoalInput({ ...tanker()!, currency: 'JPY', budgetAmount: '500000' });
    expect(yen.input?.budget).toEqual({ minorUnits: '500000', currency: 'JPY' });
    const tooFine = toGoalInput({ ...tanker()!, currency: 'JPY', budgetAmount: '1.5' });
    expect(tooFine.errors.budgetAmount).toMatch(/JPY has 0 decimal places/);
  });

  it('refuses display formatting instead of guessing what it meant', () => {
    for (const budgetAmount of ['10,00,000', '₹1000', '1e6', '1 000']) {
      const { input, errors } = toGoalInput({ ...tanker()!, budgetAmount });
      expect(input).toBeNull();
      expect(errors.budgetAmount).toMatch(/without commas or symbols/);
    }
    expect(toGoalInput({ ...tanker()!, targetValue: '30%' }).errors.targetValue).toMatch(/% sign/);
    expect(toGoalInput({ ...tanker()!, targetValue: '120' }).errors.targetValue).toMatch(/100/);
  });

  it('round-trips a saved goal without drifting', () => {
    const draft = {
      ...tanker()!,
      budgetAmount: '250000',
      horizonDays: '1825',
      roofArea: '120.5',
      storageSpace: 'yes' as const,
      groundwaterUse: 'yes' as const,
      restrictions: ['NO_EXCAVATION' as const],
      estimates: [
        {
          interventionId: 'storage_tank',
          costLow: '40000',
          costHigh: '',
          buildLow: '7',
          buildHigh: '14',
          effects: [],
          note: 'Local quote',
        },
      ],
    };
    const first = toGoalInput(draft).input!;
    expect(first.site).toMatchObject({ groundwaterUse: true, pipedSupply: null });
    expect(first.estimates?.[0]?.cost).toEqual({
      low: { minorUnits: '4000000', currency: 'INR' },
      high: { minorUnits: '4000000', currency: 'INR' },
    });
    const again = toGoalInput(fromGoalInput(first, 'USD')).input;
    expect(again).toEqual(first);
  });

  it('preserves exact tariff, maintenance, contingency and funding currencies through editing', () => {
    const draft = {
      ...tanker()!,
      tariffAmount: '900.25',
      tariffLitres: '10000',
      tariffCurrency: 'INR',
      tariffNote: 'Illustrative quote',
      contingencyPercent: '10',
      funding: [
        {
          label: 'Unverified grant',
          amount: '100.05',
          currency: 'USD',
          status: 'EXPECTED' as const,
          note: 'Not approved',
        },
      ],
      estimates: [
        {
          interventionId: 'storage_tank',
          costLow: '40000',
          costHigh: '',
          costCurrency: 'JPY',
          recurringLow: '12.34',
          recurringHigh: '18.56',
          recurringCurrency: 'USD',
          buildLow: '7',
          buildHigh: '14',
          effects: [],
          note: 'Estimate',
        },
      ],
    };
    const { input, errors } = toGoalInput(draft);
    expect(errors).toEqual({});
    expect(input?.waterTariff?.price).toEqual({ minorUnits: '90025', currency: 'INR' });
    expect(toGoalInput({ ...draft, tariffCurrency: '' }).input?.waterTariff?.price.currency).toBe(
      'INR',
    );
    expect(input?.estimates?.[0]?.recurring?.low).toEqual({ minorUnits: '1234', currency: 'USD' });
    expect(toGoalInput(fromGoalInput(input!, 'EUR')).input).toEqual(input);
  });

  it('asks for a cost or a build time on every estimate', () => {
    const draft = {
      ...tanker()!,
      estimates: [
        {
          interventionId: 'storage_tank',
          costLow: '',
          costHigh: '',
          buildLow: '',
          buildHigh: '',
          effects: [],
          note: '',
        },
      ],
    };
    expect(toGoalInput(draft).errors['estimates.0.costLow']).toMatch(/cost, a build time/);
  });

  it('turns effect percentages into canonical shares and back', () => {
    const draft = {
      ...tanker()!,
      estimates: [
        {
          interventionId: 'rooftop_rainwater_harvesting',
          costLow: '',
          costHigh: '',
          buildLow: '',
          buildHigh: '',
          effects: [
            { key: 'collection_efficiency', unit: 'RATIO' as const, low: '60', high: '80.0' },
            { key: 'annual_rainfall', unit: 'MILLIMETRE' as const, low: '700.0', high: '' },
          ],
          note: '',
        },
      ],
    };
    const input = toGoalInput(draft).input!;
    expect(input.estimates?.[0]?.effects).toEqual([
      { key: 'collection_efficiency', low: '0.6', high: '0.8' },
      { key: 'annual_rainfall', low: '700', high: '700' },
    ]);
    const units = {
      'rooftop_rainwater_harvesting.collection_efficiency': 'RATIO' as const,
      'rooftop_rainwater_harvesting.annual_rainfall': 'MILLIMETRE' as const,
    };
    expect(toGoalInput(fromGoalInput(input, 'INR', units)).input).toEqual(input);
    const reversed = {
      ...draft,
      estimates: [
        {
          ...draft.estimates[0]!,
          effects: [
            { key: 'collection_efficiency', unit: 'RATIO' as const, low: '80', high: '60' },
          ],
        },
      ],
    };
    expect(toGoalInput(reversed).errors['estimates.0.effects']).toMatch(/lower figure first/);
    expect(draftField('goal.estimates.0.effects.1')).toBe('estimates.0.effects');
  });

  it('maps server field paths onto the field that shows the message', () => {
    expect(draftField('goal.target.quantity.value')).toBe('targetValue');
    expect(draftField('goal.budget.minorUnits')).toBe('budgetAmount');
    expect(draftField('goal.site.roofArea.value')).toBe('roofArea');
    expect(draftField('goal.estimates.1.buildDays')).toBe('estimates.1.buildLow');
    expect(draftField('goal.preferredInterventions')).toBe('preferred');
    expect(draftField('goal')).toBe('kind');
  });
});

describe('GoalsPage', () => {
  it('starts from presets and reveals details only when asked', async () => {
    renderGoals();
    expect(screen.getByText('Step 3 of 5')).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'Set your goal and constraints' }),
    ).toBeVisible();
    expect(await screen.findByText('Planning for')).toBeVisible();
    for (const name of [/tanker/i, /shortage/i, /bills/i])
      expect(await screen.findByRole('radio', { name })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /groundwater/i })).not.toBeVisible();
    fireEvent.click(screen.getByText('More goals and constraints'));
    for (const name of [/groundwater/i, /flooding/i, /quality/i])
      expect(await screen.findByRole('radio', { name })).toBeInTheDocument();
    expect(screen.queryByLabelText(/target \(%\)/i)).not.toBeInTheDocument();

    await choose(/tanker/i);
    expect(screen.getByLabelText(/target \(%\)/i)).toHaveValue('30');
    expect(screen.getByLabelText(/budget \(INR\)/i)).toBeVisible();
    expect(screen.getByLabelText(/^timeframe/i)).toHaveValue('365');
    fireEvent.click(screen.getByText('Additional planning constraints'));
    expect(screen.getByLabelText(/^planning horizon/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^priority$/i)).toBeInTheDocument();
  });

  it('says plainly when a goal cannot be met as set, and why', async () => {
    handlers.CheckGoal = () =>
      checkReply(
        assessment({
          outcome: 'INFEASIBLE',
          summary: 'This goal cannot be met as set.',
          constraints: [
            {
              code: 'horizon_before_build',
              message: 'The planning horizon ends before any measure could be built.',
              outcome: 'INFEASIBLE',
            },
          ],
          conflicts: [
            {
              code: 'objective_excluded',
              message: 'Ruling out recharge leaves nothing that raises groundwater.',
              outcome: 'INFEASIBLE',
            },
          ],
        }),
      );
    renderGoals();
    await choose(/tanker/i);
    fireEvent.click(screen.getByRole('button', { name: /check goal/i }));

    const view = await screen.findByRole('region', { name: /goal check/i });
    expect(view).toHaveAttribute('data-goal-outcome', 'INFEASIBLE');
    expect(within(view).getAllByText('Cannot be met as set').length).toBeGreaterThan(0);
    expect(within(view).getByText(/horizon ends before/i)).toBeInTheDocument();
    expect(within(view).getByText(/leaves nothing that raises groundwater/i)).toBeInTheDocument();
    expect(screen.getByText(/checked, not saved yet/i)).toBeInTheDocument();
    expect(lastGoal().target).toEqual({
      mode: 'RELATIVE_REDUCTION',
      quantity: { value: '0.3', unit: 'RATIO' },
    });
    expect(checks().at(-1)?.variables.sessionId).toBe('ses_1');
  });

  it('separates not-yet-assessable from impossible and lists what would settle it', async () => {
    renderGoals();
    await choose(/tanker/i);
    fireEvent.click(screen.getByRole('button', { name: /check goal/i }));
    const view = await screen.findByRole('region', { name: /goal check/i });
    expect(view).toHaveAttribute('data-goal-outcome', 'NOT_ASSESSABLE');
    expect(within(view).getAllByText('Not yet assessable').length).toBeGreaterThan(0);
    expect(within(view).getByText(/record tanker deliveries/i)).toBeInTheDocument();
    expect(within(view).queryByText(/confidence/i)).not.toBeInTheDocument();
    expect(within(view).queryByText(/₹|\bINR\s*\d/)).not.toBeInTheDocument();
  });

  it('marks a check out of date as soon as the goal changes', async () => {
    renderGoals();
    await choose(/tanker/i);
    fireEvent.click(screen.getByRole('button', { name: /check goal/i }));
    await screen.findByRole('region', { name: /goal check/i });
    fireEvent.change(screen.getByLabelText(/target \(%\)/i), { target: { value: '40' } });
    expect(screen.getByText(/changed the goal after checking it/i)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /goal check/i })).not.toBeInTheDocument();
  });

  it('offers shortlisting only where the site meets a measure’s prerequisites', async () => {
    renderGoals();
    await choose(/tanker/i);
    fireEvent.click(screen.getByRole('button', { name: /check goal/i }));
    await screen.findByRole('region', { name: /goal check/i });
    const box = (id: string) =>
      within(document.querySelector(`[data-intervention="${id}"]`) as HTMLElement).getByRole(
        'checkbox',
        { name: /shortlist/i },
      );
    expect(box('recharge_well')).toBeDisabled();
    expect(box('rooftop_rainwater_harvesting')).toBeEnabled();
    fireEvent.click(box('rooftop_rainwater_harvesting'));
    fireEvent.click(screen.getByRole('button', { name: /check goal/i }));
    await waitFor(() =>
      expect(lastGoal().preferredInterventions).toEqual(['rooftop_rainwater_harvesting']),
    );
  });

  it('shows server field errors on the field, opening its section', async () => {
    handlers.CheckGoal = () =>
      checkReply(null, [
        {
          field: 'goal.site.openGround',
          message: 'Recharge wells need open or unpaved ground.',
        },
      ]);
    const sessions = renderGoals();
    await choose(/tanker/i);
    fireEvent.click(screen.getByRole('button', { name: /save goal/i }));
    const field = await screen.findByLabelText(/open or unpaved ground/i);
    expect(field).toBeVisible();
    expect(field).toHaveAccessibleDescription(/need open or unpaved ground/i);
    expect(sessions.applied).toHaveLength(0);
  });

  it('never sends a malformed value and says how to write it', async () => {
    renderGoals();
    await choose(/tanker/i);
    fireEvent.change(screen.getByLabelText(/budget \(INR\)/i), { target: { value: '10,00,000' } });
    fireEvent.click(screen.getByRole('button', { name: /save goal/i }));
    expect(await screen.findByRole('link', { name: /without commas/i })).toBeInTheDocument();
    expect(checks()).toHaveLength(0);
  });

  it('saves a checked goal through the session with canonical values', async () => {
    const sessions = renderGoals();
    await choose(/tanker/i);
    fireEvent.change(screen.getByLabelText(/budget \(INR\)/i), { target: { value: '1000000' } });
    fireEvent.click(screen.getByRole('button', { name: /save goal/i }));
    await waitFor(() => expect(sessions.applied).toHaveLength(1));
    const goal = sessions.applied[0]?.patch.goal as GoalInput;
    expect(goal.budget).toEqual({ minorUnits: '100000000', currency: 'INR' });
    expect(goal.target?.quantity).toEqual({ value: '0.3', unit: 'RATIO' });
    expect(checks()).toHaveLength(1);
    expect(await screen.findByRole('button', { name: /goal saved/i })).toBeDisabled();
    await waitFor(() =>
      expect(document.querySelector('[data-assessment-source="saved"]')).not.toBeNull(),
    );
    expect(screen.getByRole('link', { name: /compare plans/i })).toBeInTheDocument();
  });

  it('points to the location step when there is no baseline to compare with', async () => {
    renderGoals({ areaId: null });
    expect(await screen.findByText('No location yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /choose a location/i })).toHaveAttribute(
      'href',
      '/area',
    );
  });
});

describe('Agent pane goal check', () => {
  it('shows the saved goal’s deterministic check, without claiming a model ran', async () => {
    handlers.GoalAssessment = () => ({
      data: {
        planningSession: {
          id: 'ses_1',
          inputsRevision: 1,
          goalAssessment: assessment({
            outcome: 'INFEASIBLE',
            conflicts: [
              {
                code: 'recharge_vs_quality',
                message: 'Recharge can carry surface pollution into groundwater.',
                outcome: null,
              },
            ],
          }),
        },
      },
    });
    const sessions = new FakeSessionServer();
    sessions.seed('user-1', {
      id: 'ses_1',
      areaId: AREA,
      inputsRevision: 1,
      goal: { kind: 'IMPROVE_GROUNDWATER', description: '' },
    });
    render(
      <AuthTestProviders backend={new FakeAuthBackend(permanent())} sessions={sessions}>
        <MemoryRouter>
          <AgentPanel onUseTraditional={() => undefined} />
        </MemoryRouter>
      </AuthTestProviders>,
    );
    // The goal check is a lazily loaded chunk; under a loaded test run it can take >1 s.
    const section = await screen.findByRole('region', { name: 'Goal check' }, { timeout: 5000 });
    expect(within(section).getByText(/no language model is connected/i)).toBeInTheDocument();
    expect(await within(section).findByText(/surface pollution/i)).toBeInTheDocument();
    expect(within(section).queryByText(/how each measure fits/i)).not.toBeInTheDocument();
    expect(sent.find((s) => s.op === 'GoalAssessment')?.variables).toEqual({ sessionId: 'ses_1' });
  });
});
