import type {
  AdjustmentChange,
  BenefitTiming,
  EffectDirection,
  EffectOrigin,
  FundingStatus,
  GroundwaterReliance,
  Linkage,
  PaybackOutcome,
  PlanComparisonStatus,
  SharedSystem,
  ScenarioPreviewInput,
  Unit,
} from '../../graphql/generated/graphql';
import {
  canonicalDecimal,
  formatDecimal,
  formatPercentFromRatio,
  shiftDecimalLeft,
  shiftDecimalRight,
} from '../../lib/format';
import type { StatusTone } from '../../lib/status';

/**
 * Display only. Values arrive exact (`ExactNumber.value`) and are rounded once here;
 * nothing formatted is ever sent back.
 */
type Exact = { value: string } | null | undefined;
type Money = { minorUnits: string; currency: string; exponent: number };

export function formatMetric(n: Exact, unit: Unit | null | undefined): string {
  if (!n) return 'Not known';
  if (unit === 'RATIO') return formatPercentFromRatio(n.value, 1);
  if (unit === 'DAY') return `${formatDecimal(n.value, 0)} days`;
  if (unit === 'LITRES_PER_DAY') return formatLitres(n);
  if (unit === 'MILLIMETRE') return `${formatDecimal(n.value, 0)} mm`;
  return formatDecimal(n.value, 2);
}

/** A change in the metric, signed; ratios as percentage points. */
export function formatChange(n: Exact, unit: Unit | null | undefined): string {
  if (!n) return 'Not known';
  const negative = n.value.startsWith('-');
  const abs = negative ? n.value.slice(1) : n.value;
  const sign = negative ? '−' : /[1-9]/.test(abs) ? '+' : '';
  if (unit === 'RATIO') {
    const points = formatDecimal(shiftDecimalRight(abs, 2), 1);
    return `${sign}${points} percentage points`;
  }
  return `${sign}${formatMetric({ value: abs }, unit)}`;
}

export function formatLitres(n: Exact): string {
  return n ? `${formatDecimal(n.value, 0)} L/day` : 'Not known';
}

export function formatRange(low: Exact, high: Exact, unit: Unit): string {
  if (!low || !high) return 'Not known';
  const a = formatMetric(low, unit);
  const b = formatMetric(high, unit);
  return a === b ? a : `${a} to ${b}`;
}

export function formatMoney(m: Money): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: m.currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: m.exponent,
  }).format(shiftDecimalLeft(m.minorUnits, m.exponent) as Intl.StringNumericLiteral);
}

export function formatMoneyRange(r: { low: Money; high: Money } | null | undefined): string {
  if (!r) return 'Not estimated for every measure';
  const a = formatMoney(r.low);
  const b = formatMoney(r.high);
  return a === b ? a : `${a} to ${b}`;
}

export function formatDays(r: { low: number; high: number } | null | undefined): string {
  if (!r) return 'Not estimated for every measure';
  return r.low === r.high ? `${r.low} days` : `${r.low} to ${r.high} days`;
}

export const TIMING_LABEL: Record<BenefitTiming, string> = {
  AFTER_COMMISSIONING: 'Once built',
  AFTER_RAINFALL: 'After the next rain',
  AFTER_WET_SEASONS: 'After one or more wet seasons',
};

// --------------------------------------------------------------------------- economics

export const PAYBACK_LABEL: Record<PaybackOutcome, { label: string; tone: StatusTone }> = {
  WITHIN_HORIZON: { label: 'Pays back within the horizon', tone: 'success' },
  BEYOND_HORIZON: { label: 'Pays back after the horizon', tone: 'warning' },
  UNCERTAIN: { label: 'Payback not assured', tone: 'warning' },
  NEVER: { label: 'No payback', tone: 'neutral' },
};

export const FUNDING_STATUS_LABEL: Record<FundingStatus, string> = {
  APPROVED: 'Approved',
  EXPECTED: 'Expected',
  PROPOSED: 'Proposed',
};

/** A payback period in days as whole years and days; display only, never recalculated. */
export function formatPayback(days: number | null | undefined): string {
  if (days === null || days === undefined) return 'No payback';
  if (days < 365) return `${days} day${days === 1 ? '' : 's'}`;
  const years = Math.floor(days / 365);
  const rest = days % 365;
  const y = `${years} year${years === 1 ? '' : 's'}`;
  return rest === 0 ? y : `${y}, ${rest} day${rest === 1 ? '' : 's'}`;
}

export function formatPaybackRange(
  optimisticDays: number | null | undefined,
  pessimisticDays: number | null | undefined,
): string {
  const best = formatPayback(optimisticDays);
  if (pessimisticDays === null || pessimisticDays === undefined) {
    return optimisticDays === null || optimisticDays === undefined
      ? 'No payback'
      : `${best} at best`;
  }
  const worst = formatPayback(pessimisticDays);
  return best === worst ? best : `${best} to ${worst}`;
}

export function formatPercentFromDecimal(ratio: string): string {
  return `${formatDecimal(shiftDecimalRight(ratio, 2), 0)}%`;
}

export const STATUS: Record<PlanComparisonStatus, { label: string; tone: StatusTone }> = {
  OPTIONS: { label: 'Feasible plans found', tone: 'success' },
  NO_FEASIBLE_PLAN: { label: 'No feasible plan', tone: 'warning' },
  NEEDS_INPUT: { label: 'More input needed', tone: 'info' },
  TARGET_ALREADY_MET: { label: 'Target already met', tone: 'success' },
  NOT_SUPPORTED: { label: 'Not compared yet', tone: 'neutral' },
};

export const ORIGIN_LABEL: Record<EffectOrigin, string> = {
  USER_ESTIMATE: 'your estimate',
  BASELINE: 'sourced baseline value',
  SCENARIO: 'set by the what-if',
};

// --------------------------------------------------------------------------- wider impact

export const SYSTEM_LABEL: Record<SharedSystem, string> = {
  AQUIFER: 'Aquifer',
  CATCHMENT: 'Catchment',
  SUPPLY_NETWORK: 'Supply network',
};

export const DIRECTION_LABEL: Record<EffectDirection, string> = {
  POSSIBLE_BENEFIT: 'Possible benefit',
  POSSIBLE_HARM: 'Possible harm',
  EITHER: 'Could go either way',
};

/** Unknown says so: nearness is never shown as a connection. */
export const LINKAGE_LABEL: Record<Linkage, string> = {
  LINKED: 'Shared (on record)',
  NOT_LINKED: 'Separate (on record)',
  UNKNOWN: 'Connection unknown',
};

export const RELIANCE_LABEL: Record<GroundwaterReliance, string> = {
  SOURCED: 'Groundwater pumping is recorded in the baseline evidence.',
  DECLARED: 'You said the site uses a borewell or other groundwater.',
  NONE_RECORDED: 'You said the site does not use groundwater.',
  UNKNOWN: 'Not known whether the site uses groundwater.',
};

const READING_UNIT: Partial<Record<Unit, string>> = {
  MG_PER_LITRE: 'mg/L',
  NTU: 'NTU',
  MICROSIEMENS_PER_CM: 'µS/cm',
  PH: '',
  CFU_PER_100ML: 'CFU/100 mL',
};

/** A reading with its parameter, method and date; never a verdict on drinkability. */
export function formatReading(q: {
  parameter?: string | null;
  value: { value: string };
  unit: Unit;
  observedOn?: string | null;
  method?: string | null;
}): string {
  const unit = READING_UNIT[q.unit] ?? q.unit.toLowerCase();
  const parameter = q.parameter ? q.parameter.replace(/_/g, ' ') : 'Parameter not recorded';
  const method = q.method ? q.method.replace(/_/g, ' ') : 'method not recorded';
  const when = q.observedOn ?? 'date not recorded';
  return `${parameter}: ${formatDecimal(q.value.value, 2)}${unit ? ` ${unit}` : ''} (${method}, ${when})`;
}

// --------------------------------------------------------------------------- what-if

export type Parameter = 'demand' | 'piped_supply' | 'rainfall';
export type ChangeChoice = '' | AdjustmentChange;

export interface WhatIfRow {
  change: ChangeChoice;
  /** A percentage for INCREASE_BY / DECREASE_BY; the value in the unit for SET_TO. */
  value: string;
}

export type WhatIfDraft = Record<Parameter, WhatIfRow>;

export const PARAMETERS: readonly {
  id: Parameter;
  label: string;
  unit: Unit;
  unitLabel: string;
}[] = [
  { id: 'demand', label: 'Water demand', unit: 'LITRES_PER_DAY', unitLabel: 'L/day' },
  {
    id: 'piped_supply',
    label: 'Supply other than tankers',
    unit: 'LITRES_PER_DAY',
    unitLabel: 'L/day',
  },
  { id: 'rainfall', label: 'Rainfall in a year', unit: 'MILLIMETRE', unitLabel: 'mm' },
];

export const CHANGE_LABEL: Record<AdjustmentChange, string> = {
  INCREASE_BY: 'Increase by (%)',
  DECREASE_BY: 'Decrease by (%)',
  SET_TO: 'Set to',
};

const DECIMAL = /^(0|[1-9]\d*)(\.\d+)?$/;

export function emptyWhatIf(): WhatIfDraft {
  return {
    demand: { change: '', value: '' },
    piped_supply: { change: '', value: '' },
    rainfall: { change: '', value: '' },
  };
}

type Adjustments = ScenarioPreviewInput['adjustments'];

/** Canonical adjustments from the draft, or the rows that need attention. */
export function toAdjustments(draft: WhatIfDraft): {
  adjustments: NonNullable<Adjustments> | null;
  errors: Partial<Record<Parameter, string>>;
} {
  const adjustments: NonNullable<Adjustments> = [];
  const errors: Partial<Record<Parameter, string>> = {};
  for (const p of PARAMETERS) {
    const row = draft[p.id];
    if (!row.change) continue;
    const v = row.value.trim();
    if (!DECIMAL.test(v)) {
      errors[p.id] = 'Enter a number without commas, units or the % sign.';
      continue;
    }
    if (row.change === 'SET_TO') {
      adjustments.push({
        parameter: p.id,
        change: row.change,
        quantity: { value: canonicalDecimal(v), unit: p.unit },
      });
      continue;
    }
    if (Number(v) === 0 || Number(v) > 100) {
      errors[p.id] = 'Enter a percentage above 0 and at most 100.';
      continue;
    }
    adjustments.push({
      parameter: p.id,
      change: row.change,
      quantity: { value: shiftDecimalLeft(v, 2), unit: 'RATIO' },
    });
  }
  return Object.keys(errors).length ? { adjustments: null, errors } : { adjustments, errors };
}

/** The draft for saved adjustments, in the units the person typed them in. */
export function fromAdjustments(
  adjustments: readonly {
    parameter: string;
    change: AdjustmentChange;
    quantity: { value: string };
  }[],
): WhatIfDraft {
  const draft = emptyWhatIf();
  for (const a of adjustments) {
    if (!(a.parameter in draft)) continue;
    draft[a.parameter as Parameter] = {
      change: a.change,
      value: a.change === 'SET_TO' ? a.quantity.value : shiftDecimalRight(a.quantity.value, 2),
    };
  }
  return draft;
}

/** Server field paths ("scenario.adjustments.1.quantity.value") to the row they concern. */
export function rowOf(
  field: string,
  adjustments: readonly { parameter: string }[],
): Parameter | null {
  const match = /adjustments\.(\d+)/.exec(field);
  const parameter = match ? adjustments[Number(match[1])]?.parameter : null;
  return parameter && PARAMETERS.some((p) => p.id === parameter) ? (parameter as Parameter) : null;
}
