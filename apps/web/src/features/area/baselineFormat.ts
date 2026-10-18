import type { ChartData } from '../../components';
import type {
  BaselineFieldsFragment,
  CanonicalUnit,
  ReadinessInput,
  UnitSystem,
  ValueOrigin,
} from '../../graphql/generated/graphql';
import type { IconName } from '../../components';
import {
  formatDecimal,
  formatPercentFromRatio,
  mgdFromLitresPerDay,
  shiftDecimalLeft,
  shiftDecimalRight,
} from '../../lib/format';
import type { StatusTone } from '../../lib/status';

export type Baseline = BaselineFieldsFragment;
export type BaselineMetric = Baseline['metrics'][number];
export type BaselineIndicator = Baseline['indicators'][number];
export type EvidenceLink = BaselineMetric['evidence'][number];

/** Measured, estimated and modelled values never share a look (text, icon and colour). */
export const ORIGIN_LABEL: Record<
  ValueOrigin,
  { label: string; tone: StatusTone; icon: IconName; description: string }
> = {
  MEASURED: {
    label: 'Measured',
    tone: 'success',
    icon: 'check',
    description: 'From imported records or measurements.',
  },
  USER_ESTIMATE: {
    label: 'Your estimate',
    tone: 'accent',
    icon: 'user',
    description: 'Uses at least one value you entered.',
  },
  MODELED: {
    label: 'Modelled',
    tone: 'info',
    icon: 'layers',
    description: 'Uses at least one model output.',
  },
};

/** Synthetic demo series are never shown as plain "Measured". */
export const SYNTHETIC_ORIGIN = {
  label: 'Synthetic demo',
  tone: 'warning' as StatusTone,
  icon: 'alert' as IconName,
  description: 'Made-up demonstration data, not a measurement of any real place.',
};

export function originLabel(origin: ValueOrigin, demo: boolean) {
  return demo && origin === 'MEASURED' ? SYNTHETIC_ORIGIN : ORIGIN_LABEL[origin];
}

/** What each baseline metric means, in plain words (definitions: metrics registry). */
export const METRIC_HELP: Record<string, string> = {
  demand: 'Water needed per day: people served × litres per person, plus non-domestic use.',
  delivered_supply: 'Average water delivered per day over the window, tankers included.',
  reliable_supply: 'Supply you can count on: delivered on at least 90% of days.',
  deficit: 'How far reliable supply falls short of demand each day. Zero means it covers demand.',
  dependable_supply_ratio: 'Reliable supply as a share of demand.',
  volume_reliability: 'Share of the total water demanded over the window that was supplied.',
  time_reliability: 'Share of days on which supply met demand in full.',
  shortage_days: 'Days on which supply was below demand.',
  tanker_dependence: 'Share of delivered water that came by tanker.',
  days_until_shortage: 'Days until supply is projected to fall short of demand.',
};

export const HEADLINE_METRICS = ['demand', 'delivered_supply', 'deficit'];

export const INPUT_LABEL: Partial<Record<ReadinessInput, string>> = {
  POPULATION: 'Population served',
  PER_CAPITA_STANDARD: 'Per-person daily water need',
  NON_DOMESTIC_DEMAND: 'Non-domestic demand',
  DELIVERED_SUPPLY: 'Delivered supply',
  TANKER_SUPPLY: 'Tanker supply',
};

export const INPUT_UNLOCKS: Partial<Record<ReadinessInput, string>> = {
  POPULATION: 'Needed for demand, the supply gap and every reliability measure.',
  PER_CAPITA_STANDARD: 'Needed for demand, the supply gap and every reliability measure.',
  DELIVERED_SUPPLY: 'Needed for supply, the supply gap and every reliability measure.',
  NON_DOMESTIC_DEMAND: 'Optional: without it, demand covers domestic use only.',
  TANKER_SUPPLY: 'Optional: needed for tanker dependence.',
};

export interface Quantity {
  value: string;
  unit: string;
}

function fixed(value: string, digits: number): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    roundingMode: 'halfEven',
  }).format(value as Intl.StringNumericLiteral);
}

type RateScale = 'MLD' | 'KLD' | 'MGD' | 'GPD';

/** One rate unit for a whole baseline, so cards, details, indicators and chart agree. */
export interface Units {
  system: UnitSystem;
  rate: RateScale;
}

const MEGA = 1_000_000;
/** 0.01 MGD in L/day: below this a US rate is shown in gallons per day. */
const SMALL_US_RATE = 37_854.11784;

function magnitude(value: string): number {
  return Math.abs(Number(value));
}

/**
 * A scale that never shows a nonzero rate as 0: MLD (registry display unit, 1 decimal)
 * unless every nonzero value is below 1 MLD, then kL/day. US areas: MGD or gallons/day.
 */
function rateScale(values: readonly string[], system: UnitSystem): RateScale {
  const nonzero = values.map(magnitude).filter((v) => v > 0);
  if (system === 'US_CUSTOMARY') {
    return nonzero.length > 0 && nonzero.every((v) => v < SMALL_US_RATE) ? 'GPD' : 'MGD';
  }
  return nonzero.length > 0 && nonzero.every((v) => v < MEGA) ? 'KLD' : 'MLD';
}

/** Unrounded value in the scale's unit, for drawing only. */
function plotValue(litres: string, scale: RateScale): number {
  switch (scale) {
    case 'MLD':
      return Number(shiftDecimalLeft(litres, 6));
    case 'KLD':
      return Number(shiftDecimalLeft(litres, 3));
    case 'MGD':
      return Number(mgdFromLitresPerDay(litres, 6));
    case 'GPD':
      return Number(mgdFromLitresPerDay(litres, 9)) * MEGA;
  }
}

/** Fraction digits to try in order; a nonzero value never reads as zero. */
const RATE_DIGITS: Record<RateScale, readonly number[]> = {
  MLD: [1, 3],
  KLD: [0, 1],
  MGD: [2, 4],
  GPD: [0],
};

function inScale(litres: string, scale: RateScale, digits: number): string {
  switch (scale) {
    case 'MLD':
      return shiftDecimalLeft(litres, 6);
    case 'KLD':
      return shiftDecimalLeft(litres, 3);
    case 'MGD':
      return mgdFromLitresPerDay(litres, digits);
    case 'GPD':
      return shiftDecimalRight(mgdFromLitresPerDay(litres, 6 + digits), 6);
  }
}

const RATE_UNIT: Record<RateScale, { rate: string; total: string }> = {
  MLD: { rate: 'MLD', total: 'ML' },
  KLD: { rate: 'kL/day', total: 'kL' },
  MGD: { rate: 'MGD', total: 'million US gal' },
  GPD: { rate: 'US gal/day', total: 'US gal' },
};

function formatRate(litres: string, scale: RateScale, total: boolean): Quantity {
  const unit = total ? RATE_UNIT[scale].total : RATE_UNIT[scale].rate;
  const nonzero = /[1-9]/.test(litres);
  const tries = RATE_DIGITS[scale];
  for (const digits of tries) {
    const value = fixed(inScale(litres, scale, digits), digits);
    if (!nonzero || /[1-9]/.test(value)) return { value, unit };
  }
  const finest = tries[tries.length - 1] ?? 0;
  const bound = finest === 0 ? '1' : `0.${'0'.repeat(finest - 1)}1`;
  return { value: `${litres.startsWith('-') ? '> −' : '< '}${bound}`, unit };
}

/** The rate unit for every L/day value in a baseline (metrics, indicators and chart). */
export function baselineUnits(b: Baseline, system: UnitSystem): Units {
  const rates = [
    ...b.metrics.filter((m) => m.unit === 'LITRES_PER_DAY').map((m) => m.value),
    ...b.indicators.filter((i) => i.unit === 'LITRES_PER_DAY').map((i) => i.value),
    ...(b.chart?.series.flatMap((s) => s.values) ?? []),
  ].filter((v): v is string => v !== null);
  return { system, rate: rateScale(rates, system) };
}

/** Says what US customary units mean; null for metric areas. */
export function unitNote(units: Units): string | null {
  if (units.system !== 'US_CUSTOMARY') return null;
  return 'MGD means million US gallons per day (1 US gallon = 3.785411784 litres exactly). Values are stored and calculated in litres per day.';
}

/** Display value for an exact decimal string in its canonical unit. Display only. */
export function formatQuantity(value: string, unit: CanonicalUnit, units: Units): Quantity {
  switch (unit) {
    case 'LITRES_PER_DAY':
      return formatRate(value, units.rate, false);
    case 'LITRE':
      return formatRate(value, units.rate, true);
    case 'RATIO':
      return { value: formatPercentFromRatio(value), unit: '' };
    case 'DAY':
      return { value: formatDecimal(value, 0), unit: value === '1' ? 'day' : 'days' };
    case 'MILLIMETRE':
      return { value: fixed(value, 1), unit: 'mm' };
    case 'METRES_BELOW_GROUND':
      return { value: fixed(value, 2), unit: 'm below ground' };
    case 'SQUARE_METRE':
      return { value: fixed(value, 0), unit: 'm²' };
    case 'MG_PER_LITRE':
      return { value: fixed(value, 2), unit: 'mg/L' };
    case 'NTU':
      return { value: fixed(value, 1), unit: 'NTU' };
    case 'MICROSIEMENS_PER_CM':
      return { value: fixed(value, 0), unit: 'µS/cm' };
    case 'PH':
      return { value: fixed(value, 1), unit: 'pH' };
    case 'CFU_PER_100ML':
      return { value: fixed(value, 0), unit: 'CFU/100 mL' };
    case 'CATEGORY':
      return { value, unit: '' };
    default:
      return { value: formatDecimal(value, 2), unit: '' };
  }
}

export function quantityText(q: Quantity): string {
  return q.unit ? `${q.value} ${q.unit}` : q.value;
}

const DAY_FORMAT = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const MONTH_FORMAT = new Intl.DateTimeFormat('en-IN', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const SHORT_DAY_FORMAT = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

function utc(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00Z`);
}

/** A local calendar date as sent by the API (YYYY-MM-DD), without timezone shifts. */
export function formatLocalDate(isoDate: string): string {
  return DAY_FORMAT.format(utc(isoDate));
}

/** Last day of a half-open window. */
export function lastDay(endExclusive: string): string {
  const d = utc(endExclusive);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function formatWindow(w: { start: string; endExclusive: string; days: number }): string {
  if (w.days === 0) return 'no days';
  return `${formatLocalDate(w.start)} to ${formatLocalDate(lastDay(w.endExclusive))}`;
}

const SERIES_LABEL: Record<string, string> = {
  delivered_supply: 'Delivered supply',
  demand: 'Demand',
  tanker_supply: 'Tanker supply',
};

/**
 * Chart data from the baseline series. Plotted numbers are for drawing only; the table
 * shows text formatted from the exact values, the same text the metric cards use.
 */
export function baselineChart(b: Baseline, units: Units): ChartData | null {
  const chart = b.chart;
  if (!chart || chart.buckets.length === 0) return null;
  const scale = units.rate;
  const unit = RATE_UNIT[scale].rate;
  const categories = chart.buckets.map((bucket) =>
    (chart.monthly ? MONTH_FORMAT : SHORT_DAY_FORMAT).format(utc(bucket.start)),
  );
  const series = chart.series.map((s) => ({
    id: s.key,
    label: `${SERIES_LABEL[s.key] ?? s.key}${
      s.origin ? ` (${originLabel(s.origin, s.demo).label.toLowerCase()})` : ''
    }`,
    values: s.values.map((v) => (v === null ? null : plotValue(v, scale))),
    display: s.values.map((v) => (v === null ? null : formatRate(v, scale, false).value)),
  }));
  const first = chart.buckets[0];
  const last = chart.buckets[chart.buckets.length - 1];
  const span =
    first && last
      ? `${formatLocalDate(first.start)} to ${formatLocalDate(lastDay(last.endExclusive))}`
      : '';
  const period = chart.monthly
    ? `Monthly averages, ${span}. The first and last months can be partial. A month with any missing day is shown as unavailable.`
    : `Daily values, ${span}. A missing day is shown as unavailable.`;
  const note = unitNote(units);
  return {
    title: chart.monthly ? 'Supply and demand by month' : 'Supply and demand by day',
    description: note ? `${period} ${note}` : period,
    unit,
    categories,
    series,
  };
}

/** "Average of 364 of 365 days" when a value leaves out days without records. */
export function partialCoverage(metric: {
  recordedDays?: number | null;
  periodDays?: number | null;
}): string | null {
  const { recordedDays: recorded, periodDays: period } = metric;
  if (recorded == null || period == null || recorded >= period) return null;
  return `Average of ${recorded} of ${period} days`;
}
