import { currencyExponent } from './goalDraft';

/** Formatting only: never parses the editable amount through binary floating-point. */
export function goalBudgetLabel(amount: string, currency: string): string {
  if (!amount) return 'Not set';
  const exponent = currencyExponent(currency);
  if (
    exponent === null ||
    !/^\d+(\.\d+)?$/.test(amount) ||
    (amount.split('.')[1]?.length ?? 0) > exponent
  )
    return `${currency || 'Currency not set'} ${amount}`;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.max(exponent, amount.split('.')[1]?.length ?? 0),
  }).format(amount as Intl.StringNumericLiteral);
}

export function goalDurationLabel(days: string, horizon = false): string {
  if (!days) return 'Not set';
  const labels: Record<string, string> = horizon
    ? { '365': '1 year', '1825': '5 years', '3650': '10 years' }
    : { '180': '6 months', '365': '12 months', '730': '24 months' };
  return labels[days] ?? `${days} days`;
}
