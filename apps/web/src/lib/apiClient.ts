import axios, { type AxiosInstance } from 'axios';
import type { paths } from '@waterlens/contracts';

import { env } from '../config/env';
import { getAuthToken } from './authToken';

/**
 * The single shared Axios instance. All API access goes through this client so that
 * auth headers, request IDs, cancellation and retry policy live in exactly one place.
 * Do not create per-feature Axios instances.
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 15_000,
});

export { getAuthToken, setAuthTokenProvider, type AuthTokenProvider } from './authToken';

apiClient.interceptors.request.use(async (config) => {
  if (config.headers.has('Authorization')) return config;
  const token = await getAuthToken();
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});

/** Example of consuming generated contract types (compile-time proof of wiring). */
export type HealthResponse =
  paths['/healthz']['get']['responses']['200']['content']['application/json'];
