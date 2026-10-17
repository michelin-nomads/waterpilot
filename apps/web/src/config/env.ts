import { z } from 'zod';

/**
 * Startup configuration for the web app. Validated eagerly so the app fails closed
 * on misconfiguration. Everything VITE_* is shipped to the browser, so only the
 * allowlisted PUBLIC keys below may exist; any other VITE_ variable stops startup.
 * This runtime check does not prove a secret was never bundled; the no-secrets rule
 * still applies.
 *
 * Local mode: emulators required; the API must be a loopback http(s) URL; Firebase is
 * the `demo-waterpilot` project on a loopback Auth emulator (no real Firebase project).
 * Pilot mode: emulators forbidden; an explicit, non-loopback https API URL and the
 * real project's public Firebase web config are required. The Google Maps browser key,
 * like the Firebase web key, is a public identifier: it is protected by HTTP-referrer
 * and API restrictions plus quotas in Google Cloud, not by secrecy (ADR 0009).
 */
const RawSchema = z.object({
  VITE_API_BASE_URL: z.string().optional(),
  VITE_APP_MODE: z.enum(['local', 'pilot']).default('local'),
  VITE_USE_EMULATORS: z.enum(['true', 'false']).default('true'),
  VITE_FIREBASE_API_KEY: z.string().optional(),
  VITE_FIREBASE_AUTH_DOMAIN: z.string().optional(),
  VITE_FIREBASE_PROJECT_ID: z.string().optional(),
  VITE_FIREBASE_APP_ID: z.string().optional(),
  VITE_FIREBASE_AUTH_EMULATOR_HOST: z.string().optional(),
  VITE_GOOGLE_MAPS_API_KEY: z.string().optional(),
  VITE_GOOGLE_MAPS_MAP_ID: z.string().optional(),
});

const ALLOWED_VITE_KEYS: ReadonlySet<string> = new Set(
  Object.keys(RawSchema.shape).filter((key) => key.startsWith('VITE_')),
);

const LOCAL_DEFAULT_API_BASE_URL = 'http://127.0.0.1:8000';
export const LOCAL_FIREBASE_PROJECT_ID = 'demo-waterpilot';
const LOCAL_DEFAULT_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
// The emulator accepts any API key; this one only identifies the demo project locally.
const LOCAL_FIREBASE_API_KEY = 'demo-api-key';

const FORBIDDEN_VITE_KEY = /(SECRET|PRIVATE_KEY|SERVICE_ACCOUNT|CREDENTIAL|PASSWORD)/i;

/** Public Firebase web configuration. None of these values grant access on their own. */
export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string | null;
  /** `host:port` of the Auth emulator; set in local mode only. */
  authEmulatorHost: string | null;
}

/**
 * Maps and Places in the browser (ADR 0009). `fixture`: local mode, places come from the
 * API's test gazetteer and there is no map, so nothing billable is called. `google`:
 * pilot with a browser key restricted by HTTP referrer and API. `none`: pilot without a
 * key; people type their location and no map is shown.
 */
export type MapsConfig =
  | { provider: 'google'; apiKey: string; mapId: string | null }
  | { provider: 'fixture' }
  | { provider: 'none' };

export interface AppEnv {
  apiBaseUrl: string;
  appMode: 'local' | 'pilot';
  useEmulators: boolean;
  firebase: FirebaseWebConfig;
  maps: MapsConfig;
}

const GOOGLE_BROWSER_KEY = /^AIza[0-9A-Za-z_-]{35}$/;

function pilotMaps(parsed: z.infer<typeof RawSchema>): MapsConfig {
  const apiKey = parsed.VITE_GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey) return { provider: 'none' };
  if (!GOOGLE_BROWSER_KEY.test(apiKey)) {
    fail('VITE_GOOGLE_MAPS_API_KEY is not a Google browser API key.');
  }
  return { provider: 'google', apiKey, mapId: parsed.VITE_GOOGLE_MAPS_MAP_ID?.trim() || null };
}

/** Expects a WHATWG-normalised `URL.hostname` (IPv6 in brackets, IPv4 dotted). */
export function isLoopbackHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[(.*)\]$/, '$1');
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ipv4) return Number(ipv4[1]) === 127 && ipv4.slice(1).every((o) => Number(o) <= 255);
  if (host === '::1') return true;
  const mappedIpv4 = /^::ffff:([0-9a-f]{1,4}):[0-9a-f]{1,4}$/.exec(host);
  return mappedIpv4 ? parseInt(mappedIpv4[1], 16) >> 8 === 127 : false;
}

function isUnspecifiedHostname(hostname: string): boolean {
  return hostname === '0.0.0.0' || hostname === '[::]';
}

function fail(message: string): never {
  throw new Error(`Refusing to start: ${message}`);
}

function parseApiUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    fail(`VITE_API_BASE_URL is not a valid URL: ${raw}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    fail(`VITE_API_BASE_URL must use http(s): ${raw}`);
  }
  return url;
}

function parseEmulatorHost(raw: string): string {
  let url: URL;
  try {
    url = new URL(`http://${raw}`);
  } catch {
    fail(`VITE_FIREBASE_AUTH_EMULATOR_HOST must be host:port, got ${raw}`);
  }
  if (!url.port || url.pathname !== '/' || url.username || url.search || url.hash) {
    fail(`VITE_FIREBASE_AUTH_EMULATOR_HOST must be host:port, got ${raw}`);
  }
  if (!isLoopbackHostname(url.hostname)) {
    fail(`the Auth emulator must be on a loopback host, got ${url.hostname}`);
  }
  return url.host;
}

function localFirebase(parsed: z.infer<typeof RawSchema>): FirebaseWebConfig {
  const projectId = parsed.VITE_FIREBASE_PROJECT_ID?.trim() || LOCAL_FIREBASE_PROJECT_ID;
  if (projectId !== LOCAL_FIREBASE_PROJECT_ID) {
    fail(`local mode uses the ${LOCAL_FIREBASE_PROJECT_ID} Firebase project, got ${projectId}`);
  }
  const host = parsed.VITE_FIREBASE_AUTH_EMULATOR_HOST?.trim() || LOCAL_DEFAULT_AUTH_EMULATOR_HOST;
  return {
    apiKey: parsed.VITE_FIREBASE_API_KEY?.trim() || LOCAL_FIREBASE_API_KEY,
    authDomain: parsed.VITE_FIREBASE_AUTH_DOMAIN?.trim() || `${projectId}.firebaseapp.com`,
    projectId,
    appId: parsed.VITE_FIREBASE_APP_ID?.trim() || null,
    authEmulatorHost: parseEmulatorHost(host),
  };
}

function pilotFirebase(parsed: z.infer<typeof RawSchema>): FirebaseWebConfig {
  if (parsed.VITE_FIREBASE_AUTH_EMULATOR_HOST) {
    fail('pilot mode must not set VITE_FIREBASE_AUTH_EMULATOR_HOST.');
  }
  const required = (key: keyof z.infer<typeof RawSchema>): string => {
    const value = parsed[key]?.trim();
    if (!value) fail(`pilot mode requires ${key}.`);
    return value;
  };
  const projectId = required('VITE_FIREBASE_PROJECT_ID');
  if (projectId.startsWith('demo-')) {
    fail(`pilot mode cannot use a demo- Firebase project (${projectId}).`);
  }
  return {
    apiKey: required('VITE_FIREBASE_API_KEY'),
    authDomain: required('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId,
    appId: required('VITE_FIREBASE_APP_ID'),
    authEmulatorHost: null,
  };
}

export function loadEnv(source: Record<string, unknown> = import.meta.env): AppEnv {
  for (const key of Object.keys(source)) {
    if (!key.startsWith('VITE_')) continue;
    if (FORBIDDEN_VITE_KEY.test(key)) {
      fail(`secret-like VITE_ variable exposed to the browser: ${key}`);
    }
    if (!ALLOWED_VITE_KEYS.has(key)) {
      fail(`unknown VITE_ variable ${key}; only allowlisted public keys may reach the browser.`);
    }
  }

  const parsed = RawSchema.parse(source);
  const appMode = parsed.VITE_APP_MODE;
  const useEmulators = parsed.VITE_USE_EMULATORS === 'true';
  const rawApi = parsed.VITE_API_BASE_URL?.trim() ?? '';

  if (appMode === 'local') {
    if (!useEmulators) {
      fail(
        'local mode requires emulators (VITE_USE_EMULATORS=true); it must never use real cloud services.',
      );
    }
    const api = parseApiUrl(rawApi || LOCAL_DEFAULT_API_BASE_URL);
    if (!isLoopbackHostname(api.hostname)) {
      fail(`local mode requires a loopback VITE_API_BASE_URL, got ${api.hostname}`);
    }
    if (parsed.VITE_GOOGLE_MAPS_API_KEY || parsed.VITE_GOOGLE_MAPS_MAP_ID) {
      fail('local mode never calls Google Maps; unset VITE_GOOGLE_MAPS_* (the fixture is used).');
    }
    return {
      apiBaseUrl: rawApi || LOCAL_DEFAULT_API_BASE_URL,
      appMode,
      useEmulators,
      firebase: localFirebase(parsed),
      maps: { provider: 'fixture' },
    };
  }

  if (useEmulators) {
    fail('pilot mode must not use emulators (set VITE_USE_EMULATORS=false).');
  }
  if (!rawApi) {
    fail('pilot mode requires an explicit VITE_API_BASE_URL.');
  }
  const api = parseApiUrl(rawApi);
  if (api.protocol !== 'https:') {
    fail('pilot mode requires an https VITE_API_BASE_URL.');
  }
  if (isLoopbackHostname(api.hostname) || isUnspecifiedHostname(api.hostname)) {
    fail(`pilot mode VITE_API_BASE_URL must not be a loopback/unspecified host: ${api.hostname}`);
  }
  return {
    apiBaseUrl: rawApi,
    appMode,
    useEmulators,
    firebase: pilotFirebase(parsed),
    maps: pilotMaps(parsed),
  };
}

export const env: AppEnv = loadEnv();
