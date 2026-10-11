/**
 * Display formatting at the presentation boundary (docs/domain/conventions.md §1, §4).
 * Values arrive canonical — INR as integer paise, rates as L/day — and are converted with
 * exact string/BigInt arithmetic. Rounding happens once, here, with ROUND_HALF_EVEN.
 */

const DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/;
const LOCALE = 'en-IN';

type IntegerInput = bigint | number;
type DecimalInput = bigint | number | string;

function toBigInt(value: IntegerInput, what: string): bigint {
  if (typeof value === 'bigint') return value;
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${what} must be an integer within the safe range, got ${value}`);
  }
  return BigInt(value);
}

function toDecimalString(value: DecimalInput, what: string): string {
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number') return toBigInt(value, what).toString();
  if (!DECIMAL_PATTERN.test(value))
    throw new RangeError(`${what} is not a plain decimal: "${value}"`);
  return value;
}

/** Exact division of a plain decimal string by 10^places. */
export function shiftDecimalLeft(value: string, places: number): string {
  if (!DECIMAL_PATTERN.test(value)) throw new RangeError(`not a plain decimal: "${value}"`);
  const negative = value.startsWith('-');
  const [intPart = '0', fracPart = ''] = (negative ? value.slice(1) : value).split('.');
  let digits = intPart + fracPart;
  let pointAt = intPart.length - places;
  if (pointAt < 1) {
    digits = '0'.repeat(1 - pointAt) + digits;
    pointAt = 1;
  }
  const whole = digits.slice(0, pointAt).replace(/^0+(?=\d)/, '');
  const fraction = digits.slice(pointAt).replace(/0+$/, '');
  const result = fraction ? `${whole}.${fraction}` : whole;
  return negative && /[1-9]/.test(result) ? `-${result}` : result;
}

/**
 * One spelling per number ("0.20" and "0.2", "400.0" and "400", "-0" and "0"), matching
 * the server's canonical form. Anything that is not a plain decimal is returned as is.
 */
export function canonicalDecimal(value: string): string {
  return DECIMAL_PATTERN.test(value) ? shiftDecimalLeft(value, 0) : value;
}

export function paiseToRupeeString(paise: IntegerInput): string {
  return shiftDecimalLeft(toBigInt(paise, 'paise').toString(), 2);
}

export type InrStyle = 'exact' | 'rupees' | 'compact';

const inrFormatters: Record<InrStyle, Intl.NumberFormat> = {
  exact: new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
  rupees: new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
    roundingMode: 'halfEven',
  }),
  compact: new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: 'INR',
    notation: 'compact',
    maximumFractionDigits: 1,
    roundingMode: 'halfEven',
  }),
};

/**
 * Formats integer paise as INR. `exact` keeps paise, `rupees` rounds to whole rupees and
 * `compact` uses lakh/crore abbreviations (₹8.2L). Display only — never feed it back.
 */
export function formatInrPaise(paise: IntegerInput, style: InrStyle = 'exact'): string {
  return inrFormatters[style].format(paiseToRupeeString(paise) as Intl.StringNumericLiteral);
}

const LITRES_PER_MEGALITRE_DIGITS = 6;

/** Formats a canonical L/day rate as MLD (1 MLD = 1,000,000 L/day), 1 decimal by default. */
export function formatMldFromLitresPerDay(litresPerDay: DecimalInput, fractionDigits = 1): string {
  const mld = shiftDecimalLeft(
    toDecimalString(litresPerDay, 'litresPerDay'),
    LITRES_PER_MEGALITRE_DIGITS,
  );
  const number = new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    roundingMode: 'halfEven',
  }).format(mld as Intl.StringNumericLiteral);
  return `${number} MLD`;
}

/** Formats a plain decimal (number or exact string) for display. */
export function formatDecimal(value: DecimalInput, maximumFractionDigits = 1): string {
  const input =
    typeof value === 'number' && !Number.isInteger(value)
      ? value
      : (toDecimalString(value, 'value') as Intl.StringNumericLiteral);
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits, roundingMode: 'halfEven' }).format(
    input,
  );
}

/** Exact multiplication of a plain decimal string by 10^places. */
export function shiftDecimalRight(value: string, places: number): string {
  if (!DECIMAL_PATTERN.test(value)) throw new RangeError(`not a plain decimal: "${value}"`);
  const negative = value.startsWith('-');
  const [intPart = '0', fracPart = ''] = (negative ? value.slice(1) : value).split('.');
  const padded = fracPart.padEnd(places, '0');
  const whole = (intPart + padded.slice(0, places)).replace(/^0+(?=\d)/, '');
  const fraction = padded.slice(places).replace(/0+$/, '');
  const result = fraction ? `${whole}.${fraction}` : whole;
  return negative && /[1-9]/.test(result) ? `-${result}` : result;
}

/** Formats an exact ratio (e.g. "0.94") as a percentage, rounding half-even once. */
export function formatPercentFromRatio(ratio: string, fractionDigits = 0): string {
  const percent = shiftDecimalRight(toDecimalString(ratio, 'ratio'), 2);
  const number = new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    roundingMode: 'halfEven',
  }).format(percent as Intl.StringNumericLiteral);
  return `${number}%`;
}

/** 1 US gallon = 3.785411784 L exactly (NIST), as an integer over 10^9. */
const LITRES_PER_GALLON_E9 = 3_785_411_784n;

function divideHalfEven(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator;
  const twice = 2n * (numerator % denominator);
  if (twice > denominator || (twice === denominator && quotient % 2n !== 0n)) {
    return quotient + 1n;
  }
  return quotient;
}

/**
 * Million US gallons per day from canonical L/day, rounded half-even once with exact
 * integer arithmetic. Display only; stored values stay in L/day.
 */
export function mgdFromLitresPerDay(litresPerDay: DecimalInput, fractionDigits = 2): string {
  const text = toDecimalString(litresPerDay, 'litresPerDay');
  const negative = text.startsWith('-');
  const [intPart = '0', fracPart = ''] = (negative ? text.slice(1) : text).split('.');
  const digits = BigInt(intPart + fracPart);
  // MGD = L/day / 3.785411784 / 10^6 = digits * 10^3 / (10^scale * 3785411784)
  const numerator = digits * 10n ** BigInt(3 + fractionDigits);
  const denominator = 10n ** BigInt(fracPart.length) * LITRES_PER_GALLON_E9;
  const scaled = divideHalfEven(numerator, denominator).toString();
  const result = shiftDecimalLeft(scaled, fractionDigits);
  return negative && /[1-9]/.test(result) ? `-${result}` : result;
}

export function formatMgdFromLitresPerDay(litresPerDay: DecimalInput, fractionDigits = 2): string {
  const number = new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(mgdFromLitresPerDay(litresPerDay, fractionDigits) as Intl.StringNumericLiteral);
  return `${number} MGD`;
}
