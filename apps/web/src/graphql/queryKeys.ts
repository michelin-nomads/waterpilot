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
    /** The location's name and currency, for goal budgets (never converted). */
    goalArea: (areaId: string) => ['areas', areaId, 'goal'] as const,
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

  baseline: {
    all: () => ['baseline'] as const,
    /**
     * The server derives the result id from the area, the as-of date, the source snapshots
     * and the session's entered values, so this key only needs the area and session.
     */
    area: (areaId: string, sessionId: string | null) => ['baseline', areaId, sessionId] as const,
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
    /** The saved goal's feasibility; also depends on the baseline (see recordManualInput). */
    goalAssessment: (sessionId: string, inputsRevision: number) =>
      ['session', sessionId, 'derived', inputsRevision, 'goalAssessment'] as const,
    /** A draft goal checked without saving; `draft` is its canonical JSON. */
    goalCheck: (sessionId: string, inputsRevision: number, draft: string) =>
      ['session', sessionId, 'derived', inputsRevision, 'goalCheck', draft] as const,
    /**
     * Options and the scenario comparison for the session's inputs. The server also keys
     * the result by the baseline and engine versions, so a recorded value (which changes
     * the baseline without a new revision) is covered by invalidating `derived`.
     */
    planComparison: (sessionId: string, inputsRevision: number) =>
      ['session', sessionId, 'derived', inputsRevision, 'planComparison'] as const,
    scenarioComparison: (sessionId: string, inputsRevision: number) =>
      ['session', sessionId, 'derived', inputsRevision, 'scenarioComparison'] as const,
    /** A what-if checked without saving; `scenario` is its canonical JSON. */
    scenarioPreview: (sessionId: string, inputsRevision: number, scenario: string) =>
      ['session', sessionId, 'derived', inputsRevision, 'scenarioPreview', scenario] as const,
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

  goals: {
    /** Versioned and static per deployment. */
    catalogue: () => ['goals', 'catalogue'] as const,
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
    list: (
      filter: {
        areaId?: string | null;
        includeArchived?: boolean;
        archivedOnly?: boolean;
      } = {},
      page: Page = {},
    ) => ['communities', 'list', filter, page] as const,
    nearby: (
      near: { latitude: string; longitude: string; radiusMeters: number },
      page: Page = {},
    ) => ['communities', 'nearby', near, page] as const,
    memberships: (page: Page = {}) => ['communities', 'memberships', page] as const,
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

  /** Whether AI help can be offered right now; advisory, planning works regardless. */
  ai: {
    status: () => ['ai', 'status'] as const,
  },
} as const;
