import { isLoopbackHostname, loadEnv } from './env';

const LOCAL = {
  VITE_APP_MODE: 'local',
  VITE_USE_EMULATORS: 'true',
  VITE_API_BASE_URL: 'http://127.0.0.1:8000',
};

const PILOT_FIREBASE = {
  VITE_FIREBASE_API_KEY: 'public-web-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'waterpilot-pilot.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'waterpilot-pilot',
  VITE_FIREBASE_APP_ID: '1:123:web:abc',
};

const PILOT = {
  VITE_APP_MODE: 'pilot',
  VITE_USE_EMULATORS: 'false',
  VITE_API_BASE_URL: 'https://api.waterpilot.example.org',
  ...PILOT_FIREBASE,
};

const LOCAL_FIREBASE = {
  apiKey: 'demo-api-key',
  authDomain: 'demo-waterpilot.firebaseapp.com',
  projectId: 'demo-waterpilot',
  appId: null,
  authEmulatorHost: '127.0.0.1:9099',
};

describe('loadEnv — local mode', () => {
  it('accepts the documented local defaults', () => {
    expect(loadEnv({})).toEqual({
      apiBaseUrl: 'http://127.0.0.1:8000',
      appMode: 'local',
      useEmulators: true,
      firebase: LOCAL_FIREBASE,
      maps: { provider: 'fixture' },
    });
  });

  it.each(['http://localhost:8000', 'http://[::1]:8000', 'http://127.0.0.2:8000'])(
    'accepts loopback API %s',
    (url) => {
      expect(loadEnv({ ...LOCAL, VITE_API_BASE_URL: url }).apiBaseUrl).toBe(url);
    },
  );

  it('rejects local mode with emulators disabled', () => {
    expect(() => loadEnv({ ...LOCAL, VITE_USE_EMULATORS: 'false' })).toThrow(
      /local mode requires emulators/i,
    );
  });

  it.each([
    'https://api.waterpilot.example.org',
    'http://10.0.0.5:8000',
    'http://127.0.0.1.evil.example:8000',
    'http://localhost.evil.example',
    'http://0.0.0.0:8000',
  ])('rejects non-loopback local API %s', (url) => {
    expect(() => loadEnv({ ...LOCAL, VITE_API_BASE_URL: url })).toThrow(/loopback/i);
  });
});

describe('loadEnv — pilot mode', () => {
  it('accepts an explicit public https API', () => {
    expect(loadEnv(PILOT)).toEqual({
      apiBaseUrl: 'https://api.waterpilot.example.org',
      appMode: 'pilot',
      useEmulators: false,
      firebase: {
        apiKey: 'public-web-key',
        authDomain: 'waterpilot-pilot.firebaseapp.com',
        projectId: 'waterpilot-pilot',
        appId: '1:123:web:abc',
        authEmulatorHost: null,
      },
      maps: { provider: 'none' },
    });
  });

  it('rejects pilot mode using emulators', () => {
    expect(() => loadEnv({ ...PILOT, VITE_USE_EMULATORS: 'true' })).toThrow(/emulators/i);
  });

  it('rejects pilot mode with emulators left at the local default', () => {
    expect(() =>
      loadEnv({ VITE_APP_MODE: 'pilot', VITE_API_BASE_URL: PILOT.VITE_API_BASE_URL }),
    ).toThrow(/emulators/i);
  });

  it('rejects pilot mode with no API URL (no silent loopback default)', () => {
    expect(() => loadEnv({ VITE_APP_MODE: 'pilot', VITE_USE_EMULATORS: 'false' })).toThrow(
      /VITE_API_BASE_URL/,
    );
  });

  it.each([
    'http://api.waterpilot.example.org',
    'https://127.0.0.1:8000',
    'https://localhost',
    'https://app.localhost',
    'https://[::1]',
    'https://[::ffff:127.0.0.1]',
    'https://2130706433',
    'https://0.0.0.0',
  ])('rejects http or loopback pilot API %s', (url) => {
    expect(() => loadEnv({ ...PILOT, VITE_API_BASE_URL: url })).toThrow(/VITE_API_BASE_URL/);
  });
});

describe('loadEnv — Firebase', () => {
  it.each(['127.0.0.1:9199', 'localhost:9099', '[::1]:9099'])(
    'accepts a loopback emulator host %s locally',
    (host) => {
      const { firebase } = loadEnv({ ...LOCAL, VITE_FIREBASE_AUTH_EMULATOR_HOST: host });
      expect(firebase.authEmulatorHost).toBe(host);
    },
  );

  it.each(['10.0.0.5:9099', 'emulator.example.org:9099'])(
    'rejects a non-loopback emulator host %s',
    (host) => {
      expect(() => loadEnv({ ...LOCAL, VITE_FIREBASE_AUTH_EMULATOR_HOST: host })).toThrow(
        /loopback/,
      );
    },
  );

  it.each(['127.0.0.1', 'http://127.0.0.1:9099', '127.0.0.1:9099/path'])(
    'rejects a malformed emulator host %s',
    (host) => {
      expect(() => loadEnv({ ...LOCAL, VITE_FIREBASE_AUTH_EMULATOR_HOST: host })).toThrow(
        /host:port/,
      );
    },
  );

  it('keeps local mode on the demo project', () => {
    expect(() => loadEnv({ ...LOCAL, VITE_FIREBASE_PROJECT_ID: 'waterpilot-pilot' })).toThrow(
      /demo-waterpilot/,
    );
  });

  it.each(Object.keys(PILOT_FIREBASE))('requires %s in pilot mode', (key) => {
    expect(() => loadEnv({ ...PILOT, [key]: '' })).toThrow(new RegExp(key));
  });

  it('rejects an emulator host in pilot mode', () => {
    expect(() => loadEnv({ ...PILOT, VITE_FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099' })).toThrow(
      /must not set VITE_FIREBASE_AUTH_EMULATOR_HOST/,
    );
  });

  it('rejects a demo project in pilot mode', () => {
    expect(() => loadEnv({ ...PILOT, VITE_FIREBASE_PROJECT_ID: 'demo-waterpilot' })).toThrow(
      /demo-/,
    );
  });
});

describe('loadEnv — general', () => {
  it('rejects VITE_ variables outside the public allowlist', () => {
    expect(() => loadEnv({ ...LOCAL, VITE_FIREBASE_MEASUREMENT_ID: 'G-1' })).toThrow(
      /unknown VITE_ variable VITE_FIREBASE_MEASUREMENT_ID/,
    );
  });

  it('ignores non-VITE build variables', () => {
    expect(() => loadEnv({ ...LOCAL, MODE: 'test', DEV: true, BASE_URL: '/' })).not.toThrow();
  });

  it('rejects secret-like VITE_ names', () => {
    expect(() => loadEnv({ ...LOCAL, VITE_SERVICE_ACCOUNT_JSON: '{}' })).toThrow(/secret-like/);
  });

  it.each(['ftp://127.0.0.1', 'not a url'])('rejects malformed API URL %s', (url) => {
    expect(() => loadEnv({ ...LOCAL, VITE_API_BASE_URL: url })).toThrow();
  });

  it('rejects unknown modes', () => {
    expect(() => loadEnv({ ...LOCAL, VITE_APP_MODE: 'prod' })).toThrow();
  });
});

describe('isLoopbackHostname', () => {
  it.each([
    ['localhost', true],
    ['app.localhost', true],
    ['127.0.0.1', true],
    ['127.255.0.9', true],
    ['[::1]', true],
    ['[::ffff:7f00:1]', true],
    ['128.0.0.1', false],
    ['[::2]', false],
    ['example.com', false],
    ['127.0.0.1.nip.io', false],
  ])('%s -> %s', (host, expected) => {
    expect(isLoopbackHostname(host)).toBe(expected);
  });
});

describe('loadEnv — maps', () => {
  const KEY = `AIza${'a'.repeat(35)}`;

  it('uses the fixture locally and refuses a Google key there', () => {
    expect(loadEnv(LOCAL).maps).toEqual({ provider: 'fixture' });
    expect(() => loadEnv({ ...LOCAL, VITE_GOOGLE_MAPS_API_KEY: KEY })).toThrow(
      /local mode never calls Google Maps/,
    );
    expect(() => loadEnv({ ...LOCAL, VITE_GOOGLE_MAPS_MAP_ID: 'abc' })).toThrow(/Google Maps/);
  });

  it('opts into browser Maps locally while retaining emulator and API guards', () => {
    const live = {
      ...LOCAL,
      VITE_LOCAL_GOOGLE_MAPS_ENABLED: 'true',
      VITE_GOOGLE_MAPS_API_KEY: KEY,
      VITE_GOOGLE_MAPS_MAP_ID: 'test-map',
    };
    const configured = loadEnv(live);
    expect(configured.maps).toEqual({ provider: 'google', apiKey: KEY, mapId: 'test-map' });
    expect(configured.useEmulators).toBe(true);
    expect(configured.firebase.projectId).toBe('demo-waterlens');
    expect(() => loadEnv({ ...live, VITE_USE_EMULATORS: 'false' })).toThrow(/requires emulators/);
    expect(() => loadEnv({ ...live, VITE_API_BASE_URL: 'https://api.example.com' })).toThrow(
      /loopback/,
    );
    expect(() => loadEnv({ ...LOCAL, VITE_LOCAL_GOOGLE_MAPS_ENABLED: 'true' })).toThrow(
      /requires a browser Maps key/,
    );
    expect(() => loadEnv({ ...PILOT, VITE_LOCAL_GOOGLE_MAPS_ENABLED: 'true' })).toThrow(
      /local-only/,
    );
  });

  it('uses Google in pilot only with a well-formed browser key', () => {
    expect(loadEnv(PILOT).maps).toEqual({ provider: 'none' });
    expect(loadEnv({ ...PILOT, VITE_GOOGLE_MAPS_API_KEY: KEY }).maps).toEqual({
      provider: 'google',
      apiKey: KEY,
      mapId: null,
    });
    expect(() => loadEnv({ ...PILOT, VITE_GOOGLE_MAPS_API_KEY: 'not-a-key' })).toThrow(
      /not a Google browser API key/,
    );
  });
});
