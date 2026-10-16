const SCALE = 1000n;
const NUMBER = /^\d+(?:\.\d{1,3})?$/;

function scaled(value: string): bigint | null {
  const trimmed = value.trim();
  if (trimmed.length > 12 || !NUMBER.test(trimmed)) return null;
  const [whole, fraction = ''] = trimmed.split('.');
  return BigInt(whole!) * SCALE + BigInt(fraction.padEnd(3, '0'));
}

function decimal(value: bigint): string {
  const whole = value / SCALE;
  const fraction = String(value % SCALE)
    .padStart(3, '0')
    .replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : String(whole);
}

export interface PopulationEstimate {
  population: string;
  dailyDemandLitres: string;
}

/** Exact fixed-point estimate; reject fractional people rather than silently rounding. */
export function calculatePopulationEstimate(
  homesText: string,
  residentsPerHomeText: string,
  litresPerPersonText: string,
): PopulationEstimate | null {
  const homesValue = homesText.trim();
  if (homesValue.length > 8) return null;
  const homes = /^\d+$/.test(homesValue) ? BigInt(homesValue) : 0n;
  const residentsPerHome = scaled(residentsPerHomeText);
  const litresPerPerson = scaled(litresPerPersonText);
  if (homes < 1n || homes > 10_000_000n || !residentsPerHome || !litresPerPerson) return null;
  const peopleScaled = homes * residentsPerHome;
  if (peopleScaled % SCALE !== 0n || litresPerPerson <= 0n) return null;
  const population = peopleScaled / SCALE;
  return {
    population: String(population),
    dailyDemandLitres: decimal(population * litresPerPerson),
  };
}
