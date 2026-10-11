import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';

import { apiClient } from '../../lib/apiClient';
import { AuthTestProviders } from '../../test/AuthTestProviders';
import { FakeAuthBackend, permanent } from '../../test/fakeAuth';
import { FakeSessionServer } from '../../test/fakeSession';
import AreaPage from '../area/index';
import { requestDevicePosition } from './geolocation';
import { PlacesContext } from './placesContext';
import { serverPlaces } from './serverPlaces';
import { PlacesUnavailable, type Place, type PlacesAdapter, type Suggestion } from './types';

const NO_ADMIN = {
  countryName: null,
  admin1: null,
  admin2: null,
  locality: null,
  sublocality: null,
};

function place(over: Partial<Place> & Pick<Place, 'placeId' | 'name'>): Place {
  return {
    formattedAddress: null,
    latitude: '0',
    longitude: '0',
    countryCode: null,
    scope: 'POINT',
    types: [],
    admin: NO_ADMIN,
    ...over,
  };
}

const NAIROBI = place({
  placeId: 'fixture:nairobi',
  name: 'Nairobi',
  formattedAddress: 'Nairobi, Kenya',
  latitude: '-1.2864',
  longitude: '36.8172',
  countryCode: 'KE',
  scope: 'LOCALITY',
  types: ['locality', 'political'],
  admin: { ...NO_ADMIN, countryName: 'Kenya', locality: 'Nairobi' },
});
const KORAMANGALA = place({
  placeId: 'fixture:koramangala',
  name: 'Koramangala',
  formattedAddress: 'Koramangala, Bengaluru, Karnataka, India',
  latitude: '12.9352',
  longitude: '77.6245',
  countryCode: 'IN',
  scope: 'SUBLOCALITY',
  types: ['sublocality'],
});
const KORAMANGALA_1 = place({
  ...KORAMANGALA,
  placeId: 'fixture:koramangala-1st-block',
  name: 'Koramangala 1st Block',
  formattedAddress: 'Koramangala 1st Block, Bengaluru, India',
});
const GAZETTEER = [NAIROBI, KORAMANGALA, KORAMANGALA_1];

class FakePlaces implements PlacesAdapter {
  readonly provider = 'fixture' as const;
  readonly attribution = 'Test places';
  hasMap = false;
  suggestCalls: string[] = [];
  reverseResult: Place[] = [];
  suggestError: Error | null = null;
  mapError: Error | null = null;

  suggest(text: string): Promise<Suggestion[]> {
    this.suggestCalls.push(text);
    if (this.suggestError) return Promise.reject(this.suggestError);
    const words = text.toLowerCase().split(/\s+/);
    return Promise.resolve(
      GAZETTEER.filter((p) => words.every((w) => p.name.toLowerCase().includes(w))).map((p) => ({
        id: p.placeId,
        primary: p.name,
        secondary: p.formattedAddress,
        place: p,
      })),
    );
  }

  select(s: Suggestion): Promise<Place> {
    return s.place ? Promise.resolve(s.place) : Promise.reject(new PlacesUnavailable());
  }

  reverse(): Promise<Place[]> {
    return Promise.resolve(this.reverseResult);
  }

  mountMap(): Promise<never> {
    return Promise.reject(this.mapError ?? new PlacesUnavailable());
  }
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

const confirmed = (input: Record<string, unknown>) => ({
  data: {
    confirmLocation: {
      area: {
        id: 'are_0000000000000000000000NEW1',
        name: input.name,
        countryCode: input.countryCode,
        timezone: 'UTC',
        currency: null,
        unitSystem: 'METRIC',
        evidence: 'SYNTHETIC',
        origin: input.origin,
        scope: 'POINT',
        extent: input.extent,
        radiusMeters: input.radiusMeters ?? null,
        private: input.origin !== 'PLACE_SEARCH',
        formattedAddress: input.formattedAddress ?? null,
        accuracyMeters: input.accuracyMeters ?? null,
        hasBoundary: input.extent === 'USER_RADIUS',
        providerContentExpired: false,
        regionSetByUser: [],
        admin: NO_ADMIN,
      },
      error: null,
    },
  },
});

const REGIONS: Record<string, Record<string, unknown>> = {
  KE: {
    currency: 'KES',
    currencyOptions: ['KES'],
    currencyCertain: true,
    timezone: 'Africa/Nairobi',
    timezoneOptions: ['Africa/Nairobi'],
    timezoneCertain: true,
    unitSystem: 'METRIC',
  },
  BT: {
    currency: 'INR',
    currencyOptions: ['INR', 'BTN'],
    currencyCertain: false,
    timezone: 'Asia/Thimphu',
    timezoneOptions: ['Asia/Thimphu'],
    timezoneCertain: true,
    unitSystem: 'METRIC',
  },
};

const confirms = () =>
  sent
    .filter((s) => s.op === 'ConfirmLocation')
    .map((s) => s.variables.input as Record<string, unknown>);

let geolocation: { getCurrentPosition: ReturnType<typeof vi.fn> };

beforeEach(() => {
  sent = [];
  handlers = {
    ConfirmLocation: (v) => confirmed(v.input as Record<string, unknown>),
    Countries: () => ({
      data: {
        countries: {
          countries: [
            { code: 'BT', name: 'Bhutan' },
            { code: 'KE', name: 'Kenya' },
            { code: 'PE', name: 'Peru' },
            { code: 'US', name: 'United States' },
          ],
        },
      },
    }),
    RegionSettings: (v) => {
      const region = REGIONS[v.countryCode as string];
      return region
        ? { data: { regionSettings: region } }
        : { errors: [{ message: 'later', extensions: { code: 'INTERNAL' } }] };
    },
    AreaLocation: () => ({ errors: [{ message: 'later', extensions: { code: 'INTERNAL' } }] }),
    AreaReadiness: () => ({ errors: [{ message: 'later', extensions: { code: 'INTERNAL' } }] }),
  };
  apiClient.defaults.adapter = stub;
  geolocation = { getCurrentPosition: vi.fn() };
  Object.defineProperty(navigator, 'geolocation', { value: geolocation, configurable: true });
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
});

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
});

function renderStep(places = new FakePlaces()) {
  const sessions = new FakeSessionServer();
  sessions.seed('user-1', { id: 'ses_1', areaId: null });
  render(
    <AuthTestProviders backend={new FakeAuthBackend(permanent())} sessions={sessions}>
      <PlacesContext.Provider value={places}>
        <AreaPage />
      </PlacesContext.Provider>
    </AuthTestProviders>,
  );
  return { sessions, places };
}

async function search(text: string) {
  const box = await screen.findByRole('combobox', { name: /search for a place/i });
  fireEvent.change(box, { target: { value: text } });
  return box;
}

async function confirmReview({ chooseExtent = true } = {}) {
  await screen.findByText('Is this the right location?');
  const radios = screen.getAllByRole('radio');
  if (chooseExtent && !radios.some((r) => (r as HTMLInputElement).checked)) {
    fireEvent.click(screen.getByRole('radio', { name: /just this point/i }));
  }
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /confirm location/i })));
}

describe('location step', () => {
  it('searches outside India, reviews, confirms and points the session at the area', async () => {
    const { sessions } = renderStep();
    await search('Nairobi');
    fireEvent.click(await screen.findByRole('option', { name: /nairobi/i }));
    expect(await screen.findByText('Is this the right location?')).toBeInTheDocument();
    expect(screen.getByText(/this is a city or town/i)).toBeInTheDocument();
    expect(screen.getByText(/not a water catchment/i)).toBeInTheDocument();
    expect(confirms()).toHaveLength(0);
    await confirmReview();
    expect(confirms()[0]).toMatchObject({
      origin: 'PLACE_SEARCH',
      placeId: 'fixture:nairobi',
      countryCode: 'KE',
      latitude: '-1.2864',
      extent: 'REFERENCE_POINT',
      radiusMeters: null,
      currency: null,
      timezone: null,
    });
    await waitFor(() =>
      expect(sessions.applied.at(-1)?.patch).toEqual({ areaId: 'are_0000000000000000000000NEW1' }),
    );
  });

  it('asks which place is meant for an ambiguous name and never picks one', async () => {
    renderStep();
    await search('Koramangala');
    expect(
      await screen.findByText(/2 places match “Koramangala”\. Choose the one you mean/),
    ).toBeInTheDocument();
    const list = screen.getByRole('listbox');
    expect(within(list).getAllByRole('option')).toHaveLength(2);
    expect(screen.queryByText('Is this the right location?')).not.toBeInTheDocument();
    expect(confirms()).toHaveLength(0);
  });

  it('supports keyboard selection in the results', async () => {
    renderStep();
    const box = await search('Koramangala');
    await screen.findAllByRole('option');
    fireEvent.keyDown(box, { key: 'ArrowDown' });
    fireEvent.keyDown(box, { key: 'ArrowDown' });
    expect(box).toHaveAttribute('aria-activedescendant', expect.stringMatching(/-1$/));
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(await screen.findByTestId('review-name')).toHaveTextContent('Koramangala 1st Block');
  });

  it('debounces and needs three characters before searching', async () => {
    const { places } = renderStep();
    await search('Na');
    await new Promise((r) => setTimeout(r, 400));
    expect(places.suggestCalls).toEqual([]);
    await search('Nai');
    await search('Nair');
    await search('Nairobi');
    await screen.findByRole('option', { name: /nairobi/i });
    expect(places.suggestCalls).toEqual(['Nairobi']);
  });

  it('offers manual entry when nothing matches or search is down', async () => {
    const places = new FakePlaces();
    renderStep(places);
    await search('Atlantis');
    expect(await screen.findByText(/no place matched “Atlantis”/i)).toBeInTheDocument();
    places.suggestError = new PlacesUnavailable();
    await search('Atlantis city');
    expect(await screen.findByText(/place search is unavailable right now/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search again/i })).toBeInTheDocument();
  });

  it('explains a denied location permission and keeps every other path open', async () => {
    renderStep();
    await screen.findByRole('combobox');
    expect(geolocation.getCurrentPosition).not.toHaveBeenCalled();
    geolocation.getCurrentPosition.mockImplementation((_ok, fail: PositionErrorCallback) =>
      fail({
        code: 1,
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
        message: '',
      } as GeolocationPositionError),
    );
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: /use my current location/i })),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(/permission was not given/i);
    expect(screen.getByRole('combobox')).toBeEnabled();
    expect(screen.getByRole('button', { name: /enter it yourself/i })).toBeEnabled();
    expect(confirms()).toHaveLength(0);
  });

  it('reports a timeout', async () => {
    renderStep();
    await screen.findByRole('combobox');
    geolocation.getCurrentPosition.mockImplementation((_ok, fail: PositionErrorCallback) =>
      fail({
        code: 3,
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
        message: '',
      } as GeolocationPositionError),
    );
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: /use my current location/i })),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /did not report a location in time/i,
    );
  });

  it('warns about an inaccurate fix and lets the person choose a named place instead', async () => {
    const places = new FakePlaces();
    places.reverseResult = [KORAMANGALA];
    renderStep(places);
    await screen.findByRole('combobox');
    geolocation.getCurrentPosition.mockImplementation((ok: PositionCallback) =>
      ok({ coords: { latitude: 12.93, longitude: 77.62, accuracy: 4200 } } as GeolocationPosition),
    );
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: /use my current location/i })),
    );
    expect(await screen.findByText('This device location is imprecise')).toBeInTheDocument();
    expect(screen.getByText(/stays private to you/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: KORAMANGALA.formattedAddress ?? '' }));
    expect(await screen.findByTestId('review-name')).toHaveTextContent('Koramangala');
    await confirmReview();
    expect(confirms()[0]).toMatchObject({ origin: 'PLACE_SEARCH', placeId: 'fixture:koramangala' });
  });

  it('confirms an accurate device fix as a private point with its accuracy', async () => {
    const places = new FakePlaces();
    places.reverseResult = [NAIROBI];
    renderStep(places);
    await screen.findByRole('combobox');
    geolocation.getCurrentPosition.mockImplementation((ok: PositionCallback) =>
      ok({
        coords: { latitude: -1.28641234567, longitude: 36.8172, accuracy: 25.4 },
      } as GeolocationPosition),
    );
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: /use my current location/i })),
    );
    expect(await screen.findByText('Is this the right location?')).toBeInTheDocument();
    expect(screen.queryByText('This device location is imprecise')).not.toBeInTheDocument();
    await confirmReview();
    expect(confirms()[0]).toMatchObject({
      origin: 'GEOLOCATION',
      placeId: null,
      latitude: '-1.2864123',
      countryCode: 'KE',
      accuracyMeters: 25,
      formattedAddress: null,
    });
  });

  it('asks for the country when a device fix has no nearby place', async () => {
    renderStep();
    await screen.findByRole('combobox');
    geolocation.getCurrentPosition.mockImplementation((ok: PositionCallback) =>
      ok({ coords: { latitude: -12.04, longitude: -77.04, accuracy: 30 } } as GeolocationPosition),
    );
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: /use my current location/i })),
    );
    await confirmReview();
    expect(await screen.findByText('Choose the country this place is in.')).toBeInTheDocument();
    expect(confirms()).toHaveLength(0);
    const country = await screen.findByRole('combobox', { name: /country/i });
    await waitFor(() => expect(country).toBeEnabled());
    fireEvent.change(country, { target: { value: 'PE' } });
    await confirmReview();
    expect(confirms()[0]).toMatchObject({ origin: 'GEOLOCATION', countryCode: 'PE' });
  });

  it('completes a custom location with a user radius', async () => {
    renderStep();
    fireEvent.click(await screen.findByRole('button', { name: /enter it yourself/i }));
    const form = screen.getByRole('form', { name: /enter a location yourself/i });
    fireEvent.click(within(form).getByRole('button', { name: /review this location/i }));
    expect(await within(form).findAllByText(/give the location a name/i)).not.toHaveLength(0);
    fireEvent.change(within(form).getByLabelText(/^name/i), { target: { value: 'Our well' } });
    fireEvent.change(within(form).getByLabelText(/^latitude/i), { target: { value: '39.78' } });
    fireEvent.change(within(form).getByLabelText(/^longitude/i), { target: { value: '-89.65' } });
    const country = within(form).getByRole('combobox', { name: /country/i });
    await waitFor(() => expect(country).toBeEnabled());
    fireEvent.change(country, { target: { value: 'US' } });
    fireEvent.click(within(form).getByRole('button', { name: /review this location/i }));
    expect(await screen.findByTestId('review-name')).toHaveTextContent('Our well');
    fireEvent.click(screen.getByRole('radio', { name: /a circle around it/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /radius \(km\)/i }), {
      target: { value: '80' },
    });
    await confirmReview();
    expect(await screen.findAllByText(/from 0.1 to 50 km/i)).not.toHaveLength(0);
    fireEvent.change(screen.getByRole('textbox', { name: /radius \(km\)/i }), {
      target: { value: '2.5' },
    });
    await confirmReview();
    expect(confirms()[0]).toMatchObject({
      origin: 'CUSTOM',
      placeId: null,
      name: 'Our well',
      countryCode: 'US',
      extent: 'USER_RADIUS',
      radiusMeters: 2500,
    });
  });

  it('completes the step by search when the map fails to load', async () => {
    const places = new FakePlaces();
    places.hasMap = true;
    const { sessions } = renderStep(places);
    expect(await screen.findByText('The map is unavailable')).toBeInTheDocument();
    await search('Nairobi');
    fireEvent.click(await screen.findByRole('option', { name: /nairobi/i }));
    await confirmReview();
    expect(confirms()[0]).toMatchObject({ origin: 'PLACE_SEARCH', placeId: 'fixture:nairobi' });
    await waitFor(() =>
      expect(sessions.applied.at(-1)?.patch).toEqual({ areaId: 'are_0000000000000000000000NEW1' }),
    );
  });

  it('retries a lost confirmation with the same idempotency key', async () => {
    let attempts = 0;
    handlers.ConfirmLocation = (v) => {
      attempts += 1;
      if (attempts === 1) throw new Error('network down');
      return confirmed(v.input as Record<string, unknown>);
    };
    renderStep();
    await search('Nairobi');
    fireEvent.click(await screen.findByRole('option', { name: /nairobi/i }));
    await confirmReview();
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not save the location/i);
    await confirmReview();
    const [first, second] = confirms();
    expect(first?.idempotencyKey).toBeTruthy();
    expect(second?.idempotencyKey).toBe(first?.idempotencyKey);
  });

  it('shows server field errors from confirmation', async () => {
    handlers.ConfirmLocation = () => ({
      data: {
        confirmLocation: {
          area: null,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'some fields need attention',
            requestId: null,
            currentVersion: null,
            fieldErrors: [{ field: 'countryCode', message: 'Choose a country WaterLens knows.' }],
          },
        },
      },
    });
    renderStep();
    await search('Nairobi');
    fireEvent.click(await screen.findByRole('option', { name: /nairobi/i }));
    await confirmReview();
    expect(await screen.findByText('Choose a country WaterLens knows.')).toBeInTheDocument();
  });
});

describe('location review (Prompt 08 review)', () => {
  async function reviewNairobi(places = new FakePlaces()) {
    const rendered = renderStep(places);
    await search('Nairobi');
    fireEvent.click(await screen.findByRole('option', { name: /nairobi/i }));
    await screen.findByText('Is this the right location?');
    return rendered;
  }

  it('never preselects how calculations treat the place', async () => {
    await reviewNairobi();
    for (const radio of screen.getAllByRole('radio')) expect(radio).not.toBeChecked();
    await confirmReview({ chooseExtent: false });
    expect(
      await screen.findByText('Choose how calculations should treat this place.'),
    ).toBeVisible();
    expect(confirms()).toHaveLength(0);
  });

  it('marks test gazetteer places in search results and the review', async () => {
    renderStep();
    await search('Nairobi');
    const option = await screen.findByRole('option', { name: /nairobi/i });
    expect(within(option).getByText('Test place')).toBeInTheDocument();
    fireEvent.click(option);
    expect(await screen.findByText('Test place, not real data')).toBeInTheDocument();
    expect(screen.getByText(/local test gazetteer/i)).toBeInTheDocument();
  });

  it('previews certain region settings and sends no override when untouched', async () => {
    await reviewNairobi();
    const currency = await screen.findByRole('combobox', { name: /currency/i });
    expect(currency).toHaveValue('KES');
    expect(screen.getByRole('combobox', { name: /time zone/i })).toHaveValue('Africa/Nairobi');
    expect(screen.queryByText('Please check')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /country/i })).toHaveValue('KE');
  });

  it('flags an uncertain currency after a country correction and records the choice', async () => {
    await reviewNairobi();
    const country = screen.getByRole('combobox', { name: /country/i });
    await waitFor(() => expect(country).toBeEnabled());
    fireEvent.change(country, { target: { value: 'BT' } });
    expect(await screen.findByText('Please check')).toBeInTheDocument();
    const currency = screen.getByRole('combobox', { name: /currency/i });
    expect(currency).toHaveValue('INR');
    fireEvent.change(currency, { target: { value: 'BTN' } });
    await confirmReview();
    expect(confirms()[0]).toMatchObject({ countryCode: 'BT', currency: 'BTN', timezone: null });
  });

  it('keeps confirming possible when the region preview fails', async () => {
    handlers.RegionSettings = () => ({
      errors: [{ message: 'x', extensions: { code: 'INTERNAL' } }],
    });
    await reviewNairobi();
    expect(await screen.findByText('Region settings not previewed')).toBeInTheDocument();
    await confirmReview();
    expect(confirms()[0]).toMatchObject({ currency: null, timezone: null });
  });
});

describe('requestDevicePosition', () => {
  it('classifies insecure and unsupported contexts without prompting', async () => {
    const nav = { geolocation: { getCurrentPosition: vi.fn() } } as unknown as Navigator;
    await expect(requestDevicePosition({ nav, secure: false })).resolves.toEqual({
      kind: 'insecure',
    });
    await expect(requestDevicePosition({ nav: {} as Navigator, secure: true })).resolves.toEqual({
      kind: 'unsupported',
    });
    expect(nav.geolocation.getCurrentPosition).not.toHaveBeenCalled();
  });
});

describe('serverPlaces (local fixture through the API)', () => {
  it('turns resolveLocation candidates into suggestions without a map', async () => {
    handlers.ResolveLocation = () => ({
      data: {
        resolveLocation: {
          query: 'Koramangala',
          provider: 'fixture',
          needsClarification: true,
          question: '“Koramangala” matches 2 places. Which one do you mean?',
          candidates: [KORAMANGALA, KORAMANGALA_1],
        },
      },
    });
    const adapter = serverPlaces('fixture');
    expect(adapter.hasMap).toBe(false);
    const suggestions = await adapter.suggest('Koramangala', new AbortController().signal);
    expect(suggestions.map((s) => s.id)).toEqual([KORAMANGALA.placeId, KORAMANGALA_1.placeId]);
    await expect(adapter.select(suggestions[0]!)).resolves.toBe(suggestions[0]!.place);
    expect(sent[0]).toEqual({ op: 'ResolveLocation', variables: { text: 'Koramangala' } });
  });

  it('reports an unavailable provider and an empty reverse lookup', async () => {
    handlers.ResolveLocation = () => ({
      errors: [{ message: 'down', extensions: { code: 'SERVICE_UNAVAILABLE' } }],
    });
    handlers.ReverseLocation = () => ({
      errors: [{ message: 'x', extensions: { code: 'INTERNAL' } }],
    });
    const adapter = serverPlaces('server');
    await expect(adapter.suggest('Lima', new AbortController().signal)).rejects.toBeInstanceOf(
      PlacesUnavailable,
    );
    await expect(adapter.reverse('1', '2')).resolves.toEqual([]);
  });
});
