import type {
  GeographicScope,
  PlaceCandidateFieldsFragment,
} from '../../graphql/generated/graphql';

/** A provider place, normalized the same way as the API's `PlaceCandidate`. */
export type Place = PlaceCandidateFieldsFragment;

/** Local test gazetteer entries: never real place data, and refused by the pilot API. */
export function isFixturePlace(place: Pick<Place, 'placeId'>): boolean {
  return place.placeId.startsWith('fixture:');
}

/** One autocomplete row. `place` is present when the provider already returned it. */
export interface Suggestion {
  id: string;
  primary: string;
  secondary: string | null;
  place?: Place;
}

export class PlacesUnavailable extends Error {
  constructor(message = 'Place search is unavailable right now.') {
    super(message);
    this.name = 'PlacesUnavailable';
  }
}

export interface MapView {
  /** Centre on a point; draws the radius circle when `radiusMeters` is set. */
  show(point: { latitude: string; longitude: string; radiusMeters?: number | null }): void;
  destroy(): void;
}

export interface MapOptions {
  /** A click picks a custom point; it is never confirmed without review. */
  onPick: (latitude: string, longitude: string) => void;
  /** The provider rejected the map after it loaded (for example a key restriction). */
  onFailure: () => void;
}

/**
 * How the location step reaches a place provider. Components depend on this interface
 * only, so tests inject a fake and never call Google (ADR 0009).
 */
export interface PlacesAdapter {
  readonly provider: 'google' | 'fixture' | 'server';
  /** Attribution shown beside results, as the provider's terms require. */
  readonly attribution: string;
  readonly hasMap: boolean;
  /** Suggestions for the current search session. Resolves `[]` when `signal` aborts. */
  suggest(text: string, signal: AbortSignal): Promise<Suggestion[]>;
  /** Fetch the chosen place's minimal fields and end the search session. */
  select(suggestion: Suggestion): Promise<Place>;
  /** Named places near a device fix, nearest first; `[]` when none or unavailable. */
  reverse(latitude: string, longitude: string): Promise<Place[]>;
  /** Rejects with {@link PlacesUnavailable} on outage, bad key or timeout. */
  mountMap(element: HTMLElement, options: MapOptions): Promise<MapView>;
}

const SCOPE_BY_TYPE: readonly [string, GeographicScope][] = [
  ['country', 'COUNTRY'],
  ['administrative_area_level_1', 'REGION'],
  ['administrative_area_level_2', 'REGION'],
  ['administrative_area_level_3', 'REGION'],
  ['locality', 'LOCALITY'],
  ['postal_town', 'LOCALITY'],
  ['sublocality', 'SUBLOCALITY'],
  ['sublocality_level_1', 'SUBLOCALITY'],
  ['neighborhood', 'NEIGHBOURHOOD'],
  ['postal_code', 'POSTAL_CODE'],
];

/** Mirrors the API's `scope_from_types`: the broadest administrative kind, else a point. */
export function scopeFromTypes(types: readonly string[]): GeographicScope {
  const present = new Set(types);
  return SCOPE_BY_TYPE.find(([type]) => present.has(type))?.[1] ?? 'POINT';
}

/** Coordinates as the API's DecimalString: at most 7 decimal places, no exponent. */
export function decimal(value: number): string {
  return String(Number(value.toFixed(7)));
}

export interface AddressPart {
  short: string;
  long: string;
  types: readonly string[];
}

/** Country code and administrative context from provider address components. */
export function adminFrom(parts: readonly AddressPart[]): {
  countryCode: string | null;
  admin: Place['admin'];
} {
  const find = (...types: string[]) => parts.find((p) => types.some((t) => p.types.includes(t)));
  const country = find('country');
  const code = country?.short.toUpperCase() ?? null;
  return {
    countryCode: code && /^[A-Z]{2}$/.test(code) ? code : null,
    admin: {
      countryName: country?.long ?? null,
      admin1: find('administrative_area_level_1')?.long ?? null,
      admin2: find('administrative_area_level_2')?.long ?? null,
      locality: find('locality', 'postal_town')?.long ?? null,
      sublocality: find('sublocality', 'sublocality_level_1', 'neighborhood')?.long ?? null,
    },
  };
}
