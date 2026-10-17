import type { GoogleMapsApi } from './googleMapsLoader';
import {
  adminFrom,
  decimal,
  PlacesUnavailable,
  scopeFromTypes,
  type MapView,
  type Place,
  type PlacesAdapter,
  type Suggestion,
} from './types';

interface LatLng {
  lat(): number;
  lng(): number;
}

interface PlaceData {
  id: string;
  displayName?: string | null;
  formattedAddress?: string | null;
  location?: LatLng | null;
  types?: string[] | null;
  addressComponents?: { shortText: string | null; longText: string | null; types: string[] }[];
}

interface PlacePrediction {
  placeId: string;
  text: { text: string };
  mainText?: { text: string } | null;
  secondaryText?: { text: string } | null;
  toPlace(): PlaceData & { fetchFields(request: { fields: string[] }): Promise<unknown> };
}

interface PlacesLibrary {
  AutocompleteSessionToken: new () => object;
  AutocompleteSuggestion: {
    fetchAutocompleteSuggestions(request: {
      input: string;
      sessionToken: object;
    }): Promise<{ suggestions: { placePrediction: PlacePrediction | null }[] }>;
  };
}

interface GeocoderResult {
  place_id: string;
  formatted_address: string;
  types: string[];
  address_components: { short_name: string; long_name: string; types: string[] }[];
  geometry: { location: LatLng };
}

interface GeocodingLibrary {
  Geocoder: new () => {
    geocode(request: { location: { lat: number; lng: number } }): Promise<{
      results: GeocoderResult[];
    }>;
  };
}

interface MapLike {
  setCenter(point: { lat: number; lng: number }): void;
  setZoom(zoom: number): void;
  addListener(
    event: 'click',
    handler: (event: { latLng: LatLng | null }) => void,
  ): { remove(): void };
}

interface Overlay {
  setMap(map: MapLike | null): void;
}

interface MapsLibrary {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => MapLike;
  Circle: new (options: Record<string, unknown>) => Overlay;
}

interface MarkerLibrary {
  /** Needs a Map ID; the legacy `Marker` is used without one. */
  AdvancedMarkerElement: new (options: Record<string, unknown>) => { map: MapLike | null };
  Marker: new (options: Record<string, unknown>) => Overlay;
}

/**
 * Minimal Place Details fields: no Enterprise or Atmosphere fields such as ratings,
 * opening hours, photos or reviews. The requested fields set the billed SKU (ADR 0009).
 */
export const PLACE_FIELDS = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
  'types',
  'addressComponents',
] as const;

const MAX_GEOCODE_RESULTS = 5;
/** Every Google call is bounded; a slow answer becomes the unavailable fallback. */
export const CALL_TIMEOUT_MS = 8_000;
/**
 * Google ends an autocomplete session a few minutes after it starts. An abandoned search
 * older than this starts a fresh token rather than reusing an expired one.
 */
export const SESSION_MAX_AGE_MS = 3 * 60_000;

function bounded<T>(work: Promise<T>, timeoutMs = CALL_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new PlacesUnavailable('Google took too long to answer.')),
      timeoutMs,
    );
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

function fromPlace(data: PlaceData): Place {
  if (!data.location) throw new PlacesUnavailable('The place has no location.');
  const types = data.types ?? [];
  const parts = (data.addressComponents ?? []).map((c) => ({
    short: c.shortText ?? '',
    long: c.longText ?? '',
    types: c.types,
  }));
  return {
    placeId: `google:${data.id}`,
    name: data.displayName ?? data.formattedAddress ?? 'Unnamed place',
    formattedAddress: data.formattedAddress ?? null,
    latitude: decimal(data.location.lat()),
    longitude: decimal(data.location.lng()),
    types,
    scope: scopeFromTypes(types),
    ...adminFrom(parts),
  };
}

function fromGeocode(result: GeocoderResult): Place {
  const parts = result.address_components.map((c) => ({
    short: c.short_name,
    long: c.long_name,
    types: c.types,
  }));
  const { admin, countryCode } = adminFrom(parts);
  return {
    placeId: `google:${result.place_id}`,
    name: admin.sublocality ?? admin.locality ?? result.formatted_address,
    formattedAddress: result.formatted_address,
    latitude: decimal(result.geometry.location.lat()),
    longitude: decimal(result.geometry.location.lng()),
    types: result.types,
    scope: scopeFromTypes(result.types),
    countryCode,
    admin,
  };
}

async function library<T>(
  load: () => Promise<GoogleMapsApi>,
  name: Parameters<GoogleMapsApi['importLibrary']>[0],
): Promise<T> {
  try {
    const api = await load();
    return (await bounded(api.importLibrary(name))) as T;
  } catch (error) {
    if (error instanceof PlacesUnavailable) throw error;
    throw new PlacesUnavailable();
  }
}

/**
 * Google Maps JavaScript + Places (New) in the browser. One autocomplete session token
 * covers the keystrokes of one search and the Place Details request that ends it, then a
 * new token starts (session pricing). `load` is injected so tests never reach Google.
 */
export function googlePlaces(
  load: () => Promise<GoogleMapsApi>,
  {
    mapId,
    onAuthFailure = () => () => undefined,
    now = Date.now,
  }: {
    mapId: string | null;
    onAuthFailure?: (listener: () => void) => () => void;
    now?: () => number;
  },
): PlacesAdapter {
  let token: object | null = null;
  let tokenStartedAt = 0;
  const predictions = new Map<string, PlacePrediction>();

  return {
    provider: 'google',
    attribution: 'Powered by Google',
    hasMap: true,

    async suggest(text, signal) {
      const places = await library<PlacesLibrary>(load, 'places');
      if (!token || now() - tokenStartedAt > SESSION_MAX_AGE_MS) {
        token = new places.AutocompleteSessionToken();
        tokenStartedAt = now();
        predictions.clear();
      }
      let response;
      try {
        response = await bounded(
          places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: text,
            sessionToken: token,
          }),
        );
      } catch (error) {
        throw error instanceof PlacesUnavailable ? error : new PlacesUnavailable();
      }
      if (signal.aborted) return [];
      predictions.clear();
      return response.suggestions.flatMap(({ placePrediction: p }): Suggestion[] => {
        if (!p) return [];
        predictions.set(p.placeId, p);
        return [
          {
            id: p.placeId,
            primary: p.mainText?.text ?? p.text.text,
            secondary: p.secondaryText?.text ?? null,
          },
        ];
      });
    },

    async select(suggestion) {
      const prediction = predictions.get(suggestion.id);
      if (!prediction) throw new PlacesUnavailable('Search again and choose a result.');
      const place = prediction.toPlace();
      try {
        await bounded(place.fetchFields({ fields: [...PLACE_FIELDS] }));
      } catch (error) {
        throw error instanceof PlacesUnavailable ? error : new PlacesUnavailable();
      } finally {
        token = null;
        predictions.clear();
      }
      return fromPlace(place);
    },

    async reverse(latitude, longitude) {
      try {
        const { Geocoder } = await library<GeocodingLibrary>(load, 'geocoding');
        const { results } = await bounded(
          new Geocoder().geocode({ location: { lat: Number(latitude), lng: Number(longitude) } }),
        );
        return results.slice(0, MAX_GEOCODE_RESULTS).map(fromGeocode);
      } catch {
        return [];
      }
    },

    async mountMap(element, { onPick, onFailure }) {
      const maps = await library<MapsLibrary>(load, 'maps');
      const markers = await library<MarkerLibrary>(load, 'marker');
      const marker = (position: { lat: number; lng: number }): (() => void) => {
        if (mapId) {
          const m = new markers.AdvancedMarkerElement({ map, position });
          return () => (m.map = null);
        }
        const m = new markers.Marker({ map, position });
        return () => m.setMap(null);
      };
      let map: MapLike;
      try {
        map = new maps.Map(element, {
          center: { lat: 20, lng: 0 },
          zoom: 2,
          mapId: mapId ?? undefined,
          clickableIcons: false,
          streetViewControl: false,
        });
      } catch {
        throw new PlacesUnavailable();
      }
      const clickListener = map.addListener('click', ({ latLng }) => {
        if (latLng) onPick(decimal(latLng.lat()), decimal(latLng.lng()));
      });
      const unsubscribe = onAuthFailure(onFailure);
      let clear: (() => void)[] = [];
      const view: MapView = {
        show({ latitude, longitude, radiusMeters }) {
          clear.forEach((remove) => remove());
          const center = { lat: Number(latitude), lng: Number(longitude) };
          clear = [marker(center)];
          if (radiusMeters) {
            const circle = new maps.Circle({ map, center, radius: radiusMeters, clickable: false });
            clear.push(() => circle.setMap(null));
          }
          map.setCenter(center);
          map.setZoom(
            radiusMeters ? Math.max(8, 15 - Math.round(Math.log2(radiusMeters / 500))) : 14,
          );
        },
        destroy() {
          unsubscribe();
          clickListener.remove();
          clear.forEach((remove) => remove());
          clear = [];
          element.replaceChildren();
        },
      };
      return view;
    },
  };
}
