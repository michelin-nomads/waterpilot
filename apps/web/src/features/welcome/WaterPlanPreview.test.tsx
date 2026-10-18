import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WaterPlanPreview } from './WaterPlanPreview';

describe('landing water plan preview', () => {
  it('carries the selected location and plan into a reviewed downloadable report', () => {
    render(<WaterPlanPreview />);
    expect(screen.queryByText('Area analysis')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Compare plans →' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Garden Heights/ }));
    expect(screen.getByText('Garden Heights · Area analysis')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Compare plans →' }));
    fireEvent.click(screen.getByRole('button', { name: /Harvesting \+ reuse/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Review selected plan →' }));
    expect(screen.getByText('Harvesting + reuse')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save report' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Save report' }));
    const download = screen.getByRole('link', { name: 'Download report ↓' });
    expect(decodeURIComponent(download.getAttribute('href')!)).toContain(
      'Community: Garden Heights',
    );
    expect(decodeURIComponent(download.getAttribute('href')!)).toContain(
      'Selected plan: Harvesting + reuse',
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Understand' }));
    fireEvent.click(screen.getByRole('button', { name: /Lakeview/ }));
    fireEvent.click(screen.getByRole('tab', { name: 'Take action' }));
    expect(screen.getByText('Your report starts with a plan')).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Download report ↓' })).not.toBeInTheDocument();
  });

  it('supports arrow-key tab navigation and location-first empty states', () => {
    render(<WaterPlanPreview />);
    const tabs = screen.getByRole('tablist');
    fireEvent.keyDown(within(tabs).getByRole('tab', { name: 'Understand' }), { key: 'ArrowRight' });
    expect(within(tabs).getByRole('tab', { name: 'Compare' })).toHaveFocus();
    expect(screen.getByText('Start with your community')).toBeVisible();
  });
});
