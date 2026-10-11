import type {
  GoalInput,
  GoalKind,
  Priority,
  SiteRestriction,
  SiteScale,
  TargetMode,
  Unit,
} from '../../graphql/generated/graphql';
import { canonicalDecimal, shiftDecimalLeft, shiftDecimalRight } from '../../lib/format';

/**
 * The Goal form's working copy. Fields hold exactly what the person typed; `toGoalInput`
 * turns them into canonical values (ratio as a decimal string, money as integer minor
 * units, areas in m2), so what is stored never depends on how it was displayed.
 */
/** One effect range as typed: shares (unit RATIO) as percentages, anything else as is. */
export interface EffectDraft {
  key: string;
  unit: Unit;
  low: string;
  high: string;
}

export interface EstimateDraft {
  interventionId: string;
  costLow: string;
  costHigh: string;
  buildLow: string;
  buildHigh: string;
  effects: EffectDraft[];
  note: string;
}

/** Catalogue units of each measure's effect inputs, by `${interventionId}.${key}`. */
export type EffectUnits = Readonly<Record<string, Unit>>;

export type YesNo = 'yes' | 'no' | '';

export interface GoalDraft {
  kind: GoalKind | null;
  description: string;
  confirmed: boolean;
  /** null: no numeric target. */
  mode: TargetMode | null;
  /** A percentage for ratio targets; otherwise the value in `unit`. */
  targetValue: string;
  unit: Unit | null;
  targetParameter: string;
  budgetAmount: string;
  currency: string;
  timelineDays: string;
  horizonDays: string;
  priority: Priority | '';
  also: GoalKind[];
  scale: SiteScale | '';
  roofArea: string;
  openGround: string;
  storageSpace: YesNo;
  pipedSupply: YesNo;
  groundwaterUse: YesNo;
  restrictions: SiteRestriction[];
  preferred: string[];
  estimates: EstimateDraft[];
}

export type DraftField = keyof GoalDraft | `estimates.${number}.${keyof EstimateDraft}`;

/** Error key for a measure's effect ranges (one message under the group). */
export const effectsField = (i: number) => `estimates.${i}.effects`;
export type DraftErrors = Partial<Record<string, string>>;

const DECIMAL = /^(0|[1-9]\d*)(\.\d+)?$/;
const SIGNED_DECIMAL = /^-?(0|[1-9]\d*)(\.\d+)?$/;
const WHOLE = /^(0|[1-9]\d*)$/;

/** ISO 4217 minor-unit digits from the platform's CLDR data; no table to maintain. */
export function currencyExponent(currency: string): number | null {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits as number;
  } catch {
    return null;
  }
}

export function emptyDraft(currency: string): GoalDraft {
  return {
    kind: null,
    description: '',
    confirmed: false,
    mode: null,
    targetValue: '',
    unit: null,
    targetParameter: '',
    budgetAmount: '',
    currency,
    timelineDays: '',
    horizonDays: '',
    priority: '',
    also: [],
    scale: '',
    roofArea: '',
    openGround: '',
    storageSpace: '',
    pipedSupply: '',
    groundwaterUse: '',
    restrictions: [],
    preferred: [],
    estimates: [],
  };
}

export interface Preset {
  id: string;
  title: string;
  description: string;
  apply: (draft: GoalDraft) => GoalDraft;
}

/** Editable starting points; none carries a cost or a place-specific number. */
export const PRESETS: readonly Preset[] = [
  {
    id: 'tanker',
    title: 'Reduce tanker dependence by 30% within 12 months',
    description: 'Rely less on tanker water. Compared with your baseline share.',
    apply: (d) => ({
      ...d,
      kind: 'REDUCE_TANKER_DEPENDENCE',
      mode: 'RELATIVE_REDUCTION',
      targetValue: '30',
      unit: 'RATIO',
      timelineDays: '365',
    }),
  },
  {
    id: 'shortage',
    title: 'Fewer than 15 water-shortage days a year',
    description: 'Days when supply falls below demand. Needs a full year of daily records.',
    apply: (d) => ({
      ...d,
      kind: 'REDUCE_SHORTAGE',
      mode: 'ABSOLUTE_LEVEL',
      targetValue: '15',
      unit: 'DAY',
    }),
  },
  {
    id: 'groundwater',
    title: 'Raise the groundwater level',
    description: 'Recharge the ground. You can set a level in metres below ground.',
    apply: (d) => ({ ...d, kind: 'IMPROVE_GROUNDWATER', mode: null, unit: null }),
  },
  {
    id: 'bills',
    title: 'Reduce water bills by 20%',
    description: 'Use and lose less water. WaterLens has no record of your bills.',
    apply: (d) => ({
      ...d,
      kind: 'REDUCE_WATER_BILLS',
      mode: 'RELATIVE_REDUCTION',
      targetValue: '20',
      unit: 'RATIO',
    }),
  },
  {
    id: 'flooding',
    title: 'Reduce local flooding',
    description: 'Slow and soak up storm water.',
    apply: (d) => ({ ...d, kind: 'REDUCE_FLOOD_RISK', mode: null, unit: null }),
  },
  {
    id: 'quality',
    title: 'Improve water quality',
    description: 'Set a level for one parameter, such as turbidity.',
    apply: (d) => ({
      ...d,
      kind: 'IMPROVE_WATER_QUALITY',
      mode: 'ABSOLUTE_LEVEL',
      targetValue: '',
      unit: 'NTU',
      targetParameter: 'turbidity',
    }),
  },
  {
    id: 'custom',
    title: 'Something else',
    description: 'Describe it in your own words, then confirm the wording.',
    apply: (d) => ({ ...d, kind: 'CUSTOM', mode: null, unit: null, confirmed: false }),
  },
];

const yesNo = (v: YesNo): boolean | null => (v === '' ? null : v === 'yes');
const fromBool = (v: boolean | null | undefined): YesNo => (v == null ? '' : v ? 'yes' : 'no');

function money(
  amount: string,
  currency: string,
  exponent: number,
): { minorUnits: string; currency: string } {
  return { minorUnits: shiftDecimalRight(amount, exponent), currency };
}

function moneyAmount(minorUnits: string, exponent: number | null): string {
  return exponent === null ? minorUnits : shiftDecimalLeft(minorUnits, exponent);
}

function fitsExponent(amount: string, exponent: number): boolean {
  const fraction = amount.split('.')[1] ?? '';
  return fraction.replace(/0+$/, '').length <= exponent;
}

/**
 * Canonical goal input from the draft, or the fields that need attention. Only format is
 * checked here; what the values mean is checked by the server (`checkGoal`).
 */
export function toGoalInput(draft: GoalDraft): { input: GoalInput | null; errors: DraftErrors } {
  const errors: DraftErrors = {};
  if (!draft.kind) {
    errors.kind = 'Choose a goal.';
    return { input: null, errors };
  }
  let target: GoalInput['target'] = null;
  if (draft.mode) {
    const value = draft.targetValue.trim();
    const ratio = draft.unit === 'RATIO' || draft.mode === 'RELATIVE_REDUCTION';
    const pattern = draft.unit === 'METRES_BELOW_GROUND' ? SIGNED_DECIMAL : DECIMAL;
    if (!pattern.test(value)) {
      errors.targetValue = ratio
        ? 'Enter a percentage such as 30, without the % sign.'
        : 'Enter a number such as 15, without commas or units.';
    } else if (ratio && Number(value) > 100) {
      errors.targetValue = 'A percentage is at most 100.';
    } else {
      target = {
        mode: draft.mode,
        quantity: {
          value: ratio ? shiftDecimalLeft(value, 2) : canonicalDecimal(value),
          unit: ratio ? 'RATIO' : (draft.unit ?? 'COUNT'),
        },
      };
    }
  }
  const exponent = currencyExponent(draft.currency);
  let budget: GoalInput['budget'] = null;
  const amount = draft.budgetAmount.trim();
  if (amount) {
    if (exponent === null) errors.currency = 'Choose a currency.';
    else if (!DECIMAL.test(amount))
      errors.budgetAmount = 'Enter an amount such as 1000000, without commas or symbols.';
    else if (!fitsExponent(amount, exponent))
      errors.budgetAmount = `${draft.currency} has ${exponent} decimal places at most.`;
    else budget = money(amount, draft.currency, exponent);
  }
  const days = (field: 'timelineDays' | 'horizonDays'): number | null => {
    const v = draft[field].trim();
    if (!v) return null;
    if (!WHOLE.test(v) || Number(v) < 1) {
      errors[field] = 'Enter a whole number of days, such as 365.';
      return null;
    }
    return Number(v);
  };
  const area = (field: 'roofArea' | 'openGround') => {
    const v = draft[field].trim();
    if (!v) return null;
    if (!DECIMAL.test(v)) {
      errors[field] = 'Enter square metres as a number, such as 120.';
      return null;
    }
    return { value: canonicalDecimal(v), unit: 'SQUARE_METRE' as const };
  };
  const estimates: NonNullable<GoalInput['estimates']> = [];
  draft.estimates.forEach((e, i) => {
    const key = (f: keyof EstimateDraft) => `estimates.${i}.${f}`;
    const low = e.costLow.trim();
    const high = e.costHigh.trim() || low;
    let cost: NonNullable<GoalInput['estimates']>[number]['cost'] = null;
    if (low) {
      if (exponent === null) errors.currency = 'Choose a currency.';
      else if (!DECIMAL.test(low) || !fitsExponent(low, exponent))
        errors[key('costLow')] = 'Enter an amount without commas or symbols.';
      else if (!DECIMAL.test(high) || !fitsExponent(high, exponent))
        errors[key('costHigh')] = 'Enter an amount without commas or symbols.';
      else
        cost = {
          low: money(low, draft.currency, exponent),
          high: money(high, draft.currency, exponent),
        };
    }
    const bLow = e.buildLow.trim();
    const bHigh = e.buildHigh.trim() || bLow;
    let buildDays: { low: number; high: number } | null = null;
    if (bLow) {
      if (!WHOLE.test(bLow)) errors[key('buildLow')] = 'Enter whole days.';
      else if (!WHOLE.test(bHigh)) errors[key('buildHigh')] = 'Enter whole days.';
      else buildDays = { low: Number(bLow), high: Number(bHigh) };
    }
    const effects: NonNullable<NonNullable<GoalInput['estimates']>[number]['effects']> = [];
    for (const x of e.effects) {
      const eLow = x.low.trim();
      const eHigh = x.high.trim() || eLow;
      if (!eLow && !eHigh) continue;
      const share = x.unit === 'RATIO';
      if (!DECIMAL.test(eLow) || !DECIMAL.test(eHigh)) {
        errors[effectsField(i)] = share
          ? 'Enter percentages such as 20, without the % sign.'
          : 'Enter numbers without commas or units.';
      } else if (share && (Number(eLow) > 100 || Number(eHigh) > 100)) {
        errors[effectsField(i)] = 'A percentage is at most 100.';
      } else if (Number(eLow) > Number(eHigh)) {
        errors[effectsField(i)] = 'Give the lower figure first.';
      } else {
        const canonical = (v: string) => (share ? shiftDecimalLeft(v, 2) : canonicalDecimal(v));
        effects.push({ key: x.key, low: canonical(eLow), high: canonical(eHigh) });
      }
    }
    if (!low && !bLow && !e.effects.some((x) => x.low.trim() || x.high.trim()))
      errors[key('costLow')] = 'Give a cost, a build time or an effect range.';
    estimates.push({
      interventionId: e.interventionId,
      cost,
      buildDays,
      effects,
      note: e.note.trim(),
    });
  });
  const input: GoalInput = {
    kind: draft.kind,
    description: draft.description.trim(),
    target,
    targetParameter:
      target && (draft.kind === 'IMPROVE_WATER_QUALITY' || draft.kind === 'CUSTOM')
        ? draft.targetParameter.trim() || null
        : null,
    budget,
    timelineDays: days('timelineDays'),
    horizonDays: days('horizonDays'),
    priority: draft.priority || null,
    also: draft.also.filter((k) => k !== draft.kind),
    site: {
      scale: draft.scale || null,
      roofArea: area('roofArea'),
      openGround: area('openGround'),
      storageSpace: yesNo(draft.storageSpace),
      pipedSupply: yesNo(draft.pipedSupply),
      groundwaterUse: yesNo(draft.groundwaterUse),
      restrictions: draft.restrictions,
    },
    preferredInterventions: draft.preferred,
    estimates,
    confirmed: draft.kind === 'CUSTOM' ? draft.confirmed : false,
  };
  return Object.keys(errors).length ? { input: null, errors } : { input, errors };
}

/** The draft for a saved goal, shown in the same units the person typed them in. */
export function fromGoalInput(
  goal: GoalInput,
  fallbackCurrency: string,
  effectUnits: EffectUnits = {},
): GoalDraft {
  const currency =
    goal.budget?.currency ??
    goal.estimates?.find((e) => e.cost)?.cost?.low.currency ??
    fallbackCurrency;
  const exponent = currencyExponent(currency);
  const ratio = goal.target?.quantity.unit === 'RATIO';
  return {
    ...emptyDraft(currency),
    kind: goal.kind,
    description: goal.description ?? '',
    confirmed: goal.confirmed ?? false,
    mode: goal.target?.mode ?? null,
    targetValue: goal.target
      ? ratio
        ? shiftDecimalRight(goal.target.quantity.value, 2)
        : goal.target.quantity.value
      : '',
    unit: goal.target?.quantity.unit ?? null,
    targetParameter: goal.targetParameter ?? '',
    budgetAmount: goal.budget ? moneyAmount(goal.budget.minorUnits, exponent) : '',
    timelineDays: goal.timelineDays ? String(goal.timelineDays) : '',
    horizonDays: goal.horizonDays ? String(goal.horizonDays) : '',
    priority: goal.priority ?? '',
    also: [...(goal.also ?? [])],
    scale: goal.site?.scale ?? '',
    roofArea: goal.site?.roofArea?.value ?? '',
    openGround: goal.site?.openGround?.value ?? '',
    storageSpace: fromBool(goal.site?.storageSpace),
    pipedSupply: fromBool(goal.site?.pipedSupply),
    groundwaterUse: fromBool(goal.site?.groundwaterUse),
    restrictions: [...(goal.site?.restrictions ?? [])],
    preferred: [...(goal.preferredInterventions ?? [])],
    estimates: (goal.estimates ?? []).map((e) => ({
      interventionId: e.interventionId,
      costLow: e.cost ? moneyAmount(e.cost.low.minorUnits, exponent) : '',
      costHigh: e.cost ? moneyAmount(e.cost.high.minorUnits, exponent) : '',
      buildLow: e.buildDays ? String(e.buildDays.low) : '',
      buildHigh: e.buildDays ? String(e.buildDays.high) : '',
      effects: (e.effects ?? []).map((x) => {
        const unit = effectUnits[`${e.interventionId}.${x.key}`] ?? 'RATIO';
        const shown = (v: string) => (unit === 'RATIO' ? shiftDecimalRight(v, 2) : v);
        return { key: x.key, unit, low: shown(x.low), high: shown(x.high) };
      }),
      note: e.note ?? '',
    })),
  };
}

/** Server field paths ("goal.site.roofArea") to the draft field that shows the message. */
export function draftField(path: string): string {
  const p = path.replace(/^goal\.?/, '');
  const estimate = /^estimates\.(\d+)\.(\w+)/.exec(p);
  if (estimate) {
    const [, i, f] = estimate;
    if (f === 'effects') return effectsField(Number(i));
    return `estimates.${i}.${f === 'buildDays' ? 'buildLow' : 'costLow'}`;
  }
  if (p.startsWith('target.') || p === 'target') return 'targetValue';
  if (p.startsWith('budget')) return 'budgetAmount';
  if (p.startsWith('site.')) return p.split('.')[1] ?? 'scale';
  if (p.startsWith('preferredInterventions')) return 'preferred';
  return p || 'kind';
}
