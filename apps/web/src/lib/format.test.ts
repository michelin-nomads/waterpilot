import {
  canonicalDecimal,
  formatDecimal,
  formatInrPaise,
  formatMgdFromLitresPerDay,
  formatMldFromLitresPerDay,
  formatPercentFromRatio,
  mgdFromLitresPerDay,
  paiseToRupeeString,
  shiftDecimalLeft,
  shiftDecimalRight,
} from './format';

// Intl inserts narrow/no-break spaces in some locales; compare on normalised text.
const norm = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ');

describe('shiftDecimalLeft (exact decimal division by 10^n)', () => {
  it.each([
    ['1650000', 6, '1.65'],
    ['1600000', 6, '1.6'],
    ['5', 6, '0.000005'],
    ['0', 2, '0'],
    ['-250', 2, '-2.5'],
    ['-0', 2, '0'],
    ['12.5', 2, '0.125'],
    ['100', 0, '100'],
  ])('%s / 10^%i = %s', (value, places, expected) => {
    expect(shiftDecimalLeft(value, places)).toBe(expected);
  });

  it('rejects non-plain decimals rather than guessing', () => {
    expect(() => shiftDecimalLeft('1e6', 2)).toThrow(RangeError);
    expect(() => shiftDecimalLeft('1,000', 2)).toThrow(RangeError);
  });
});

describe('canonicalDecimal (one spelling per number)', () => {
  it.each([
    ['0.20', '0.2'],
    ['400.0', '400'],
    ['007', '7'],
    ['-0', '0'],
    ['-0.50', '-0.5'],
    ['120', '120'],
  ])('%s → %s', (value, expected) => {
    expect(canonicalDecimal(value)).toBe(expected);
  });

  it('leaves non-decimals for the server to refuse', () => {
    expect(canonicalDecimal('1,000')).toBe('1,000');
  });
});

describe('INR display from integer paise', () => {
  it('converts paise exactly, including values beyond Number.MAX_SAFE_INTEGER', () => {
    expect(paiseToRupeeString(82_000_012n)).toBe('820000.12');
    expect(paiseToRupeeString(9_007_199_254_740_993n)).toBe('90071992547409.93');
    expect(paiseToRupeeString(-5)).toBe('-0.05');
  });

  it('formats with Indian digit grouping and keeps paise in exact style', () => {
    expect(norm(formatInrPaise(82_000_012n))).toBe('₹8,20,000.12');
    expect(norm(formatInrPaise(100_000_000))).toBe('₹10,00,000.00');
  });

  it('rounds half to even only at display time in rupees style', () => {
    expect(norm(formatInrPaise(250, 'rupees'))).toBe('₹2');
    expect(norm(formatInrPaise(350, 'rupees'))).toBe('₹4');
    expect(norm(formatInrPaise(251, 'rupees'))).toBe('₹3');
  });

  it('uses lakh/crore abbreviations in compact style', () => {
    expect(norm(formatInrPaise(82_000_000n, 'compact'))).toBe('₹8.2L');
    expect(norm(formatInrPaise(1_500_000_000n, 'compact'))).toBe('₹1.5Cr');
  });

  it('refuses fractional or unsafe numbers instead of silently losing precision', () => {
    expect(() => formatInrPaise(10.5)).toThrow(RangeError);
    expect(() => formatInrPaise(2 ** 53)).toThrow(RangeError);
  });
});

describe('MLD display from canonical L/day', () => {
  it('divides by 1,000,000 exactly and rounds half to even at 1 dp', () => {
    expect(formatMldFromLitresPerDay('1600000')).toBe('1.6 MLD');
    expect(formatMldFromLitresPerDay('1250000')).toBe('1.2 MLD');
    expect(formatMldFromLitresPerDay('1350000')).toBe('1.4 MLD');
    expect(formatMldFromLitresPerDay(10_100_000n)).toBe('10.1 MLD');
  });

  it('accepts exact decimal strings and keeps requested precision', () => {
    expect(formatMldFromLitresPerDay('1649999.5', 3)).toBe('1.650 MLD');
    expect(formatMldFromLitresPerDay('0', 1)).toBe('0.0 MLD');
  });
});

describe('formatDecimal', () => {
  it('rounds decimal strings half to even', () => {
    expect(formatDecimal('2.25', 1)).toBe('2.2');
    expect(formatDecimal('1234567.891', 2)).toBe('12,34,567.89');
  });
});

describe('shiftDecimalRight (exact multiplication by 10^n)', () => {
  it.each([
    ['0.94', 2, '94'],
    ['0.2673267326732673267326732673', 2, '26.73267326732673267326732673'],
    ['1', 2, '100'],
    ['0.005', 2, '0.5'],
    ['-0.25', 2, '-25'],
    ['0', 2, '0'],
  ])('%s * 10^%i = %s', (value, places, expected) => {
    expect(shiftDecimalRight(value, places)).toBe(expected);
  });
});

describe('formatPercentFromRatio', () => {
  it.each([
    ['0.8', '80%'],
    ['0.94', '94%'],
    ['0.7', '70%'],
    ['0.2673267326732673267326732673', '27%'],
    ['0.125', '12%'], // 12.5 rounds half-even to 12
    ['0.135', '14%'],
    ['1', '100%'],
    ['0', '0%'],
  ])('%s -> %s', (ratio, expected) => {
    expect(formatPercentFromRatio(ratio)).toBe(expected);
  });

  it('keeps decimals when asked', () => {
    expect(formatPercentFromRatio('0.2673267326732673267326732673', 1)).toBe('26.7%');
  });
});

describe('million US gallons per day (exact, half-even)', () => {
  it('uses 3.785411784 L per gallon exactly', () => {
    expect(mgdFromLitresPerDay('3785411.784', 3)).toBe('1');
    expect(mgdFromLitresPerDay('10000000', 4)).toBe('2.6417');
    expect(mgdFromLitresPerDay('0')).toBe('0');
  });

  it('formats with the unit', () => {
    expect(norm(formatMgdFromLitresPerDay('10000000'))).toBe('2.64 MGD');
  });
});
