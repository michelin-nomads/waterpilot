import type { WaterSourceInput } from '../../graphql/generated/graphql';

/** Display-only daily conversion; authoritative totals are calculated on the server. */
export function sourceDaily(source: WaterSourceInput): number | null {
  if (source.quantity == null || source.quantity === '') return null;
  const quantity = Number(source.quantity);
  const multiplier = Number(source.multiplier);
  if (!Number.isFinite(quantity) || quantity < 0) return null;
  if (source.method === 'volume_over_period' || source.method === 'tanker_deliveries') {
    if (!Number.isInteger(source.periodDays) || source.periodDays < 1) return null;
  }
  if (source.method === 'pump_runtime' || source.method === 'tanker_deliveries') {
    if (!Number.isFinite(multiplier) || multiplier <= 0) return null;
  }
  if (source.method === 'volume_over_period') return quantity / source.periodDays;
  if (source.method === 'tanker_deliveries') return (quantity * multiplier) / source.periodDays;
  if (source.method === 'pump_runtime') return multiplier > 24 ? null : quantity * multiplier;
  return quantity;
}
