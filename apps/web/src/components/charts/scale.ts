/** Axis helpers for the small SVG charts. Presentation only — never used for metric maths. */

export const CHART_WIDTH = 640;
export const CHART_HEIGHT = 260;
export const CHART_MARGIN = { top: 16, right: 16, bottom: 40, left: 64 } as const;

function decimalsOf(step: number): number {
  return Math.max(0, -Math.floor(Math.log10(step)));
}

export function niceStep(range: number, targetTicks: number): number {
  const raw = range / Math.max(1, targetTicks);
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return factor * magnitude;
}

/** Evenly spaced round tick values covering [min, max]; always includes 0 when in range. */
export function niceTicks(min: number, max: number, targetTicks = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min === max) {
    if (min === 0) return [0, 1];
    return min > 0 ? niceTicks(0, min, targetTicks) : niceTicks(min, 0, targetTicks);
  }
  const step = niceStep(max - min, targetTicks);
  const decimals = decimalsOf(step);
  const start = Math.floor(min / step);
  const end = Math.ceil(max / step);
  const ticks: number[] = [];
  for (let i = start; i <= end; i += 1) ticks.push(Number((i * step).toFixed(decimals)));
  return ticks;
}

export interface ChartSeries {
  id: string;
  label: string;
  /** One value per category; `null` means unavailable and is never drawn as zero. */
  values: ReadonlyArray<number | null>;
}

export interface ChartData {
  title: string;
  /** One-sentence summary used as the SVG's accessible description. */
  description?: string;
  unit: string;
  categories: readonly string[];
  series: readonly ChartSeries[];
  formatValue?: (value: number) => string;
}

const defaultFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

export function formatChartValue(data: ChartData, value: number): string {
  return data.formatValue ? data.formatValue(value) : defaultFormat.format(value);
}

export function valueDomain(
  series: readonly ChartSeries[],
  includeZero: boolean,
): [number, number] {
  const values = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  if (values.length === 0) return [0, 1];
  const min = Math.min(...values, ...(includeZero ? [0] : []));
  const max = Math.max(...values, ...(includeZero ? [0] : []));
  return [min, max];
}

export function linearScale(domain: readonly [number, number], range: readonly [number, number]) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  return (value: number) => r0 + ((value - d0) / span) * (r1 - r0);
}
