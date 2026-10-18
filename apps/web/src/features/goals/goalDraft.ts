import type {
  GoalInput,
  FundingStatus,
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
  recurringLow?: string;
  recurringHigh?: string;
  recurringCurrency?: string;
  costCurrency?: string;
  buildLow: string;
  buildHigh: string;
  effects: EffectDraft[];
  note: string;
}

/** Catalogue units of each measure's effect inputs, by `${interventionId}.${key}`. */
export type EffectUnits = Readonly<Record<string, Unit>>;

export type YesNo = 'yes' | 'no' | '';

export interface FundingDraft {
  label: string;
  amount: string;
  currency: string;
  status: FundingStatus;
  note: string;
}

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
  tariffAmount: string;
  tariffLitres: string;
  tariffCurrency: string;
  tariffNote: string;
  contingencyPercent: string;
  funding: FundingDraft[];
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
    tariffAmount: '',
    tariffLitres: '',
    tariffCurrency: currency,
    tariffNote: '',
    contingencyPercent: '',
    funding: [],
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
    title: 'Groundwater depth of 10 m below ground',
    description: 'Recharge the ground. You can set a level in metres below ground.',
    apply: (d) => ({
      ...d,
      kind: 'IMPROVE_GROUNDWATER',
      mode: 'ABSOLUTE_LEVEL',
      unit: 'METRES_BELOW_GROUND',
      targetValue: '10',
    }),
  },
  {
    id: 'bills',
    title: 'Reduce water bills by 20%',
    description: 'Use and lose less water. WaterPilot has no record of your bills.',
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
    title: 'At most 1 flood event per year',
    description: 'Slow and soak up storm water.',
    apply: (d) => ({
      ...d,
      kind: 'REDUCE_FLOOD_RISK',
      mode: 'ABSOLUTE_LEVEL',
      unit: 'COUNT',
      targetValue: '1',
    }),
  },
  {
    id: 'quality',
    title: 'Turbidity target of 5 NTU',
    description: 'Set a level for one parameter, such as turbidity.',
    apply: (d) => ({
      ...d,
      kind: 'IMPROVE_WATER_QUALITY',
      mode: 'ABSOLUTE_LEVEL',
      targetValue: '5',
      unit: 'NTU',
      targetParameter: 'turbidity',
    }),
  },
  {
    id: 'custom',
    title: '20% reduction in your chosen measure',
    description: 'Describe it in your own words, then confirm the wording.',
    apply: (d) => ({
      ...d,
      kind: 'CUSTOM',
      mode: 'RELATIVE_REDUCTION',
      unit: 'RATIO',
      targetValue: '20',
    }),
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
  const amountInput = (value: string, code: string, field: string) => {
    const digits = currencyExponent(code);
    if (
      !/^[A-Z]{3}$/.test(code) ||
      digits === null ||
      !DECIMAL.test(value) ||
      !fitsExponent(value, digits)
    ) {
      errors[field] = 'Enter a non-negative amount with the correct currency precision.';
      return null;
    }
    return money(value, code, digits);
  };
  let waterTariff: GoalInput['waterTariff'] = null;
  if (draft.tariffAmount.trim() || draft.tariffLitres.trim()) {
    const price = amountInput(
      draft.tariffAmount.trim(),
      draft.tariffCurrency || draft.currency,
      'tariffAmount',
    );
    if (!DECIMAL.test(draft.tariffLitres.trim()) || Number(draft.tariffLitres) <= 0)
      errors.tariffLitres = 'Enter a positive volume in litres.';
    else if (price)
      waterTariff = {
        price,
        volume: { value: canonicalDecimal(draft.tariffLitres), unit: 'LITRE' },
        note: draft.tariffNote.trim(),
      };
  }
  const cp = draft.contingencyPercent.trim();
  if (cp && (!DECIMAL.test(cp) || Number(cp) > 100))
    errors.contingencyPercent = 'Enter a percentage from 0 to 100.';
  const funding: NonNullable<GoalInput['funding']> = draft.funding.flatMap((f, i) => {
    const amount = amountInput(f.amount.trim(), f.currency, `funding.${i}.amount`);
    if (!f.label.trim()) errors[`funding.${i}.label`] = 'Describe this funding source.';
    return amount ? [{ label: f.label.trim(), amount, status: f.status, note: f.note.trim() }] : [];
  });
  const estimates: NonNullable<GoalInput['estimates']> = [];
  draft.estimates.forEach((e, i) => {
    const key = (f: keyof EstimateDraft) => `estimates.${i}.${f}`;
    const low = e.costLow.trim();
    const costCode = e.costCurrency || draft.currency;
    const range = (lo: string, hi: string, code: string, field: string) => {
      if (!lo.trim() && !hi.trim()) return null;
      const l = amountInput(lo.trim(), code, key(field as keyof EstimateDraft));
      const h = amountInput(
        hi.trim() || lo.trim(),
        code,
        key(field === 'costLow' ? 'costHigh' : 'recurringHigh'),
      );
      if (l && h && BigInt(l.minorUnits) > BigInt(h.minorUnits))
        errors[key(field as keyof EstimateDraft)] = 'Give the lower amount first.';
      return l && h ? { low: l, high: h } : null;
    };
    const cost = range(low, e.costHigh, costCode, 'costLow');
    const recurring = range(
      e.recurringLow ?? '',
      e.recurringHigh ?? '',
      e.recurringCurrency || draft.currency,
      'recurringLow',
    );
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
    if (
      !low &&
      !e.recurringLow?.trim() &&
      !bLow &&
      !e.effects.some((x) => x.low.trim() || x.high.trim())
    )
      errors[key('costLow')] = 'Give a cost, a build time or an effect range.';
    estimates.push({
      interventionId: e.interventionId,
      cost,
      recurring,
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
    waterTariff,
    contingencyRatio: cp && !errors.contingencyPercent ? shiftDecimalLeft(cp, 2) : null,
    funding,
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
    tariffAmount: goal.waterTariff
      ? moneyAmount(
          goal.waterTariff.price.minorUnits,
          currencyExponent(goal.waterTariff.price.currency),
        )
      : '',
    tariffCurrency: goal.waterTariff?.price.currency ?? currency,
    tariffLitres: goal.waterTariff?.volume.value ?? '',
    tariffNote: goal.waterTariff?.note ?? '',
    contingencyPercent: goal.contingencyRatio ? shiftDecimalRight(goal.contingencyRatio, 2) : '',
    funding: (goal.funding ?? []).map((f) => ({
      label: f.label,
      amount: moneyAmount(f.amount.minorUnits, currencyExponent(f.amount.currency)),
      currency: f.amount.currency,
      status: f.status,
      note: f.note ?? '',
    })),
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
      costLow: e.cost
        ? moneyAmount(e.cost.low.minorUnits, currencyExponent(e.cost.low.currency))
        : '',
      costCurrency: e.cost?.low.currency ?? currency,
      recurringLow: e.recurring
        ? moneyAmount(e.recurring.low.minorUnits, currencyExponent(e.recurring.low.currency))
        : '',
      recurringHigh: e.recurring
        ? moneyAmount(e.recurring.high.minorUnits, currencyExponent(e.recurring.high.currency))
        : '',
      recurringCurrency: e.recurring?.low.currency ?? currency,
      costHigh: e.cost
        ? moneyAmount(e.cost.high.minorUnits, currencyExponent(e.cost.high.currency))
        : '',
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
  const funding = /^funding\.(\d+)\.(\w+)/.exec(p);
  if (funding) return `funding.${funding[1]}.${funding[2]}`;
  const estimate = /^estimates\.(\d+)\.(\w+)/.exec(p);
  if (estimate) {
    const [, i, f] = estimate;
    if (f === 'effects') return effectsField(Number(i));
    return `estimates.${i}.${f === 'buildDays' ? 'buildLow' : f === 'recurring' ? 'recurringLow' : 'costLow'}`;
  }
  if (p.startsWith('target.') || p === 'target') return 'targetValue';
  if (p.startsWith('waterTariff.volume')) return 'tariffLitres';
  if (p.startsWith('waterTariff')) return 'tariffAmount';
  if (p === 'contingencyRatio') return 'contingencyPercent';
  if (p.startsWith('budget')) return 'budgetAmount';
  if (p.startsWith('site.')) return p.split('.')[1] ?? 'scale';
  if (p.startsWith('preferredInterventions')) return 'preferred';
  return p || 'kind';
}
