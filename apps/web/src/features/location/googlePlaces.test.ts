import { loadGoogleMaps, resetGoogleMapsLoader, type GoogleMapsApi } from './googleMapsLoader';
import { CALL_TIMEOUT_MS, googlePlaces, PLACE_FIELDS, SESSION_MAX_AGE_MS } from './googlePlaces';
import { createPlacesAdapter } from './placesContext';
import { PlacesUnavailable } from './types';

const latLng = (lat: number, lng: number) => ({ lat: () => lat, lng: () => lng });

function fakeGoogle() {
  const tokens: object[] = [];
  const requests: { input: string; sessionToken: object }[] = [];
  const fetched: string[][] = [];
  class AutocompleteSessionToken {
    constructor() {
      tokens.push(this);
    }
  }
  const prediction = (id: string, main: string, secondary: string) => ({
    placeId: id,
    text: { text: `${main}, ${secondary}` },
    mainText: { text: main },
    secondaryText: { text: secondary },
    toPlace: () => {
      const data = {
        id,
        displayName: main,
        formattedAddress: `${main}, ${secondary}`,
        location: latLng(-12.0463731234, -77.0427934),
        types: ['locality', 'political'],
        addressComponents: [
          { shortText: 'Lima', longText: 'Lima', types: ['locality', 'political'] },
          { shortText: 'LIM', longText: 'Lima Province', types: ['administrative_area_level_2'] },
          { shortText: 'PE', longText: 'Peru', types: ['country', 'political'] },
        ],
        fetchFields: async ({ fields }: { fields: string[] }) => {
          fetched.push(fields);
          return {};
        },
      };
      return data;
    },
  });
  const places = {
    AutocompleteSessionToken,
    AutocompleteSuggestion: {
      fetchAutocompleteSuggestions: async (request: { input: string; sessionToken: object }) => {
        requests.push(request);
        return {
          suggestions: [
            { placePrediction: prediction('ChIJlima', 'Lima', 'Peru') },
            { placePrediction: null },
          ],
        };
      },
    },
  };
  const geocoding = {
    Geocoder: class {
      geocode = async () => ({
        results: [
          {
            place_id: 'ChIJnear',
            formatted_address: 'Miraflores, Lima, Peru',
            types: ['sublocality', 'political'],
            address_components: [
              { short_name: 'Miraflores', long_name: 'Miraflores', types: ['sublocality'] },
              { short_name: 'PE', long_name: 'Peru', types: ['country'] },
            ],
            geometry: { location: latLng(-12.12, -77.03) },
          },
        ],
      });
    },
  };
  const api: GoogleMapsApi = {
    importLibrary: async (name) => {
      if (name === 'places') return places;
      if (name === 'geocoding') return geocoding;
      throw new Error(`unexpected library ${name}`);
    },
  };
  return { api, tokens, requests, fetched, places };
}

describe('googlePlaces adapter', () => {
  it('reuses one session token per search and starts a new one after a selection', async () => {
    const g = fakeGoogle();
    const adapter = googlePlaces(async () => g.api, { mapId: null });
    const signal = new AbortController().signal;

    await adapter.suggest('Li', signal);
    const [lima] = await adapter.suggest('Lima', signal);
    expect(g.tokens).toHaveLength(1);
    expect(g.requests.map((r) => r.sessionToken)).toEqual([g.tokens[0], g.tokens[0]]);
    expect(lima).toEqual({ id: 'ChIJlima', primary: 'Lima', secondary: 'Peru' });

    const place = await adapter.select(lima!);
    expect(g.fetched).toEqual([[...PLACE_FIELDS]]);
    expect(place).toMatchObject({
      placeId: 'google:ChIJlima',
      name: 'Lima',
      latitude: '-12.0463731',
      longitude: '-77.0427934',
      countryCode: 'PE',
      scope: 'LOCALITY',
      admin: { countryName: 'Peru', admin2: 'Lima Province', locality: 'Lima' },
    });

    await adapter.suggest('Cusco', signal);
    expect(g.tokens).toHaveLength(2);
    expect(g.requests.at(-1)?.sessionToken).toBe(g.tokens[1]);
  });

  it('starts a fresh session token when an abandoned search is older than Google allows', async () => {
    const g = fakeGoogle();
    let clock = 0;
    const adapter = googlePlaces(async () => g.api, { mapId: null, now: () => clock });
    const signal = new AbortController().signal;
    await adapter.suggest('Lima', signal);
    clock += SESSION_MAX_AGE_MS - 1;
    await adapter.suggest('Lima P', signal);
    expect(g.tokens).toHaveLength(1);
    clock += 2;
    const [lima] = await adapter.suggest('Lima Pe', signal);
    expect(g.tokens).toHaveLength(2);
    expect(g.requests.at(-1)?.sessionToken).toBe(g.tokens[1]);
    await expect(adapter.select(lima!)).resolves.toMatchObject({ placeId: 'google:ChIJlima' });
  });

  it('bounds a Google call that never answers', async () => {
    const g = fakeGoogle();
    g.places.AutocompleteSuggestion.fetchAutocompleteSuggestions = () => new Promise(() => {});
    const adapter = googlePlaces(async () => g.api, { mapId: null });
    vi.useFakeTimers();
    try {
      const pending = adapter.suggest('Lima', new AbortController().signal);
      const outcome = expect(pending).rejects.toThrow(/too long/);
      await vi.advanceTimersByTimeAsync(CALL_TIMEOUT_MS + 1);
      await outcome;
    } finally {
      vi.useRealTimers();
    }
  });

  it('requests only Essentials/Pro place fields', () => {
    expect(PLACE_FIELDS).not.toContain('reviews');
    expect(PLACE_FIELDS).not.toContain('regularOpeningHours');
    expect(PLACE_FIELDS).not.toContain('photos');
  });

  it('drops results a newer keystroke superseded', async () => {
    const g = fakeGoogle();
    const adapter = googlePlaces(async () => g.api, { mapId: null });
    const controller = new AbortController();
    const pending = adapter.suggest('Lima', controller.signal);
    controller.abort();
    await expect(pending).resolves.toEqual([]);
  });

  it('normalizes reverse geocoding and reports nothing when it fails', async () => {
    const g = fakeGoogle();
    const adapter = googlePlaces(async () => g.api, { mapId: null });
    const [near] = await adapter.reverse('-12.12', '-77.03');
    expect(near).toMatchObject({
      placeId: 'google:ChIJnear',
      name: 'Miraflores',
      countryCode: 'PE',
      scope: 'SUBLOCALITY',
    });
    const broken = googlePlaces(() => Promise.reject(new Error('offline')), { mapId: null });
    await expect(broken.reverse('0', '0')).resolves.toEqual([]);
  });

  it('turns a load failure into PlacesUnavailable for search and the map', async () => {
    const adapter = googlePlaces(() => Promise.reject(new Error('blocked')), { mapId: null });
    const signal = new AbortController().signal;
    await expect(adapter.suggest('Lima', signal)).rejects.toBeInstanceOf(PlacesUnavailable);
    await expect(
      adapter.mountMap(document.createElement('div'), { onPick: vi.fn(), onFailure: vi.fn() }),
    ).rejects.toBeInstanceOf(PlacesUnavailable);
  });
});

describe('loadGoogleMaps', () => {
  afterEach(() => {
    resetGoogleMapsLoader();
    document.head.querySelectorAll('script').forEach((s) => s.remove());
  });

  const script = () => document.head.querySelector('script') as HTMLScriptElement;

  it('adds one async script with the key and callback, and resolves on the callback', async () => {
    const w = window as unknown as { google?: unknown; __waterpilotMapsReady?: () => void };
    const loading = loadGoogleMaps('AIza-test');
    expect(loadGoogleMaps('AIza-test')).toBe(loading);
    const url = new URL(script().src);
    expect(url.origin + url.pathname).toBe('https://maps.googleapis.com/maps/api/js');
    expect(url.searchParams.get('key')).toBe('AIza-test');
    expect(url.searchParams.get('loading')).toBe('async');
    expect(url.searchParams.get('callback')).toBe('__waterpilotMapsReady');
    const api = { importLibrary: vi.fn() };
    w.google = { maps: api };
    w.__waterpilotMapsReady?.();
    await expect(loading).resolves.toBe(api);
    delete w.google;
  });

  it('fails on timeout, network error and a rejected key', async () => {
    vi.useFakeTimers();
    try {
      const timedOut = loadGoogleMaps('k', { timeoutMs: 50 });
      vi.advanceTimersByTime(60);
      await expect(timedOut).rejects.toThrow(/too long/);
    } finally {
      vi.useRealTimers();
    }

    const network = loadGoogleMaps('k');
    script().onerror?.(new Event('error'));
    await expect(network).rejects.toThrow(/could not be reached/);

    const rejected = loadGoogleMaps('k');
    (window as unknown as { gm_authFailure: () => void }).gm_authFailure();
    await expect(rejected).rejects.toThrow(/rejected/);
    await expect(loadGoogleMaps('k')).rejects.toBeInstanceOf(PlacesUnavailable);
  });
});

describe('createPlacesAdapter', () => {
  it('never uses Google unless a pilot browser key is configured', () => {
    expect(createPlacesAdapter({ provider: 'fixture' }).provider).toBe('fixture');
    expect(createPlacesAdapter({ provider: 'none' }).provider).toBe('server');
    expect(createPlacesAdapter({ provider: 'fixture' }).hasMap).toBe(false);
    const google = createPlacesAdapter({ provider: 'google', apiKey: 'k', mapId: null });
    expect(google.provider).toBe('google');
    expect(google.attribution).toBe('Powered by Google');
    expect(document.head.querySelector('script')).toBeNull();
  });
});
