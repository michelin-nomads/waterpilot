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
  PLACE_SEARCH: 'Searched place',
  GEOLOCATION: 'Your device location',
  CUSTOM: 'Entered by you',
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
