import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';

import type {
  AreaReadinessFieldsFragment,
  AreaReadinessQuery,
} from '../../graphql/generated/graphql';
import { apiClient } from '../../lib/apiClient';
import { AuthTestProviders } from '../../test/AuthTestProviders';
import { FakeAuthBackend, permanent } from '../../test/fakeAuth';
import { FakeSessionServer } from '../../test/fakeSession';
import AreaPage, { DEMO_AREA_ID } from './index';

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
  return { data: handler(body.variables), status: 200, statusText: 'OK', headers: {}, config };
};

beforeEach(() => {
  sent = [];
  handlers = { AreaReadiness: () => areaReply(), AreaLocation: () => locationReply() };
  apiClient.defaults.adapter = stub;
});

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
});

function renderArea(areaId: string | null = AREA) {
  const sessions = new FakeSessionServer();
  if (areaId !== undefined) sessions.seed('user-1', { id: 'ses_1', areaId });
  render(
    <AuthTestProviders backend={new FakeAuthBackend(permanent())} sessions={sessions}>
      <AreaPage />
    </AuthTestProviders>,
  );
  return sessions;
}

describe('AreaPage', () => {
  it('renders the stage heading and position', async () => {
    renderArea();
    expect(
      screen.getByRole('heading', { level: 1, name: /understand your area/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
    await screen.findByRole('heading', { name: /data coverage/i });
  });

  it('asks for a location when the session has none, offering the demo area locally', async () => {
    const sessions = renderArea(null);
    expect(
      await screen.findByRole('combobox', { name: /search for a place/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/local mode shows no map/i)).toBeInTheDocument();
    expect(sent).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: /use the synthetic demo area/i }));
    await waitFor(() => expect(sessions.applied.at(-1)?.patch).toEqual({ areaId: DEMO_AREA_ID }));
  });

  it('shows readiness states with reasons and never a number as a result', async () => {
    renderArea();
    const metric = await screen.findByText('Water demand');
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
    const population = (await screen.findByText('Population served')).closest('li') as HTMLElement;
    expect(within(population).getByLabelText(/population served value/i)).toBeInTheDocument();
    const price = screen.getByText('Water unit price').closest('li') as HTMLElement;
    expect(within(price).queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('shows the confirmed location with region settings and a user-input banner', async () => {
    renderArea();
    expect(await screen.findByRole('heading', { name: 'Test ward' })).toBeInTheDocument();
    expect(screen.getByText(/^INR \(set by you\)$/)).toBeInTheDocument();
    expect(screen.getByText('Asia/Kolkata')).toBeInTheDocument();
    expect(screen.getByText(/reference point only/i)).toBeInTheDocument();
    expect(await screen.findByText('User-input assessment')).toBeInTheDocument();
  });

  it('asks to choose the place again when provider details expired', async () => {
    handlers.AreaLocation = () => locationReply({ providerContentExpired: true });
    renderArea();
    expect(await screen.findByText(/kept for at most 30 days/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /choose it again/i }));
    expect(
      await screen.findByRole('combobox', { name: /search for a place/i }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /keep the current location/i }));
    expect(await screen.findByRole('heading', { name: 'Test ward' })).toBeInTheDocument();
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
    expect(await screen.findByText('Water demand')).toBeInTheDocument();
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
    const population = (await screen.findByText('Population served')).closest('li') as HTMLElement;
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
    const population = (await screen.findByText('Population served')).closest('li') as HTMLElement;
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
    const population = (await screen.findByText('Population served')).closest('li') as HTMLElement;
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
