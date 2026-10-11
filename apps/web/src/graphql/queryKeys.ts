/**
 * TanStack Query keys for GraphQL data (docs/api/graphql.md#query-keys).
 *
 * Keys are hierarchical so one prefix invalidates a whole family, e.g.
 * `['session', id]` covers the session, its plan options and funding matches.
 * Keys never contain the user id: the whole cache is cleared on sign-in, sign-out
 * and account linking, so cached data can never cross identities.
 */
export type Page = { first?: number; after?: string | null };

export const queryKeys = {
  viewer: () => ['viewer'] as const,

  areas: {
    search: (query: string, page: Page = {}) => ['areas', 'search', query, page] as const,
    detail: (areaId: string) => ['areas', areaId] as const,
  },

  /** Place search and reverse lookups are never cached (provider terms, ADR 0009). */
  locations: {
    countries: () => ['locations', 'countries'] as const,
    /** Derived from CLDR and timezone data on the server; not provider content. */
    region: (latitude: string, longitude: string, countryCode: string) =>
      ['locations', 'region', latitude, longitude, countryCode] as const,
  },

  readiness: {
    all: () => ['readiness'] as const,
    /** Includes the session's own manual inputs when `sessionId` is set. */
    area: (areaId: string, sessionId: string | null) => ['readiness', areaId, sessionId] as const,
  },

  sessions: {
    current: () => ['session', 'current'] as const,
    detail: (sessionId: string) => ['session', sessionId] as const,
    /**
     * Results computed from the session's location, goal and scenario. Scoped by the
     * session's `inputsRevision`, so a changed input can never show an older result; the
     * whole `derived` prefix is removed when the revision changes.
     */
    derived: (sessionId: string) => ['session', sessionId, 'derived'] as const,
    planOptions: (sessionId: string, inputsRevision: number, page: Page = {}) =>
      ['session', sessionId, 'derived', inputsRevision, 'planOptions', page] as const,
    fundingMatches: (
      sessionId: string,
      inputsRevision: number,
      planOptionId: string | null = null,
      page: Page = {},
    ) =>
      [
        'session',
        sessionId,
        'derived',
        inputsRevision,
        'fundingMatches',
        planOptionId,
        page,
      ] as const,
  },

  reports: {
    all: () => ['reports'] as const,
    list: (filter: { communityId?: string | null; status?: string | null } = {}, page: Page = {}) =>
      ['reports', 'list', filter, page] as const,
    detail: (reportId: string) => ['reports', reportId] as const,
  },

  proposals: {
    detail: (proposalId: string) => ['proposals', proposalId] as const,
  },

  communities: {
    all: () => ['communities'] as const,
    list: (filter: { areaId?: string | null; includeArchived?: boolean } = {}, page: Page = {}) =>
      ['communities', 'list', filter, page] as const,
    nearby: (
      near: { latitude: string; longitude: string; radiusMeters: number },
      page: Page = {},
    ) => ['communities', 'nearby', near, page] as const,
    detail: (communityId: string) => ['communities', communityId] as const,
    members: (communityId: string, page: Page = {}) =>
      ['communities', communityId, 'members', page] as const,
    mine: (page: Page = {}) => ['communities', 'mine', page] as const,
  },

  projects: {
    all: () => ['projects'] as const,
    mine: (page: Page = {}) => ['projects', 'mine', page] as const,
    detail: (projectId: string) => ['projects', projectId] as const,
    observations: (projectId: string, page: Page = {}) =>
      ['projects', projectId, 'observations', page] as const,
  },

  jobs: {
    detail: (jobId: string) => ['jobs', jobId] as const,
  },
} as const;
