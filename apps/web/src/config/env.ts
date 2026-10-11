import { z } from 'zod';

/**
 * Startup configuration for the web app. Validated eagerly so the app fails closed
 * on misconfiguration. Only PUBLIC values are read; secret-like VITE_ variables are
 * rejected because everything VITE_* is shipped to the browser.
 */
const RawSchema = z.object({
  VITE_API_BASE_URL: z.string().url().default('http://127.0.0.1:8000'),
  VITE_APP_MODE: z.enum(['local', 'pilot']).default('local'),
  VITE_USE_EMULATORS: z.enum(['true', 'false']).default('true'),
});

const FORBIDDEN_VITE_KEY = /(SECRET|PRIVATE_KEY|SERVICE_ACCOUNT|CREDENTIAL|PASSWORD)/i;

export interface AppEnv {
  apiBaseUrl: string;
  appMode: 'local' | 'pilot';
  useEmulators: boolean;
}

export function loadEnv(source: Record<string, unknown> = import.meta.env): AppEnv {
  for (const key of Object.keys(source)) {
    if (key.startsWith('VITE_') && FORBIDDEN_VITE_KEY.test(key)) {
      throw new Error(
        `Refusing to start: secret-like VITE_ variable exposed to the browser: ${key}`,
      );
    }
  }

  const parsed = RawSchema.parse(source);
  const env: AppEnv = {
    apiBaseUrl: parsed.VITE_API_BASE_URL,
    appMode: parsed.VITE_APP_MODE,
    useEmulators: parsed.VITE_USE_EMULATORS === 'true',
  };

  if (env.appMode === 'pilot' && env.useEmulators) {
    throw new Error(
      'Refusing to start: pilot mode must not use emulators (set VITE_USE_EMULATORS=false).',
    );
  }

  return env;
}

export const env: AppEnv = loadEnv();
