import { PlacesUnavailable } from './types';

/** The few `google.maps` members WaterPilot uses; kept local so no global typings ship. */
export interface GoogleMapsApi {
  importLibrary(name: 'places' | 'geocoding' | 'maps' | 'marker'): Promise<unknown>;
}

type MapsWindow = Window & {
  google?: { maps?: GoogleMapsApi };
  gm_authFailure?: () => void;
  __waterpilotMapsReady?: () => void;
};

const SCRIPT_URL = 'https://maps.googleapis.com/maps/api/js';
export const LOAD_TIMEOUT_MS = 10_000;

let loading: Promise<GoogleMapsApi> | null = null;
let authFailed = false;
const authListeners = new Set<() => void>();

/** Called when Google rejects the key (wrong referrer, API not enabled, billing off). */
export function onAuthFailure(listener: () => void): () => void {
  if (authFailed) listener();
  authListeners.add(listener);
  return () => authListeners.delete(listener);
}

/**
 * Load the Maps JavaScript API once, on first use (never at app start). Rejects with
 * {@link PlacesUnavailable} on a network error, timeout or rejected key, so the location
 * step falls back to search, device location or typed coordinates.
 */
export function loadGoogleMaps(
  apiKey: string,
  { timeoutMs = LOAD_TIMEOUT_MS, win = window as MapsWindow } = {},
): Promise<GoogleMapsApi> {
  if (authFailed) return Promise.reject(new PlacesUnavailable('The map key was rejected.'));
  if (loading) return loading;
  loading = new Promise<GoogleMapsApi>((resolve, reject) => {
    const doc = win.document;
    const script = doc.createElement('script');
    const fail = (message: string) => {
      win.clearTimeout(timer);
      loading = null;
      script.remove();
      reject(new PlacesUnavailable(message));
    };
    const timer = win.setTimeout(() => fail('The map took too long to load.'), timeoutMs);
    win.gm_authFailure = () => {
      authFailed = true;
      authListeners.forEach((listener) => listener());
      fail('The map key was rejected.');
    };
    win.__waterpilotMapsReady = () => {
      win.clearTimeout(timer);
      const api = win.google?.maps;
      if (api?.importLibrary) resolve(api);
      else fail('The map library did not initialise.');
    };
    const params = new URLSearchParams({
      key: apiKey,
      v: 'weekly',
      loading: 'async',
      callback: '__waterpilotMapsReady',
    });
    script.src = `${SCRIPT_URL}?${params.toString()}`;
    script.async = true;
    script.onerror = () => fail('The map could not be reached.');
    doc.head.append(script);
  });
  return loading;
}

/** Test hook: forget a previous load or key failure. */
export function resetGoogleMapsLoader(): void {
  loading = null;
  authFailed = false;
  authListeners.clear();
}
