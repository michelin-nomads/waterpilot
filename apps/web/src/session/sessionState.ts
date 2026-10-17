import type {
  CommunityType,
  GoalInput,
  PlanningMode,
  QuantityInput,
  Unit,
  PlanningSessionFieldsFragment,
  PlanningStage,
  ScenarioInput,
  SessionStatus,
} from '../graphql/generated/graphql';
import { canonicalDecimal } from '../lib/format';

/** The session fields a user (or the agent) edits. */
export interface SessionInputs {
  mode: PlanningMode;
  stage: PlanningStage;
  areaId: string | null;
  goal: GoalInput | null;
  scenario: ScenarioInput | null;
  selectedPlanOptionId: string | null;
  siteProfile: SiteProfile | null;
}

/** What the person says about their community; descriptive only, never an input to results. */
export interface SiteProfile {
  communityType: CommunityType | null;
  occupiedHomes: number | null;
}

/** The authoritative planning session in the shape the UI and the coordinator use. */
export interface SessionState extends SessionInputs {
  id: string;
  version: number;
  status: SessionStatus;
  communityId: string | null;
  areaName: string | null;
  inputsRevision: number;
  updatedAt: string;
}

export type SessionField = keyof SessionInputs;
export type SessionPatch = Partial<SessionInputs>;

export const SESSION_FIELDS: readonly SessionField[] = [
  'mode',
  'stage',
  'areaId',
  'goal',
  'scenario',
  'selectedPlanOptionId',
  'siteProfile',
];

/** Inputs whose change makes plan comparisons, matches and proposal previews out of date. */
export const UPSTREAM_FIELDS: ReadonlySet<SessionField> = new Set(['areaId', 'goal', 'scenario']);

const NAVIGATION_FIELDS: ReadonlySet<SessionField> = new Set(['mode', 'stage']);

const money = (m: { minorUnits: string; currency: string } | null | undefined) =>
  m ? { minorUnits: m.minorUnits, currency: m.currency } : null;
const quantity = (q: { value: string; unit: Unit } | null | undefined) =>
  q ? { value: canonicalDecimal(q.value), unit: q.unit } : null;
const days = (d: { low: number; high: number } | null | undefined) =>
  d ? { low: d.low, high: d.high } : null;

function canonicalGoal(goal: GoalInput | null | undefined): GoalInput | null {
  if (!goal) return null;
  const site = goal.site;
  return {
    kind: goal.kind,
    description: goal.description ?? '',
    target: goal.target
      ? { mode: goal.target.mode, quantity: quantity(goal.target.quantity) as QuantityInput }
      : null,
    targetParameter: goal.targetParameter ?? null,
    budget: money(goal.budget),
    timelineDays: goal.timelineDays ?? null,
    horizonDays: goal.horizonDays ?? null,
    priority: goal.priority ?? null,
    also: [...(goal.also ?? [])],
    site: {
      scale: site?.scale ?? null,
      roofArea: quantity(site?.roofArea),
      openGround: quantity(site?.openGround),
      storageSpace: site?.storageSpace ?? null,
      pipedSupply: site?.pipedSupply ?? null,
      groundwaterUse: site?.groundwaterUse ?? null,
      restrictions: [...(site?.restrictions ?? [])],
    },
    preferredInterventions: [...(goal.preferredInterventions ?? [])],
    estimates: (goal.estimates ?? []).map((e) => ({
      interventionId: e.interventionId,
      cost: e.cost
        ? {
            low: { minorUnits: e.cost.low.minorUnits, currency: e.cost.low.currency },
            high: { minorUnits: e.cost.high.minorUnits, currency: e.cost.high.currency },
          }
        : null,
      buildDays: days(e.buildDays),
      effects: (e.effects ?? []).map((x) => ({
        key: x.key,
        low: canonicalDecimal(x.low),
        high: canonicalDecimal(x.high),
      })),
      note: e.note ?? '',
    })),
    confirmed: goal.confirmed ?? false,
  };
}

function canonicalScenario(scenario: ScenarioInput | null | undefined): ScenarioInput | null {
  if (!scenario) return null;
  return {
    adjustments: (scenario.adjustments ?? []).map((a) => ({
      parameter: a.parameter,
      change: a.change,
      quantity: { value: canonicalDecimal(a.quantity.value), unit: a.quantity.unit },
    })),
    interpretedFrom: scenario.interpretedFrom ?? null,
    confirmed: scenario.confirmed ?? false,
  };
}

/** An empty profile is no profile, so "nothing stated" has a single form. */
function canonicalSiteProfile(
  profile:
    { communityType?: CommunityType | null; occupiedHomes?: number | null } | null | undefined,
): SiteProfile | null {
  const communityType = profile?.communityType ?? null;
  const occupiedHomes = profile?.occupiedHomes ?? null;
  return communityType === null && occupiedHomes === null ? null : { communityType, occupiedHomes };
}

/** One canonical form per field, so equal inputs compare equal however they were built. */
export function canonical<F extends SessionField>(
  field: F,
  value: SessionInputs[F] | null,
): unknown {
  if (field === 'goal') return canonicalGoal(value as GoalInput | null);
  if (field === 'scenario') return canonicalScenario(value as ScenarioInput | null);
  if (field === 'siteProfile') return canonicalSiteProfile(value as SiteProfile | null);
  return value ?? null;
}

export function sameValue<F extends SessionField>(
  field: F,
  a: SessionInputs[F] | undefined,
  b: SessionInputs[F] | undefined,
): boolean {
  return (
    JSON.stringify(canonical(field, a ?? null)) === JSON.stringify(canonical(field, b ?? null))
  );
}

export function fromFragment(s: PlanningSessionFieldsFragment): SessionState {
  return {
    id: s.id,
    version: s.version,
    status: s.status,
    mode: s.mode,
    stage: s.stage,
    areaId: s.areaId ?? null,
    areaName: s.area?.name ?? null,
    communityId: s.communityId ?? null,
    goal: canonicalGoal(s.goal),
    scenario: canonicalScenario(
      s.scenario
        ? {
            adjustments: s.scenario.adjustments.map((a) => ({
              parameter: a.parameter,
              change: a.change,
              quantity: a.quantity,
            })),
            interpretedFrom: s.scenario.interpretedFrom ?? null,
            confirmed: s.scenario.confirmed,
          }
        : null,
    ),
    selectedPlanOptionId: s.selectedPlanOptionId ?? null,
    siteProfile: canonicalSiteProfile(s.siteProfile),
    inputsRevision: s.inputsRevision,
    updatedAt: s.updatedAt,
  };
}

export function isEmptyPatch(patch: SessionPatch): boolean {
  return SESSION_FIELDS.every((field) => !(field in patch));
}

/** Fields present in the patch, in a stable order. */
export function patchFields(patch: SessionPatch): SessionField[] {
  return SESSION_FIELDS.filter((field) => field in patch);
}

/**
 * The session as the user should see it: the server copy with pending edits on top. Mirrors
 * the server's dependency rules, so a pending upstream change never shows a stale choice:
 * a new location clears the scenario and plan choice; a new goal or scenario clears the plan
 * choice.
 */
export function applyPatch(server: SessionState, patch: SessionPatch): SessionState {
  const next: SessionState = { ...server };
  for (const field of patchFields(patch)) {
    if (sameValue(field, server[field], patch[field])) continue;
    Object.assign(next, { [field]: canonical(field, patch[field] ?? null) });
    if (field === 'areaId') {
      next.areaName = null;
      if (!('scenario' in patch)) next.scenario = null;
      if (!('selectedPlanOptionId' in patch)) next.selectedPlanOptionId = null;
    }
    if ((field === 'goal' || field === 'scenario') && !('selectedPlanOptionId' in patch)) {
      next.selectedPlanOptionId = null;
    }
  }
  return next;
}

/** True when a pending edit changes an upstream input, so derived results are not current. */
export function changesUpstream(server: SessionState, patch: SessionPatch): boolean {
  return patchFields(patch).some(
    (field) => UPSTREAM_FIELDS.has(field) && !sameValue(field, server[field], patch[field]),
  );
}

export interface MergeResult {
  /** Edits still to send on top of `latest` (rebased, plus conflicting ones as "mine"). */
  pending: SessionPatch;
  conflicts: SessionField[];
  /** Edits dropped because `latest` already holds them, or they no longer apply. */
  dropped: SessionField[];
  /** The plan choice was dropped because the inputs it was made for changed elsewhere. */
  selectionStale: boolean;
}

/**
 * Three-way merge of pending edits made on `base` with a newer server copy `latest`.
 * Per field: already equal → dropped (a lost response that did apply, or the same edit
 * elsewhere); unchanged on the server → rebased silently; changed on both sides → a
 * conflict the user resolves. Mode and stage are how and where the user is working, not
 * inputs, so the latest choice wins. A plan choice made for inputs that changed elsewhere
 * is dropped.
 */
export function mergeEdits(
  base: SessionState,
  latest: SessionState,
  pending: SessionPatch,
): MergeResult {
  const result: MergeResult = { pending: {}, conflicts: [], dropped: [], selectionStale: false };
  for (const field of patchFields(pending)) {
    const mine = pending[field];
    if (sameValue(field, latest[field], mine)) {
      result.dropped.push(field);
    } else if (
      field === 'selectedPlanOptionId' &&
      latest.inputsRevision !== base.inputsRevision &&
      !changesUpstream(base, pending)
    ) {
      result.dropped.push(field);
      result.selectionStale = true;
    } else if (NAVIGATION_FIELDS.has(field) || sameValue(field, latest[field], base[field])) {
      Object.assign(result.pending, { [field]: mine });
    } else {
      Object.assign(result.pending, { [field]: mine });
      result.conflicts.push(field);
    }
  }
  return result;
}
