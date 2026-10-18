import { fireEvent, render, screen, within } from '@testing-library/react';

import { baseline, demoBaseline } from '../../test/baselineFixtures';
import { AreaConditions } from './AreaConditions';

const card = (label: string) =>
  within(screen.getByRole('heading', { name: label }).closest('article')!);

it('shows missing conditions without inventing satellite or supply results', () => {
  render(<AreaConditions selected baseline={baseline()} />);
  expect(screen.getByText('0 of 6 available')).toBeVisible();
  expect(screen.getAllByText('Data unavailable')).toHaveLength(6);
  expect(card('Water stress').queryByText(/moderate/i)).not.toBeInTheDocument();
});

it('displays supported results with their units and synthetic provenance', () => {
  render(<AreaConditions selected baseline={demoBaseline()} />);
  expect(card('Reliable supply').getByText('80%')).toBeVisible();
  expect(card('Current water deficit').getByText('2.0 MLD')).toBeVisible();
  expect(card('Water shortage days').getByText('3 days')).toBeVisible();
  expect(screen.getByText('3 of 6 available')).toBeVisible();
  expect(screen.getAllByText('Synthetic demo')).toHaveLength(3);
  expect(card('Water stress').getByText('Data unavailable')).toBeVisible();
});

it('preserves a known zero and hides a numeric result marked unavailable', () => {
  const data = demoBaseline();
  data.metrics = data.metrics.map((m) =>
    m.metric === 'deficit'
      ? { ...m, value: '0' }
      : m.metric === 'shortage_days'
        ? { ...m, availability: 'UNAVAILABLE' }
        : m,
  );
  render(<AreaConditions selected baseline={data} />);
  expect(card('Current water deficit').getByText('0.0 MLD')).toBeVisible();
  expect(card('Water shortage days').getByText('Data unavailable')).toBeVisible();
});

it('provides a retry action after a failed data request', () => {
  const retry = vi.fn();
  render(<AreaConditions selected failed onRetry={retry} />);
  fireEvent.click(screen.getByRole('button', { name: 'Retry area data' }));
  expect(retry).toHaveBeenCalledOnce();
});

it('displays all 6 conditions when fully populated with public data', () => {
  const data = demoBaseline();
  data.metrics = [
    ...data.metrics,
    {
      ...data.metrics[0],
      metric: 'water_stress',
      name: 'Water stress',
      formula: 'dependable_supply / demand',
      unit: 'RATIO',
      availability: 'AVAILABLE',
      exact: '39/50',
      value: '0.78',
      origin: 'MODELED',
      demo: false,
      evidence: [],
    },
  ];
  data.indicators = [
    {
      indicator: 'rainfall_total',
      name: 'Rainfall over the reporting window',
      capability: 'RAINFALL',
      statistic: 'WINDOW_TOTAL',
      variable: 'precipitation_sum',
      parameter: null,
      unit: 'MILLIMETRE',
      availability: 'AVAILABLE',
      exact: '1010.5',
      value: '1010.5',
      observedOn: '2024-12-31',
      reason: null,
      reasons: [],
      origin: 'MEASURED',
      demo: false,
      window: { start: '2024-01-01', endExclusive: '2025-01-01', days: 366 },
      evidence: [],
    },
    {
      indicator: 'groundwater_level',
      name: 'Latest groundwater level',
      capability: 'GROUNDWATER_LEVEL',
      statistic: 'LATEST',
      variable: 'depth_to_water_level',
      parameter: null,
      unit: 'METRES_BELOW_GROUND',
      availability: 'AVAILABLE',
      exact: '16.5',
      value: '16.5',
      observedOn: '2024-11-01',
      reason: null,
      reasons: [],
      origin: 'MEASURED',
      demo: false,
      window: null,
      evidence: [],
    },
  ];
  render(<AreaConditions selected baseline={data} />);
  expect(screen.getByText('6 of 6 available')).toBeVisible();
  expect(card('Water stress').getByText('High Stress (78%)')).toBeVisible();
  expect(card('Rainfall').getByText('1,010.5 mm')).toBeVisible();
  expect(card('Reliable supply').getByText('80%')).toBeVisible();
  expect(card('Current water deficit').getByText('2.0 MLD')).toBeVisible();
  expect(card('Water shortage days').getByText('3 days')).toBeVisible();
  expect(card('Groundwater').getByText('16.50 m below ground')).toBeVisible();
});
