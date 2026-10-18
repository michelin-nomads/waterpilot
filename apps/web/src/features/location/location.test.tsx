import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { StrictMode } from 'react';
import { useLocationConfirmation } from '../planning/planningInteraction';
import { MapPanel } from './MapPanel';
import { MemoryRouter } from 'react-router-dom';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';

import { baselineReply } from '../../test/baselineFixtures';
import { apiClient } from '../../lib/apiClient';
import { AuthTestProviders } from '../../test/AuthTestProviders';
import { FakeAuthBackend, permanent } from '../../test/fakeAuth';
import { FakeSessionServer } from '../../test/fakeSession';
import AreaPage from '../area/index';
import { requestDevicePosition } from './geolocation';
import { googlePlaces } from './googlePlaces';
import { PlacesContext } from './placesContext';
import { serverPlaces } from './serverPlaces';
import {
  PlacesUnavailable,
  type Place,
  type PlacesAdapter,
  type Suggestion,
  type MapView,
} from './types';

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
  mapView?: MapView;
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

  mountMap(): Promise<MapView> {
    if (this.mapView) return Promise.resolve(this.mapView);
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
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  });
  sent = [];
  handlers = {
    AreaBaseline: () => baselineReply(),
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
  geolocation = {
    getCurrentPosition: vi.fn((_ok, fail: PositionErrorCallback) =>
      fail({ code: 2 } as GeolocationPositionError),
    ),
  };
  Object.defineProperty(navigator, 'geolocation', { value: geolocation, configurable: true });
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
  sessionStorage.clear();
});

afterEach(() => {
  sessionStorage.clear();
  apiClient.defaults.adapter = originalAdapter;
});

function renderStep(places: PlacesAdapter = new FakePlaces()) {
  const sessions = new FakeSessionServer();
  sessions.seed('user-1', { id: 'ses_1', areaId: null });
  render(
    <AuthTestProviders backend={new FakeAuthBackend(permanent())} sessions={sessions}>
      <PlacesContext.Provider value={places}>
        <MemoryRouter>
          <AreaPage />
        </MemoryRouter>
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

async function confirmReview() {
  await screen.findByRole('form', { name: 'Your selected area' });
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: /confirm area and check data/i })),
  );
}

describe('location step', () => {
  it('searches outside India, reviews, confirms and points the session at the area', async () => {
    const { sessions } = renderStep();
    await search('Nairobi');
    fireEvent.click(await screen.findByRole('option', { name: /nairobi/i }));
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Your selected area' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('A place is not a catchment')).not.toBeInTheDocument();
    expect(confirms()).toHaveLength(0);
    await confirmReview();
    expect(confirms()[0]).toMatchObject({
      origin: 'PLACE_SEARCH',
      placeId: 'fixture:nairobi',
      countryCode: 'KE',
      latitude: '-1.2864',
      extent: 'USER_RADIUS',
      radiusMeters: 1000,
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
    expect(
      screen.queryByRole('heading', { level: 2, name: 'Your selected area' }),
    ).not.toBeInTheDocument();
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
    const places = new FakePlaces();
    renderStep(places);
    await search('Na');
    await new Promise((r) => setTimeout(r, 400));
    expect(places.suggestCalls).toEqual([]);
    await search('Nai');
    await search('Nair');
    await search('Nairobi');
    await screen.findByRole('option', { name: /nairobi/i });
    expect(places.suggestCalls).toEqual(['Nairobi']);
  });

  it('previews a selected search result on the map before confirming it', async () => {
    const places = new FakePlaces();
    places.hasMap = true;
    const show = vi.fn();
    places.mapView = { show, destroy: vi.fn() };
    renderStep(places);
    await search('Nairobi');
    fireEvent.click(await screen.findByRole('option', { name: /Nairobi/ }));
    await waitFor(() =>
      expect(show).toHaveBeenCalledWith({
        latitude: NAIROBI.latitude,
        longitude: NAIROBI.longitude,
        radiusMeters: 1000,
      }),
    );
    expect(confirms()).toHaveLength(0);
  });

  it('keeps device location and retry available when search has no matches or is down', async () => {
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
    expect(geolocation.getCurrentPosition).toHaveBeenCalledOnce();
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
      fireEvent.click(screen.getByRole('button', { name: /use my location/i })),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(/permission was not given/i);
    expect(screen.getByRole('combobox')).toBeEnabled();
    expect(screen.queryByRole('button', { name: /enter it yourself/i })).not.toBeInTheDocument();
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
      fireEvent.click(screen.getByRole('button', { name: /use my location/i })),
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
      fireEvent.click(screen.getByRole('button', { name: /use my location/i })),
    );
    expect(await screen.findByText('This device location is imprecise')).toBeInTheDocument();
    expect(screen.getByText(/stays private to you/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Change area' }));
    await search('Koramangala');
    fireEvent.click(await screen.findByRole('option', { name: /^Koramangala Test place/ }));
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
      fireEvent.click(screen.getByRole('button', { name: /use my location/i })),
    );
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Your selected area' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('This device location is imprecise')).not.toBeInTheDocument();
    await confirmReview();
    expect(confirms()[0]).toMatchObject({
      origin: 'GEOLOCATION',
      placeId: null,
      latitude: '-1.2864123',
      countryCode: 'KE',
      accuracyMeters: 25,
      formattedAddress: 'Nairobi, Kenya',
    });
  });

  it('keeps the device point and retries fetching its geographic name before confirming', async () => {
    const places = new FakePlaces();
    renderStep(places);
    await screen.findByRole('combobox');
    geolocation.getCurrentPosition.mockImplementation((ok: PositionCallback) =>
      ok({
        coords: { latitude: 12.8676256, longitude: 77.6838009, accuracy: 35 },
      } as GeolocationPosition),
    );
    fireEvent.click(screen.getByRole('button', { name: /use my location/i }));
    expect(
      await screen.findByRole('button', { name: /^Confirm area and check data$/ }),
    ).toBeDisabled();
    places.reverseResult = [
      {
        ...KORAMANGALA,
        formattedAddress: 'HSR Layout, Bengaluru, Karnataka, India',
        admin: {
          ...NO_ADMIN,
          sublocality: 'HSR Layout',
          locality: 'Bengaluru',
          countryName: 'India',
        },
      },
    ];
    fireEvent.click(screen.getByRole('button', { name: /^Try again$/ }));
    expect(await screen.findByText('HSR Layout, Bengaluru')).toBeVisible();
    await confirmReview();
    expect(confirms()[0]).toMatchObject({
      name: 'HSR Layout, Bengaluru',
      origin: 'GEOLOCATION',
      countryCode: 'IN',
      latitude: '12.8676256',
      longitude: '77.6838009',
      accuracyMeters: 35,
    });
  });

  it('reviews a device fix with the Google adapter when the Geocoding API rejects the request', async () => {
    const geocode = vi.fn().mockRejectedValue(new Error('REQUEST_DENIED'));
    const adapter = googlePlaces(
      async () => ({
        importLibrary: async (name) => {
          if (name === 'geocoding')
            return {
              Geocoder: class {
                geocode = geocode;
              },
            };
          if (name === 'places')
            return {
              Place: {
                searchNearby: async () => ({
                  places: [
                    {
                      id: 'near',
                      location: { lat: () => 12.86, lng: () => 77.68 },
                      addressComponents: [
                        { shortText: 'IN', longText: 'India', types: ['country'] },
                        { shortText: 'HSR Layout', longText: 'HSR Layout', types: ['sublocality'] },
                        { shortText: 'Bengaluru', longText: 'Bengaluru', types: ['locality'] },
                      ],
                    },
                  ],
                }),
              },
              SearchNearbyRankPreference: { DISTANCE: 'DISTANCE' },
            };
          throw new Error('Map unavailable in this test');
        },
      }),
      { mapId: null },
    );
    renderStep(adapter);
    await screen.findByRole('combobox');
    geolocation.getCurrentPosition.mockImplementation((ok: PositionCallback) =>
      ok({
        coords: { latitude: 12.8676256, longitude: 77.6838009, accuracy: 35 },
      } as GeolocationPosition),
    );
    fireEvent.click(screen.getByRole('button', { name: /use my location/i }));
    expect(await screen.findByTestId('review-name')).toHaveTextContent('HSR Layout, Bengaluru');
    expect(geocode).toHaveBeenCalledWith({ location: { lat: 12.8676256, lng: 77.6838009 } });
    await confirmReview();
    expect(confirms()[0]).toMatchObject({
      origin: 'GEOLOCATION',
      countryCode: 'IN',
      accuracyMeters: 35,
    });
  });

  it('retries country detection without asking the user to enter a country', async () => {
    const places = new FakePlaces();
    renderStep(places);
    await screen.findByRole('combobox');
    geolocation.getCurrentPosition.mockImplementation((ok: PositionCallback) =>
      ok({
        coords: { latitude: 0, longitude: 0, accuracy: 30 },
      } as GeolocationPosition),
    );
    fireEvent.click(screen.getByRole('button', { name: /use my location/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not identify the country/i);
    expect(screen.queryByRole('combobox', { name: /country/i })).not.toBeInTheDocument();
    expect(confirms()).toHaveLength(0);
    places.reverseResult = [NAIROBI];
    geolocation.getCurrentPosition.mockImplementation((ok: PositionCallback) =>
      ok({
        coords: { latitude: -1.2864, longitude: 36.8172, accuracy: 30 },
      } as GeolocationPosition),
    );
    fireEvent.click(screen.getByRole('button', { name: /use my location/i }));
    await confirmReview();
    expect(confirms()[0]).toMatchObject({ origin: 'GEOLOCATION', countryCode: 'KE' });
  });

  it('reviews map clicks directly with an automatic country and a 1–10 km circle', async () => {
    const places = new FakePlaces();
    const show = vi.fn();
    let pick!: (latitude: string, longitude: string) => void;
    places.hasMap = true;
    places.reverseResult = [NAIROBI];
    places.mountMap = async (_host?: HTMLElement, options?: { onPick: typeof pick }) => {
      pick = options!.onPick;
      return { show, destroy: vi.fn() };
    };
    renderStep(places);
    await waitFor(() => expect(pick).toBeDefined());
    await act(async () => pick('-1.2864', '36.8172'));
    expect(await screen.findByTestId('review-name')).toHaveTextContent('Nairobi');
    const radius = screen.getByRole('textbox', { name: /radius/i });
    expect(radius).toHaveValue('1');
    for (const value of ['0.5', '10.1']) {
      fireEvent.change(radius, { target: { value } });
      await confirmReview();
      expect(screen.getByText('Enter a radius from 1 to 10 km.')).toBeVisible();
      expect(confirms()).toHaveLength(0);
    }
    fireEvent.change(radius, { target: { value: '2.5' } });
    await waitFor(() =>
      expect(show).toHaveBeenLastCalledWith(expect.objectContaining({ radiusMeters: 2500 })),
    );
    await confirmReview();
    expect(confirms()[0]).toMatchObject({
      origin: 'CUSTOM',
      countryCode: 'KE',
      extent: 'USER_RADIUS',
      radiusMeters: 2500,
      currency: null,
      timezone: null,
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
            fieldErrors: [{ field: 'countryCode', message: 'Choose a country WaterPilot knows.' }],
          },
        },
      },
    });
    renderStep();
    await search('Nairobi');
    fireEvent.click(await screen.findByRole('option', { name: /nairobi/i }));
    await confirmReview();
    expect(await screen.findByText('Choose a country WaterPilot knows.')).toBeInTheDocument();
  });
});

describe('location review (Prompt 08 review)', () => {
  async function reviewNairobi(places = new FakePlaces()) {
    const rendered = renderStep(places);
    await search('Nairobi');
    fireEvent.click(await screen.findByRole('option', { name: /nairobi/i }));
    await screen.findByRole('form', { name: 'Your selected area' });
    return rendered;
  }

  it('uses a circle by default and provides radius guidance through a tooltip', async () => {
    await reviewNairobi();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /radius/i })).toHaveValue('1');
    expect(screen.getByRole('textbox', { name: /radius/i })).toBeRequired();
    expect(
      screen.getByRole('button', { name: 'About the planning radius' }),
    ).toHaveAccessibleDescription(/from 1 to 10 km/);
    await confirmReview();
    expect(confirms()[0]).toMatchObject({ extent: 'USER_RADIUS', radiusMeters: 1000 });
  });

  it('marks test gazetteer places in search results and the review', async () => {
    renderStep();
    await search('Nairobi');
    const option = await screen.findByRole('option', { name: /nairobi/i });
    expect(within(option).getByText('Test place')).toBeInTheDocument();
    fireEvent.click(option);
    expect(await screen.findByText('Test place, not real data')).toBeInTheDocument();
  });

  it('uses the resolved country and leaves currency and timezone inference to the server', async () => {
    await reviewNairobi();
    for (const name of [/country/i, /currency/i, /time zone/i]) {
      expect(screen.queryByRole('combobox', { name })).not.toBeInTheDocument();
    }
    await confirmReview();
    expect(confirms()[0]).toMatchObject({ countryCode: 'KE', currency: null, timezone: null });
    expect(
      sent.some((request) => request.op === 'Countries' || request.op === 'RegionSettings'),
    ).toBe(false);
  });

  it('automatically resolves country metadata missing from a searched place', async () => {
    const places = new FakePlaces();
    places.select = async () => ({ ...NAIROBI, countryCode: null });
    places.reverseResult = [NAIROBI];
    await reviewNairobi(places);
    await confirmReview();
    expect(confirms()[0]).toMatchObject({ countryCode: 'KE', origin: 'PLACE_SEARCH' });
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

it('a cancelled StrictMode map mount cannot erase the active map canvas', async () => {
  const pending: Array<() => void> = [];
  const adapter: PlacesAdapter = {
    ...new FakePlaces(),
    provider: 'google',
    attribution: 'test',
    hasMap: true,
    suggest: async () => [],
    select: async () => GAZETTEER[0],
    reverse: async () => [],
    mountMap: (host) =>
      new Promise((resolve) => {
        const marker = document.createElement('span');
        marker.textContent = 'map canvas';
        host.append(marker);
        pending.push(() => resolve({ show: () => {}, destroy: () => host.replaceChildren() }));
      }),
  };
  render(
    <StrictMode>
      <MapPanel adapter={adapter} point={null} onPick={() => {}} />
    </StrictMode>,
  );
  expect(pending).toHaveLength(2);
  await act(async () => {
    pending[1]();
  });
  await act(async () => {
    pending[0]();
  });
  expect(screen.getByText('map canvas')).toBeInTheDocument();
});

// The area step must keep the editor mounted across the save and data request.
describe('understand area interaction', () => {
  it('reveals and scrolls to results only after the data arrives, keeping the editor intact', async () => {
    let complete!: (reply: ReturnType<typeof baselineReply>) => void;
    handlers.AreaBaseline = () =>
      new Promise((resolve) => {
        complete = resolve;
      });
    renderStep();
    await search('Nairobi');
    fireEvent.click(await screen.findByRole('option', { name: /nairobi/i }));
    const form = await screen.findByRole('form', { name: 'Your selected area' });
    expect(screen.queryByRole('heading', { name: 'Water conditions' })).not.toBeInTheDocument();
    expect(sent.some((s) => s.op === 'AreaBaseline')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm area and check data' }));
    await screen.findByRole('progressbar', { name: 'Understanding your area…' });
    await waitFor(() => expect(complete).toBeTypeOf('function'));
    await waitFor(() =>
      expect(screen.getByRole('progressbar', { name: 'Understanding your area…' })).toHaveAttribute(
        'aria-valuenow',
        '50',
      ),
    );
    expect(screen.queryByRole('heading', { name: 'Water conditions' })).not.toBeInTheDocument();
    expect(HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();
    await act(async () => complete(baselineReply()));
    const results = await screen.findByRole('region', { name: 'Water conditions results' });
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Your selected area' })).toBe(form);
    expect(screen.getByRole('combobox', { name: 'Search for a place' })).toBeVisible();
    await waitFor(() =>
      expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'start',
      }),
    );
    expect(results).toHaveFocus();
    fireEvent.change(screen.getByRole('textbox', { name: /Radius/ }), { target: { value: '2' } });
    expect(screen.queryByRole('heading', { name: 'Water conditions' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continue to baseline' })).not.toBeInTheDocument();
  });

  it('dismisses the loader on failure and allows retry without losing the location', async () => {
    let calls = 0;
    handlers.AreaBaseline = () =>
      ++calls === 1
        ? { errors: [{ message: 'unavailable', extensions: { code: 'INTERNAL' } }] }
        : baselineReply();
    renderStep();
    await search('Nairobi');
    fireEvent.click(await screen.findByRole('option', { name: /nairobi/i }));
    await confirmReview();
    expect(await screen.findByText(/Could not load water conditions/)).toBeVisible();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Water conditions' })).not.toBeInTheDocument();
    expect(screen.getByTestId('review-name')).toHaveTextContent('Nairobi');
    await confirmReview();
    expect(await screen.findByRole('heading', { name: 'Water conditions' })).toBeVisible();
    expect(calls).toBe(2);
  });
});

it('suggests device location on initial entry without saving it automatically', async () => {
  geolocation.getCurrentPosition.mockImplementation((ok: PositionCallback) =>
    ok({ coords: { latitude: 12.93, longitude: 77.62, accuracy: 25 } } as GeolocationPosition),
  );
  const places = new FakePlaces();
  places.reverseResult = [KORAMANGALA];
  renderStep(places);
  await screen.findByRole('form', { name: 'Your selected area' });
  expect(geolocation.getCurrentPosition).toHaveBeenCalledOnce();
  expect(confirms()).toHaveLength(0);
});

it('uses the same location confirmation from the agent and blocks duplicate submission', async () => {
  geolocation.getCurrentPosition.mockImplementation((ok: PositionCallback) =>
    ok({ coords: { latitude: 12.93, longitude: 77.62, accuracy: 25 } } as GeolocationPosition),
  );
  const places = new FakePlaces();
  places.reverseResult = [KORAMANGALA];
  renderStep(places);
  await screen.findByRole('form', { name: 'Your selected area' });
  const action = renderHook(() => useLocationConfirmation('ses_1'));
  await waitFor(() => expect(action.result.current).toBeTypeOf('function'));
  const confirmFromAgent = action.result.current!;
  await act(async () => {
    confirmFromAgent();
    confirmFromAgent();
  });
  await waitFor(() => expect(confirms()).toHaveLength(1));
});
