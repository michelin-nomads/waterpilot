import { decimal } from './types';

/** A device fix worse than this is flagged; the API uses the same threshold. */
export const INACCURATE_FIX_M = 1000;
export const GEOLOCATION_TIMEOUT_MS = 15_000;

export type GeolocationOutcome =
  | {
      kind: 'fix';
      latitude: string;
      longitude: string;
      accuracyMeters: number;
      inaccurate: boolean;
    }
  | { kind: 'denied' | 'unavailable' | 'timeout' | 'unsupported' | 'insecure' };

/**
 * Ask the browser for the device position. Call only from a user action (a button
 * press): the browser shows its own permission prompt, and the result is never used
 * until the person confirms it. Never rejects; every failure is a classified outcome.
 */
export function requestDevicePosition({
  timeoutMs = GEOLOCATION_TIMEOUT_MS,
  nav = navigator,
  secure = window.isSecureContext,
} = {}): Promise<GeolocationOutcome> {
  if (!secure) return Promise.resolve({ kind: 'insecure' });
  if (!('geolocation' in nav) || !nav.geolocation) {
    return Promise.resolve({ kind: 'unsupported' });
  }
  return new Promise((resolve) => {
    nav.geolocation.getCurrentPosition(
      ({ coords }) => {
        const accuracyMeters = Math.max(1, Math.round(coords.accuracy));
        resolve({
          kind: 'fix',
          latitude: decimal(coords.latitude),
          longitude: decimal(coords.longitude),
          accuracyMeters,
          inaccurate: accuracyMeters > INACCURATE_FIX_M,
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) resolve({ kind: 'denied' });
        else if (error.code === error.TIMEOUT) resolve({ kind: 'timeout' });
        else resolve({ kind: 'unavailable' });
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}

export const GEOLOCATION_MESSAGE: Record<Exclude<GeolocationOutcome['kind'], 'fix'>, string> = {
  denied:
    'Location permission was not given, so nothing was shared. Search for the place or pick a point on the map instead. You can allow location later in your browser settings.',
  timeout:
    'Your device did not report a location in time. Try again outdoors or near a window, or search for the place instead.',
  unavailable:
    'Your device could not determine a location. Search for the place or pick a point on the map instead.',
  unsupported:
    'This browser cannot share a device location. Search for the place or pick a point on the map instead.',
  insecure:
    'Device location needs a secure (https) connection. Search for the place or pick a point on the map instead.',
};
