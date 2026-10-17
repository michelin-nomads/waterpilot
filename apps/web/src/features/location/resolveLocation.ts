import type { LocationDraft } from './CandidateReview';
import type { Place, PlacesAdapter } from './types';
import { placeName } from './locationLabels';

/** Country boundaries are loaded only if the place provider cannot identify a country.
 * This lookup stays on-device and never substitutes a nearby town's coordinates.
 * The generalized boundaries supply regional defaults, not planning-area boundaries.
 */
async function countryAt(latitude: string, longitude: string): Promise<string | null> {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!latitude.trim() || !longitude.trim() || !Number.isFinite(lat) || !Number.isFinite(lon))
    return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const { iso1A2Code } = await import('@rapideditor/country-coder');
  return iso1A2Code([lon, lat], { level: 'territory' }) ?? null;
}

/** Resolve administrative context independently of the source of the selected point. */
export async function resolveLocation(
  adapter: Pick<PlacesAdapter, 'reverse'>,
  place: Place,
  origin: LocationDraft['origin'],
): Promise<Place | null> {
  if (origin === 'PLACE_SEARCH' && place.countryCode) return place;

  // Reverse lookup is optional enrichment: device positioning must remain usable when
  // Geocoding is unavailable even though Maps/Places are enabled on the browser key.
  const results = await adapter.reverse(place.latitude, place.longitude).catch(() => []);
  const resolved =
    results.find((result) => placeName(result) && result.countryCode) ??
    results.find((result) => result.countryCode);
  if (resolved) {
    return {
      ...place,
      name:
        origin === 'PLACE_SEARCH'
          ? place.name
          : (placeName(resolved) ?? 'Location name unavailable'),
      formattedAddress: resolved.formattedAddress ?? place.formattedAddress,
      countryCode: resolved.countryCode,
      admin: resolved.admin,
    };
  }

  const countryCode = place.countryCode ?? (await countryAt(place.latitude, place.longitude));
  if (!countryCode) return null;
  return {
    ...place,
    name:
      origin === 'PLACE_SEARCH'
        ? place.name
        : (results.map(placeName).find(Boolean) ?? placeName(place) ?? 'Location name unavailable'),
    countryCode,
    admin: {
      ...place.admin,
      countryName:
        place.admin.countryName ??
        new Intl.DisplayNames(['en'], { type: 'region' }).of(countryCode) ??
        countryCode,
    },
  };
}
