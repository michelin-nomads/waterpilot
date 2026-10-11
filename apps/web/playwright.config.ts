import { defineConfig, devices } from '@playwright/test';

// WL_E2E_API=1 (set by `npm run test:e2e:emulator`) also starts the local API against the
// Firebase emulators. It runs in local mode only: emulator hosts are loopback and the
// project is demo-waterlens, so no real cloud service can be reached.
const withApi = process.env.WL_E2E_API === '1';

const web = {
  command: 'npm run dev',
  url: 'http://127.0.0.1:5173',
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
};

const api = {
  command:
    'cd ../../services/backend && uv run uvicorn waterlens.api.asgi:app --host 127.0.0.1 --port 8000',
  url: 'http://127.0.0.1:8000/healthz',
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
  env: {
    WL_APP_MODE: 'local',
    WL_USE_EMULATORS: 'true',
    WL_FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
    WL_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
    WL_GCP_PROJECT: 'demo-waterlens',
    WL_LOCAL_STORE: 'firestore',
  },
};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // Emulator specs reset shared accounts and sessions, so they must not overlap.
  workers: withApi ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
  },
  webServer: withApi ? [web, api] : web,
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
