/**
 * UI FIXTURES — illustrative values for demonstrating components only. They are not
 * WaterPilot results, are not derived from any source, and must never be shown outside
 * the local-only design-system page.
 */
import type { ChartData } from '../../components/charts/scale';
import type { Suggestion } from '../../components/SuggestionChips/SuggestionChips';

export const FIXTURE_BAR_CHART: ChartData = {
  title: 'Example grouped bars (UI fixture)',
  description:
    'Two illustrative series over four categories; the third category has no value for series B.',
  unit: 'MLD',
  categories: ['Q1', 'Q2', 'Q3', 'Q4'],
  series: [
    { id: 'a', label: 'Series A', values: [4.2, 3.8, 5.1, 4.6] },
    { id: 'b', label: 'Series B', values: [3.1, 2.9, null, 3.5] },
  ],
};

export const FIXTURE_LINE_CHART: ChartData = {
  title: 'Example lines with a gap (UI fixture)',
  description: 'Three illustrative series; series B is unavailable for 2028, so its line breaks.',
  unit: '%',
  categories: ['2026', '2027', '2028', '2029', '2030'],
  series: [
    { id: 'a', label: 'Series A', values: [60, 64, 67, 71, 74] },
    { id: 'b', label: 'Series B', values: [60, 62, null, 66, 69] },
    { id: 'c', label: 'Series C', values: [60, 60, 61, 61, 62] },
  ],
};

export const FIXTURE_SUGGESTIONS: ReadonlyArray<Suggestion<string>> = [
  {
    id: 'tanker',
    label: 'Tanker supply stops for 30 days',
    value: 'Tanker supply stops for 30 days',
  },
  { id: 'demand', label: 'Demand rises 15%', value: 'Demand rises 15%' },
  {
    id: 'groundwater',
    label: 'Groundwater falls further',
    value: 'Groundwater falls further',
    unavailableReason: 'Needs a reviewed groundwater response model for this location.',
  },
];

/** Canonical units, formatted at the boundary: paise and litres per day. */
export const FIXTURE_FORMAT_SAMPLES = {
  paise: 82_000_012n,
  litresPerDay: '1650000',
} as const;
