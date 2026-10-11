import axios, { type AxiosInstance } from 'axios';
import type { paths } from '@waterlens/contracts';

import { env } from '../config/env';

/**
 * The single shared Axios instance. All API access goes through this client so that
 * auth headers, request IDs, cancellation and retry policy live in exactly one place
 * (expanded in Phase 04/05). Do not create per-feature Axios instances.
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 15_000,
});

/** Example of consuming generated contract types (compile-time proof of wiring). */
export type HealthResponse =
  paths['/healthz']['get']['responses']['200']['content']['application/json'];
