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
