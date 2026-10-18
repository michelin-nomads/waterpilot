import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import type {
  AreaReadinessFieldsFragment,
  AreaReadinessQuery,
} from '../../graphql/generated/graphql';
import { apiClient } from '../../lib/apiClient';
import { AuthTestProviders } from '../../test/AuthTestProviders';
import { FakeAuthBackend, permanent } from '../../test/fakeAuth';
import { baseline, baselineReply, demoBaseline, manualBaseline } from '../../test/baselineFixtures';
import { FakeSessionServer } from '../../test/fakeSession';
import { usePlanningSession } from '../../session/sessionContext';
import { BaselinePanel } from './BaselinePanel';
import { calculatePopulationEstimate } from './populationEstimateMath';
import { ReadinessPanel } from './ReadinessPanel';
import BaselinePage from './BaselinePage';
import AreaPage from './index';

const AREA = 'are_0000000000000000000000AREA';

function readiness(over: Partial<AreaReadinessFieldsFragment> = {}): AreaReadinessFieldsFragment {
  return {
    areaId: AREA,
    sessionId: 'ses_1',
    assessedAt: '2026-10-10T00:00:00Z',
    asOf: '2026-10-10',
    demo: false,
    basis: 'USER_INPUT',
    capabilities: [
      {
        capability: 'RAINFALL',
        state: 'UNAVAILABLE',
        reasons: ['No reviewed rainfall source covers this area.'],
        technicalSupport: 'SUPPORTED',
        requiresLocalMeasurement: false,
        requiresReviewedModel: false,
        registeredSourceIds: [],
        demo: false,
      },
    ],
    inputs: [
      {
        input: 'POPULATION',
        label: 'Population served',
        unit: 'COUNT',
        state: 'UNAVAILABLE',
        reasons: ['No population figure for this area.'],
        action: 'Enter the population your supply serves, with its source.',
        manualEntryAllowed: true,
        ownerPrompt: null,
        manualValue: null,
        demo: false,
      },
      {
        input: 'UNIT_PRICE',
        label: 'Water unit price',
        unit: 'INR_PAISE',
        state: 'UNAVAILABLE',
        reasons: ['Cost inputs arrive in a later step.'],
        action: 'Costs are entered in a later step.',
        manualEntryAllowed: false,
        ownerPrompt: null,
        manualValue: null,
        demo: false,
      },
    ],
    metrics: [
      {
        metric: 'demand',
        state: 'UNAVAILABLE',
        reasons: ['Population served is unavailable.'],
        blockedInputs: ['POPULATION'],
        demo: false,
      },
    ],
    ...over,
  };
}

function areaReply(r = readiness()): { data: AreaReadinessQuery } {
  return {
    data: { area: { id: AREA, name: 'Test ward', evidence: 'PROVISIONAL', readiness: r } },
  };
}

function locationReply(over: Record<string, unknown> = {}) {
  return {
    data: {
      area: {
        id: AREA,
        name: 'Test ward',
        centroidLat: '12.9352',
        centroidLon: '77.6245',
        placeId: 'fixture:test-ward',
        countryCode: 'IN',
        timezone: 'Asia/Kolkata',
        currency: 'INR',
        unitSystem: 'METRIC',
        evidence: 'PROVISIONAL',
        origin: 'PLACE_SEARCH',
        scope: 'SUBLOCALITY',
        extent: 'REFERENCE_POINT',
        radiusMeters: null,
        private: false,
        formattedAddress: 'Test ward, Bengaluru, Karnataka, India',
        accuracyMeters: null,
        hasBoundary: false,
        providerContentExpired: false,
        regionSetByUser: ['currency'],
        admin: {
          countryName: 'India',
          admin1: 'Karnataka',
          admin2: null,
          locality: 'Bengaluru',
          sublocality: null,
        },
        ...over,
      },
    },
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

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  });
  sent = [];
  handlers = {
    AreaReadiness: () => areaReply(),
    AreaLocation: () => locationReply(),
    AreaBaseline: () => baselineReply(),
  };
  apiClient.defaults.adapter = stub;
});

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
});

/** The readiness panel's own sections; the baseline above repeats some labels. */
const readinessMetrics = () =>
  screen.findByRole('region', { name: 'What WaterPilot can calculate here' });
const readinessInputs = () => screen.findByRole('region', { name: 'What you can provide' });
const populationRow = async () =>
  within(await readinessInputs())
    .getByText('Population served')
    .closest('li') as HTMLElement;

// Keep the existing panel-level calculation/input coverage independent of route placement.
function BaselinePanelsForTest() {
  const { view, state } = usePlanningSession();
  if (!view?.areaId || state.server?.areaId !== view.areaId) return null;
  return (
    <>
      <BaselinePanel areaId={view.areaId} sessionId={view.id} />
      <ReadinessPanel areaId={view.areaId} sessionId={view.id} />
    </>
  );
}

function RoutePathProbe() {
  const { pathname } = useLocation();
  return <output data-testid="route-path">{pathname}</output>;
}

function renderArea(areaId: string | null = AREA, showCommunityReadiness = false) {
  const sessions = new FakeSessionServer();
  if (areaId !== undefined) sessions.seed('user-1', { id: 'ses_1', areaId });
  render(
    <AuthTestProviders backend={new FakeAuthBackend(permanent())} sessions={sessions}>
      <MemoryRouter>
        <AreaPage />
        {!showCommunityReadiness && <BaselinePanelsForTest />}
        {showCommunityReadiness && (
          <ReadinessPanel areaId={AREA} sessionId="ses_1" section="community" />
        )}
        <RoutePathProbe />
      </MemoryRouter>
    </AuthTestProviders>,
  );
  return sessions;
}

function renderBaseline(initialEntry = '/baseline') {
  const sessions = new FakeSessionServer();
  sessions.seed('user-1', { id: 'ses_1', stage: 'BASELINE', areaId: AREA });
  render(
    <AuthTestProviders backend={new FakeAuthBackend(permanent())} sessions={sessions}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/baseline/:section?" element={<BaselinePage />} />
        </Routes>
        <RoutePathProbe />
      </MemoryRouter>
    </AuthTestProviders>,
  );
  return sessions;
}

describe('community type', () => {
  it('records the community type on the plan and keeps the stated homes', async () => {
    const sessions = renderBaseline('/baseline');
    const select = await screen.findByRole('combobox', { name: 'Community type' });
    expect(select).toHaveValue('');
    fireEvent.change(select, { target: { value: 'APARTMENT' } });
    await waitFor(() =>
      expect(sessions.applied.at(-1)?.patch).toEqual({
        siteProfile: { communityType: 'APARTMENT', occupiedHomes: null },
      }),
    );
    fireEvent.change(select, { target: { value: '' } });
    await waitFor(() =>
      expect(sessions.applied.at(-1)?.patch).toEqual({
        siteProfile: { communityType: null, occupiedHomes: null },
      }),
    );
  });
});

describe('AreaPage', () => {
  it('renders the stage heading and position', async () => {
    renderArea();
    expect(
      screen.getByRole('heading', { level: 1, name: /understand your area/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 6')).toBeInTheDocument();
    await screen.findByRole('heading', { name: /data coverage/i });
  });

  it('asks for a location without offering manual entry or the synthetic demo area', async () => {
    renderArea(null);
    expect(
      await screen.findByRole('combobox', { name: /search for a place/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Area map' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Water conditions' })).not.toBeInTheDocument();
    expect(sent).toHaveLength(0);
    expect(
      screen.queryByRole('button', { name: /synthetic demo area|enter it yourself/i }),
    ).not.toBeInTheDocument();
  });

  it('shows readiness states with reasons and never a number as a result', async () => {
    renderArea();
    const metric = within(await readinessMetrics()).getByText('Water demand');
    const row = metric.closest('li') as HTMLElement;
    expect(within(row).getByText('Unavailable')).toBeInTheDocument();
    expect(within(row).getByText('Population served is unavailable.')).toBeInTheDocument();
    expect(screen.getByText(/no source registered/i)).toBeInTheDocument();
    expect(screen.queryByText(/\b0\s*(MLD|%|days|L\/day)/)).not.toBeInTheDocument();
    expect(sent.find((s) => s.op === 'AreaReadiness')).toEqual({
      op: 'AreaReadiness',
      variables: { areaId: AREA, sessionId: 'ses_1' },
    });
  });

  it('offers manual entry only where the server allows it', async () => {
    renderArea();
    const population = await populationRow();
    expect(within(population).getByLabelText(/population served value/i)).toBeInTheDocument();
    const price = screen.getByText('Water unit price').closest('li') as HTMLElement;
    expect(within(price).queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('groups community inputs and reports water-input completion inside an expandable section', async () => {
    const base = readiness().inputs[0]!;
    handlers.AreaReadiness = () =>
      areaReply(
        readiness({
          inputs: [
            base,
            {
              ...base,
              input: 'PER_CAPITA_STANDARD',
              label: 'Per-person daily water need',
              unit: 'LITRES_PER_DAY',
            },
            {
              ...base,
              input: 'DELIVERED_SUPPLY',
              label: 'Delivered supply',
              unit: 'LITRES_PER_DAY',
              state: 'AVAILABLE',
              manualEntryAllowed: false,
            },
            {
              ...base,
              input: 'TANKER_SUPPLY',
              label: 'Tanker supply',
              unit: 'LITRES_PER_DAY',
              state: 'USER_ENTERED',
              manualEntryAllowed: false,
            },
            {
              ...base,
              input: 'FORWARD_SERIES',
              label: 'Forward supply and demand projection',
              unit: 'LITRES_PER_DAY',
              manualEntryAllowed: false,
            },
          ],
        }),
      );
    renderArea(AREA, true);
    const panel = await readinessInputs();
    expect(within(panel).getByText('Population served')).toBeInTheDocument();
    expect(within(panel).getByText('Per-person daily water need')).toBeInTheDocument();
    const disclosure = within(panel).getByText('Water sources and supply').closest('details')!;
    expect(disclosure).not.toHaveAttribute('open');
    expect(within(disclosure).getByText('2 of 3 complete')).toBeInTheDocument();
    fireEvent.click(within(disclosure).getByText('Water sources and supply'));
    expect(within(disclosure).getByText('Delivered supply')).toBeVisible();
    expect(within(disclosure).getByText('Tanker supply')).toBeVisible();
    expect(within(disclosure).getByText('Forward supply and demand projection')).toBeVisible();
  });

  it('keeps a saved area editable and hides results until explicitly requested', async () => {
    handlers.AreaLocation = () => locationReply({ radiusMeters: 1000 });
    renderArea();
    expect(await screen.findByTestId('review-name')).toHaveTextContent('Test ward, Bengaluru');
    expect(screen.getByRole('combobox', { name: 'Search for a place' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Water conditions' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Understand this area' }));
    expect(await screen.findByRole('heading', { name: 'Water conditions' })).toBeVisible();
    expect(screen.getByRole('form', { name: 'Your selected area' })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Test a Future Scenario' }));
    expect(screen.getByTestId('route-path')).toHaveTextContent('/scenarios');
    expect(await screen.findByText('User-input assessment')).toBeInTheDocument();
  });

  it('requires a fresh search when saved provider details have expired', async () => {
    handlers.AreaLocation = () => locationReply({ providerContentExpired: true });
    renderArea();
    expect(await screen.findByText(/kept for at most 30 days/i)).toBeInTheDocument();
    expect(await screen.findByRole('combobox', { name: 'Search for a place' })).toBeVisible();
    expect(screen.queryByRole('form', { name: 'Your selected area' })).not.toBeInTheDocument();
  });

  it('labels demo sources as synthetic', async () => {
    handlers.AreaReadiness = () => areaReply(readiness({ demo: true }));
    renderArea();
    expect(await screen.findByText('Demo data')).toBeInTheDocument();
    expect(screen.getByText(/not facts about any real place/i)).toBeInTheDocument();
  });

  it('shows an error with retry, and recovers', async () => {
    let calls = 0;
    handlers.AreaReadiness = () => {
      calls += 1;
      if (calls === 1) {
        return { errors: [{ message: 'boom', extensions: { code: 'INTERNAL' } }] };
      }
      return areaReply();
    };
    renderArea();
    const retry = await screen.findByRole('button', { name: /try again/i });
    expect(screen.getByText(/data readiness could not load/i)).toBeInTheDocument();
    expect(sent.filter((s) => s.op === 'AreaReadiness')).toHaveLength(1);
    fireEvent.click(retry);
    expect(within(await readinessMetrics()).getByText('Water demand')).toBeInTheDocument();
  });

  it('shows a permission state when the session or area is not the user’s', async () => {
    handlers.AreaReadiness = () => ({
      errors: [{ message: 'not found', extensions: { code: 'NOT_FOUND' } }],
    });
    renderArea();
    expect(await screen.findByText(/not available to you/i)).toBeInTheDocument();
  });

  it('saves a manual value with one idempotency key across a retry and refreshes', async () => {
    let attempts = 0;
    handlers.RecordManualInput = () => {
      attempts += 1;
      if (attempts === 1) throw new Error('network down');
      return {
        data: {
          recordManualInput: {
            manualInput: {
              id: 'min_1',
              input: 'POPULATION',
              value: '12000',
              unit: 'COUNT',
              enteredValue: '12000',
              enteredUnit: 'people',
              asOf: '2026-10-01',
              note: 'Ward census table',
            },
            error: null,
          },
        },
      };
    };
    renderArea();
    const population = await populationRow();
    fireEvent.change(within(population).getByLabelText(/population served value/i), {
      target: { value: '12000' },
    });
    fireEvent.change(within(population).getByLabelText(/^source/i), {
      target: { value: 'Ward census table' },
    });
    const save = within(population).getByRole('button', { name: /save value/i });
    await act(async () => fireEvent.click(save));
    expect(await within(population).findByRole('alert')).toHaveTextContent(/nothing was lost/i);
    await act(async () => fireEvent.click(save));
    expect(await within(population).findByText(/not as measured data/i)).toBeInTheDocument();

    const writes = sent.filter((s) => s.op === 'RecordManualInput');
    expect(writes).toHaveLength(2);
    const [first, second] = writes.map((w) => w.variables.input as Record<string, unknown>);
    expect(first?.idempotencyKey).toBe(second?.idempotencyKey);
    expect(second).toMatchObject({
      sessionId: 'ses_1',
      input: 'POPULATION',
      value: '12000',
      unit: 'people',
      asOf: '2026-10-10',
    });
    await waitFor(() =>
      expect(sent.filter((s) => s.op === 'AreaReadiness').length).toBeGreaterThan(1),
    );
  });

  it('shows server field errors inline and in the summary', async () => {
    handlers.RecordManualInput = () => ({
      data: {
        recordManualInput: {
          manualInput: null,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Check the highlighted fields.',
            requestId: null,
            currentVersion: null,
            fieldErrors: [{ field: 'asOf', message: 'The date cannot be in the future.' }],
          },
        },
      },
    });
    renderArea();
    const population = await populationRow();
    fireEvent.change(within(population).getByLabelText(/population served value/i), {
      target: { value: '5' },
    });
    fireEvent.change(within(population).getByLabelText(/^source/i), {
      target: { value: 'My bill' },
    });
    await act(async () =>
      fireEvent.click(within(population).getByRole('button', { name: /save value/i })),
    );
    expect(
      await within(population).findAllByText('The date cannot be in the future.'),
    ).not.toHaveLength(0);
  });

  it('rejects a non-number before sending', async () => {
    renderArea();
    const population = await populationRow();
    fireEvent.change(within(population).getByLabelText(/population served value/i), {
      target: { value: '12,000 people' },
    });
    fireEvent.click(within(population).getByRole('button', { name: /save value/i }));
    expect(await within(population).findAllByText(/enter a number such as 2.5/i)).not.toHaveLength(
      0,
    );
    expect(sent.some((s) => s.op === 'RecordManualInput')).toBe(false);
  });
});

describe('Baseline community setup', () => {
  it('reviews the combined form inside Baseline and preserves a custom concern', async () => {
    const sessions = renderBaseline();
    await screen.findByRole('heading', { level: 1, name: 'Build your community baseline' });
    expect(screen.queryByRole('navigation', { name: 'Baseline sections' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Primary water concern'), {
      target: { value: 'other' },
    });
    fireEvent.change(screen.getByLabelText(/Your water concern/), {
      target: { value: 'Summer pressure drops' },
    });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Review Baseline' })));
    await screen.findByRole('heading', { level: 1, name: 'Your water baseline' });
    expect(screen.getByTestId('route-path')).toHaveTextContent('/baseline/overview');
    expect(
      sessions.applied.some(
        (item) => item.patch.communityBaseline?.concern === 'Summer pressure drops',
      ),
    ).toBe(true);
    expect(await screen.findByText('Supply unknown')).toBeVisible();
    expect(screen.getByText('Cannot calculate yet')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Edit community details' }));
    expect(await screen.findByLabelText(/Your water concern/)).toHaveValue('Summer pressure drops');
  });

  it('enables estimate acceptance with three visible numeric inputs and no extra text requirement', async () => {
    const sessions = renderBaseline();
    fireEvent.click(await screen.findByText('Community details', { exact: true }));
    fireEvent.click(screen.getByRole('heading', { name: 'Daily water use' }));
    expect(screen.getByRole('spinbutton', { name: 'Daily water use' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Help me estimate daily use' }));
    const calculator = screen.getByRole('dialog', { name: 'Estimate daily water use' });
    expect(
      screen.getByRole('heading', { name: 'Build your community baseline', level: 1 }),
    ).toBeInTheDocument();
    expect(within(calculator).getByRole('button', { name: 'Accept estimate' })).toBeDisabled();
    expect(
      within(calculator).queryByRole('region', { name: 'Estimated daily water use' }),
    ).not.toBeInTheDocument();
    fireEvent.change(within(calculator).getByRole('spinbutton', { name: /Occupied homes/ }), {
      target: { value: '10' },
    });
    fireEvent.change(screen.getByLabelText(/Residents per home/), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText(/Litres per person per day/), {
      target: { value: '135.5' },
    });
    expect(screen.getByRole('button', { name: 'Accept estimate' })).toBeEnabled();
    expect(screen.getByText(/2710 litres \/ day/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Accept estimate' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Daily water use' })).toHaveValue(2710);
    expect(screen.getByTestId('route-path')).toHaveTextContent('/baseline');
    expect(sessions.applied.some((item) => item.patch.communityBaseline)).toBe(false);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Review Baseline' })));
    await screen.findByRole('heading', { name: 'Your water baseline', level: 1 });
    expect(
      sessions.applied.find((item) => item.patch.communityBaseline)?.patch.communityBaseline,
    ).toMatchObject({ dailyUse: '2710', demandEstimated: true, residents: 20 });
  });

  it('allows daily water use immediately and saves kilolitres as litres', async () => {
    const sessions = renderBaseline();
    fireEvent.click(await screen.findByRole('heading', { name: 'Daily water use' }));
    const use = screen.getByRole('spinbutton', { name: 'Daily water use' });
    expect(use).toBeVisible();
    fireEvent.change(screen.getByLabelText('Unit'), { target: { value: 'kL/day' } });
    fireEvent.change(use, { target: { value: '32.4' } });
    expect(screen.getByLabelText(/I don’t know my daily use/)).not.toBeChecked();
    expect(screen.queryByLabelText(/Source or assumptions/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Help me estimate daily use' }),
    ).not.toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Review Baseline' })));
    await screen.findByRole('heading', { name: 'Your water baseline', level: 1 });
    expect(
      sessions.applied.find((item) => item.patch.communityBaseline)?.patch.communityBaseline
        ?.dailyUse,
    ).toBe('32400');
  });

  it('preserves community entries when leaving the optional estimate without accepting', async () => {
    renderBaseline();
    fireEvent.click(await screen.findByText('Community details', { exact: true }));
    fireEvent.click(screen.getByRole('heading', { name: 'Daily water use' }));
    fireEvent.change(screen.getByLabelText('Community notes'), {
      target: { value: 'Keep this note' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Help me estimate daily use' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByLabelText('Community notes')).toHaveValue('Keep this note');
    expect(screen.getByRole('spinbutton', { name: 'Daily water use' })).toHaveValue(null);
  });

  it('edits water sources inline and clears completeness when a quantity becomes unknown', async () => {
    renderBaseline();
    await screen.findByLabelText('Primary water concern');
    expect(screen.queryByText('Know what each value means')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Date these figures describe/)).not.toBeInTheDocument();
    expect(screen.getByText('Not added')).toBeVisible();
    fireEvent.click(screen.getByText('Water sources and supply details'));
    fireEvent.click(screen.getByRole('button', { name: 'Add water source' }));
    fireEvent.change(screen.getByLabelText('Daily average (litres / day)'), {
      target: { value: '500' },
    });
    expect(screen.queryByText('Know what each value means')).not.toBeInTheDocument();
    const complete = screen.getByLabelText(/I have added every water source and its quantity/);
    fireEvent.click(complete);
    expect(complete).toBeChecked();
    fireEvent.change(screen.getByLabelText('Daily average (litres / day)'), {
      target: { value: '' },
    });
    expect(complete).not.toBeChecked();
    expect(complete).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Remove source 1' }));
    expect(screen.queryByText('Know what each value means')).not.toBeInTheDocument();
    expect(screen.getByTestId('route-path')).toHaveTextContent('/baseline');
  });

  it.each([
    ['10', '2', '135.5', { population: '20', dailyDemandLitres: '2710' }],
    ['3', '1.5', '100', null],
    ['0', '2', '100', null],
    ['10', '2', '0', null],
    ['10', '2.0001', '100', null],
  ])(
    'calculates only exact supported estimate inputs (%s homes)',
    (homes, residents, use, expected) => {
      expect(calculatePopulationEstimate(homes, residents, use)).toEqual(expected);
    },
  );
});

describe('Baseline data coverage drawer', () => {
  it('shows real coverage fields and closes on Escape without changing the current baseline route', async () => {
    renderBaseline('/baseline/overview');
    const trigger = await screen.findByRole('button', { name: 'Data coverage and sources' });
    trigger.focus();
    fireEvent.click(trigger);
    const drawer = await screen.findByRole('dialog', { name: 'Data coverage and sources' });
    const table = await within(drawer).findByRole('table');
    for (const header of ['Dataset', 'Source', 'Date', 'Resolution', 'Coverage', 'Status']) {
      expect(within(table).getByRole('columnheader', { name: header })).toBeInTheDocument();
    }
    expect(within(table).getAllByText('Source not recorded').length).toBeGreaterThan(0);
    expect(within(drawer).getByText('Limitations and assumptions')).toBeVisible();
    fireEvent.keyDown(drawer, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
    expect(screen.getByTestId('route-path')).toHaveTextContent('/baseline/overview');
  });

  it('keeps entered-source provenance and provisional status visible in the evidence table', async () => {
    handlers.AreaBaseline = () => baselineReply(manualBaseline());
    renderBaseline('/baseline/overview');
    fireEvent.click(await screen.findByRole('button', { name: 'Data coverage and sources' }));
    const drawer = await screen.findByRole('dialog', { name: 'Data coverage and sources' });
    const table = await within(drawer).findByRole('table');
    expect(within(table).getAllByText('Demand').length).toBeGreaterThan(0);
    expect(within(table).getAllByText(/Ward census table/i).length).toBeGreaterThan(0);
    expect(within(table).getAllByText('Partial').length).toBeGreaterThan(0);
    expect(within(drawer).getByText(/Non-domestic use was not provided/i)).toBeInTheDocument();
  });
});

describe('BaselinePanel', () => {
  const card = (metric: string) =>
    document.querySelector(`[data-baseline-metric="${metric}"]`) as HTMLElement;
  const baselineRegion = () => screen.findByRole('region', { name: 'Your water baseline' });

  it('shows every metric as unavailable with a reason when nothing is known', async () => {
    renderArea();
    const region = await baselineRegion();
    for (const metric of ['demand', 'delivered_supply', 'deficit']) {
      expect(within(card(metric)).getByText('Unavailable')).toBeInTheDocument();
      expect(within(card(metric)).getByText('A value it needs is missing.')).toBeInTheDocument();
    }
    expect(within(region).queryByText(/\b0(\.0)?\s*(MLD|kL\/day|%|days)/)).not.toBeInTheDocument();
    expect(
      within(region).getByText('Nothing can be calculated yet.', { exact: false }),
    ).toBeVisible();
    expect(within(region).getByText(/supply composition/i)).toBeInTheDocument();
    expect(
      within(region).getByText(/unavailable until compatible delivered-supply and tanker records/i),
    ).toBeInTheDocument();
    expect(region.querySelectorAll('[data-baseline-metric]')).toHaveLength(3);
    expect(sent.find((s) => s.op === 'AreaBaseline')).toEqual({
      op: 'AreaBaseline',
      variables: { areaId: AREA, sessionId: 'ses_1' },
    });
  });

  it('makes adding the first missing essential the primary action and links to its input section', async () => {
    renderArea();
    const region = await baselineRegion();
    const missing = within(region).getByRole('region', {
      name: 'What would complete this baseline',
    });
    expect(within(missing).getByText(/labelled as your estimate/i)).toBeInTheDocument();
    expect(within(missing).getByText(/stay unavailable until daily records/i)).toBeInTheDocument();
    const primary = within(region).getByRole('link', { name: 'Add population served' });
    expect(primary).toHaveAttribute('href', '/baseline');
    expect(within(region).getByRole('link', { name: 'Continue to your goal' })).toHaveAttribute(
      'href',
      '/goals',
    );
  });

  it('labels typed-in results as your estimate and keeps day-by-day metrics unavailable', async () => {
    handlers.AreaBaseline = () => baselineReply(manualBaseline());
    renderArea();
    const region = await baselineRegion();
    expect(within(card('demand')).getByText('1.6')).toBeInTheDocument();
    expect(within(card('demand')).getByText('MLD')).toBeInTheDocument();
    expect(card('demand').querySelector('[data-origin="USER_ESTIMATE"]')).toHaveTextContent(
      'Your estimate',
    );
    expect(within(card('demand')).getByText('Provisional')).toBeInTheDocument();
    expect(within(region).getByRole('img', { name: /tanker supply 30%/i })).toBeInTheDocument();
    fireEvent.click(
      within(region).getByRole('button', { name: 'Data sources and supply details' }),
    );
    const sources = within(region).getByRole('region', {
      name: 'Data sources and supply details',
    });
    fireEvent.click(within(sources).getByRole('button', { name: /Reliable supply/i }));
    expect(within(sources).getAllByText('Unavailable').length).toBeGreaterThan(0);
    expect(within(sources).getAllByText(/defined day by day/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Set your goal' })).toHaveAttribute('href', '/goals');
  });

  it('discloses definition, exact value, assumptions and evidence progressively', async () => {
    handlers.AreaBaseline = () => baselineReply(manualBaseline());
    renderArea();
    const baseline = await baselineRegion();
    fireEvent.click(
      within(baseline).getByRole('button', { name: 'Data sources and supply details' }),
    );
    const details = within(baseline).getByRole('region', {
      name: 'Data sources and supply details',
    });
    expect(within(details).getByText(/population \* per_capita_lpcd/)).not.toBeVisible();
    fireEvent.click(within(details).getByRole('button', { name: /water demand/i }));
    expect(within(details).getByText(/population \* per_capita_lpcd/)).toBeVisible();
    expect(within(details).getByText('1620000')).toBeInTheDocument();
    expect(within(details).getByText(/non-domestic use was not provided/i)).toBeInTheDocument();
    expect(within(details).getByText('Population served (entered by you)')).toBeInTheDocument();
    expect(within(details).getAllByText(/Uncertainty: Not quantified/)).toHaveLength(2);
    expect(within(details).getAllByText(/as of 1 Oct 2026/i).length).toBeGreaterThan(0);
    fireEvent.click(within(baseline).getByRole('button', { name: 'Key assumptions' }));
    expect(
      within(baseline).getByText(/Water demand: Non-domestic use was not provided/i),
    ).toBeVisible();
  });

  it('reproduces the golden fixture values from the demo source, labelled synthetic', async () => {
    handlers.AreaBaseline = () => baselineReply(demoBaseline());
    renderArea();
    const region = await baselineRegion();
    const expected: Record<string, string> = {
      demand: '10.0',
      delivered_supply: '10.1',
      deficit: '2.0',
    };
    for (const [metric, text] of Object.entries(expected)) {
      expect(within(card(metric)).getByText(text)).toBeInTheDocument();
    }
    expect(region.querySelectorAll('[data-baseline-metric]')).toHaveLength(3);
    expect(card('delivered_supply').querySelector('[data-origin="MEASURED"]')).not.toBeNull();
    expect(card('deficit').querySelector('[data-origin="USER_ESTIMATE"]')).not.toBeNull();
    expect(
      within(region).getByRole('img', { name: /tanker supply 27%; other delivered supply 73%/i }),
    ).toBeInTheDocument();
    expect(within(card('delivered_supply')).getByText('Synthetic demo data')).toBeInTheDocument();
    expect(within(region).getByText('Demo data')).toBeInTheDocument();
    expect(
      within(region).getAllByText(/10 of the last 365 days/, { selector: 'li' }).length,
    ).toBeGreaterThan(0);
  });

  it('keeps the chart and its table equivalent, with gaps unavailable in both', async () => {
    handlers.AreaBaseline = () => baselineReply(demoBaseline(8));
    renderArea();
    const region = await baselineRegion();
    const figure = within(region).getByRole('figure', { name: /supply and demand by day/i });
    // A gap splits the delivered line (the first series) instead of dropping to zero.
    const [delivered, demand] = Array.from(figure.querySelectorAll('svg > g:not([aria-hidden])'));
    expect(delivered?.querySelectorAll('path')).toHaveLength(2);
    expect(delivered?.querySelectorAll('circle')).toHaveLength(9);
    expect(demand?.querySelectorAll('path')).toHaveLength(1);
    fireEvent.click(within(figure).getByRole('button', { name: /show table/i }));
    const table = within(figure).getByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(10);
    const cells = rows.map((r) =>
      within(r)
        .getAllByRole('cell')
        .map((c) => c.textContent),
    );
    expect(cells[0]).toEqual(['11.0', '10.0', '3.0']);
    expect(cells[7]).toEqual(['8.0', '10.0', '2.0']);
    expect(cells[8]).toEqual(['Unavailable', '10.0', '2.0']);
    expect(within(rows[0] as HTMLElement).getByRole('rowheader')).toHaveTextContent('1 Jan');
  });

  it('says on the card itself when an average leaves out days without records', async () => {
    const b = demoBaseline(8);
    b.metrics = b.metrics.map((m) =>
      m.metric === 'delivered_supply'
        ? { ...m, value: '10000000', exact: '10000000', recordedDays: 9, periodDays: 10 }
        : m,
    );
    handlers.AreaBaseline = () => baselineReply(b);
    renderArea();
    await baselineRegion();
    expect(within(card('delivered_supply')).getByText('Average of 9 of 10 days')).toBeVisible();
    expect(within(card('delivered_supply')).getByText('Provisional')).toBeInTheDocument();
    // Typed-in constants carry no coverage caption.
    expect(card('demand').querySelector('[data-coverage]')).toBeNull();
  });

  it('formats rates for US customary areas in million gallons per day', async () => {
    handlers.AreaBaseline = () => baselineReply(manualBaseline(), 'US_CUSTOMARY');
    renderArea();
    await baselineRegion();
    expect(within(card('demand')).getByText('0.43')).toBeInTheDocument();
    expect(within(card('demand')).getByText('MGD')).toBeInTheDocument();
    expect(
      screen.getByText(/MGD means million US gallons per day \(1 US gallon = 3\.785411784 litres/),
    ).toBeInTheDocument();
  });

  it('uses one rate unit for the whole baseline and never shows a small rate as 0', async () => {
    const b = manualBaseline();
    handlers.AreaBaseline = () =>
      baselineReply({
        ...b,
        metrics: b.metrics.map((m) =>
          m.metric === 'delivered_supply' ? { ...m, value: '40000', exact: '40000' } : m,
        ),
      });
    renderArea();
    await baselineRegion();
    // Demand is 1.6 MLD, so supply stays in MLD with the precision it needs.
    expect(within(card('demand')).getByText('MLD')).toBeInTheDocument();
    expect(within(card('delivered_supply')).getByText('0.040')).toBeInTheDocument();
    expect(within(card('delivered_supply')).getByText('MLD')).toBeInTheDocument();
  });

  it('switches every rate to kL/day only when all of them are below 1 MLD', async () => {
    const b = manualBaseline();
    handlers.AreaBaseline = () =>
      baselineReply({
        ...b,
        metrics: b.metrics.map((m) =>
          m.metric === 'delivered_supply'
            ? { ...m, value: '40000', exact: '40000' }
            : m.metric === 'demand'
              ? { ...m, value: '60000', exact: '60000' }
              : m,
        ),
      });
    renderArea();
    await baselineRegion();
    expect(within(card('delivered_supply')).getByText('40')).toBeInTheDocument();
    expect(within(card('demand')).getByText('60')).toBeInTheDocument();
    expect(screen.getAllByText('kL/day')).toHaveLength(2);
  });

  it('revises the baseline after a value is saved', async () => {
    let version = 0;
    handlers.AreaBaseline = () => baselineReply(version === 0 ? baseline() : manualBaseline());
    handlers.RecordManualInput = () => {
      version = 1;
      return {
        data: {
          recordManualInput: {
            manualInput: {
              id: 'min_1',
              input: 'POPULATION',
              value: '12000',
              unit: 'COUNT',
              enteredValue: '12000',
              enteredUnit: 'people',
              asOf: '2026-10-10',
              note: 'Ward census table',
            },
            error: null,
          },
        },
      };
    };
    renderArea();
    const region = await baselineRegion();
    expect(region).toHaveAttribute('data-baseline-id', 'bsl_EMPTY');
    const population = await populationRow();
    fireEvent.change(within(population).getByLabelText(/population served value/i), {
      target: { value: '12000' },
    });
    fireEvent.change(within(population).getByLabelText(/^source/i), {
      target: { value: 'Ward census table' },
    });
    await act(async () =>
      fireEvent.click(within(population).getByRole('button', { name: /save value/i })),
    );
    await waitFor(() =>
      expect(screen.getByRole('region', { name: 'Your water baseline' })).toHaveAttribute(
        'data-baseline-id',
        'bsl_MANUAL',
      ),
    );
    expect(within(card('demand')).getByText('1.6')).toBeInTheDocument();
  });

  it('never lets an older baseline response overwrite a newer one', async () => {
    let calls = 0;
    let releaseOld: () => void = () => undefined;
    handlers.AreaBaseline = () => {
      calls += 1;
      if (calls === 1) {
        // The first load is slow and answers after the save's refetch.
        return new Promise((resolve) => {
          releaseOld = () => resolve(baselineReply({ ...baseline(), id: 'bsl_OLD' }));
        });
      }
      return baselineReply(manualBaseline());
    };
    handlers.RecordManualInput = () => ({
      data: {
        recordManualInput: {
          manualInput: {
            id: 'min_1',
            input: 'POPULATION',
            value: '12000',
            unit: 'COUNT',
            enteredValue: '12000',
            enteredUnit: 'people',
            asOf: '2026-10-10',
            note: 'Ward census table',
          },
          error: null,
        },
      },
    });
    renderArea();
    // Readiness loads independently, so a value can be saved while the baseline loads.
    const population = await populationRow();
    expect(calls).toBe(1);
    fireEvent.change(within(population).getByLabelText(/population served value/i), {
      target: { value: '12000' },
    });
    fireEvent.change(within(population).getByLabelText(/^source/i), {
      target: { value: 'Ward census table' },
    });
    await act(async () =>
      fireEvent.click(within(population).getByRole('button', { name: /save value/i })),
    );
    const region = await baselineRegion();
    await waitFor(() => expect(region).toHaveAttribute('data-baseline-id', 'bsl_MANUAL'));
    expect(calls).toBe(2);
    await act(async () => {
      releaseOld();
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(screen.getByRole('region', { name: 'Your water baseline' })).toHaveAttribute(
      'data-baseline-id',
      'bsl_MANUAL',
    );
  });

  it('shows chart provenance and explicit units, matching the cards', async () => {
    handlers.AreaBaseline = () => baselineReply(demoBaseline());
    renderArea();
    const region = await baselineRegion();
    // A synthetic series is never labelled plain "Measured".
    const origin = card('delivered_supply').querySelector('[data-origin="MEASURED"]');
    expect(origin).toHaveTextContent('Synthetic demo');
    expect(origin).toHaveAttribute('data-synthetic');
    expect(card('demand').querySelector('[data-origin="USER_ESTIMATE"]')).toHaveTextContent(
      'Your estimate',
    );
    const figure = within(region).getByRole('figure', { name: /supply and demand by day/i });
    fireEvent.click(within(figure).getByRole('button', { name: /show table/i }));
    const headers = within(within(figure).getByRole('table'))
      .getAllByRole('columnheader')
      .map((h) => h.textContent);
    expect(headers).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Delivered supply (synthetic demo)'),
        expect.stringContaining('Demand (your estimate)'),
        expect.stringContaining('Tanker supply (synthetic demo)'),
      ]),
    );
    // Cards and chart share the MLD unit; the demand card equals every demand cell.
    expect(within(card('demand')).getByText('MLD')).toBeInTheDocument();
    const demandCells = within(within(figure).getByRole('table'))
      .getAllByRole('row')
      .slice(1)
      .map((r) => within(r).getAllByRole('cell')[1]?.textContent);
    expect(new Set(demandCells)).toEqual(new Set(['10.0']));
    expect(within(card('demand')).getByText('10.0')).toBeInTheDocument();
  });

  it('shows a retryable error and recovers', async () => {
    let fail = true;
    handlers.AreaBaseline = () =>
      fail
        ? { errors: [{ message: 'boom', extensions: { code: 'INTERNAL' } }] }
        : baselineReply(manualBaseline());
    renderArea();
    expect(await screen.findByText('The baseline could not load')).toBeInTheDocument();
    expect(card('demand')).toBeNull();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByRole('region', { name: 'Your water baseline' })).toHaveAttribute(
      'data-baseline-id',
      'bsl_MANUAL',
    );
  });

  it('shows a permission state', async () => {
    handlers.AreaBaseline = () => ({
      errors: [{ message: 'not found', extensions: { code: 'NOT_FOUND' } }],
    });
    renderArea();
    expect(await screen.findByText('This baseline is not available to you')).toBeInTheDocument();
  });
});
