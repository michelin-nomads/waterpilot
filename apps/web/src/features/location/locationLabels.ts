import type {
  AreaOrigin,
  ExtentKind,
  GeographicScope,
  UnitSystem,
} from '../../graphql/generated/graphql';

export const SCOPE_LABEL: Record<GeographicScope, string> = {
  COUNTRY: 'a country',
  REGION: 'a state, province or district',
  LOCALITY: 'a city or town',
  SUBLOCALITY: 'a part of a city',
  NEIGHBOURHOOD: 'a neighbourhood name',
  POSTAL_CODE: 'a postal code',
  POINT: 'a single point or address',
};

export const ORIGIN_LABEL: Record<AreaOrigin, string> = {
  CATALOGUE: 'Reviewed WaterPilot area',
  PLACE_SEARCH: 'Place search',
  GEOLOCATION: 'Device location',
  CUSTOM: 'Selected on the map',
};

export const EXTENT_LABEL: Record<ExtentKind, string> = {
  REVIEWED_BOUNDARY: 'Reviewed boundary',
  USER_RADIUS: 'Circle you defined',
  REFERENCE_POINT: 'Reference point only (no boundary)',
};

export const UNIT_SYSTEM_LABEL: Record<UnitSystem, string> = {
  METRIC: 'Metric',
  US_CUSTOMARY: 'US customary',
};

export function formatDistance(meters: number): string {
  return meters >= 1000 ? `${Number((meters / 1000).toFixed(1))} km` : `${meters} m`;
}

const GENERIC_PLACE_NAMES = new Set([
  'Device location',
  'My device location',
  'Selected map location',
  'Unnamed place',
  'Location name unavailable',
]);

/** A device's source is separate from its geographic name. */
export function placeName(place: Pick<import('./types').Place, 'name' | 'admin'>): string | null {
  const neighbourhood = place.admin.sublocality;
  const city = place.admin.locality;
  const parts = [neighbourhood, city].filter((part): part is string => Boolean(part?.trim()));
  if (parts.length) return [...new Set(parts)].join(', ');
  return GENERIC_PLACE_NAMES.has(place.name) ? null : place.name;
}
