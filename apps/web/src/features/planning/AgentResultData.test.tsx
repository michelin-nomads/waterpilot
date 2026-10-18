import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { AgentResultData } from './AgentResultData';

it('reviews a location without dumping unrelated session fields or missing placeholders', () => {
  const { container } = render(
    <AgentResultData
      toolName="inspect_planning_state"
      value={{
        stage: 'understand',
        community_baseline: { residents: undefined },
        location: { name: 'Example society', formatted_address: 'undefined', timezone: null },
      }}
    />,
  );
  expect(screen.getByText('Example society')).toBeInTheDocument();
  expect(container.textContent).not.toMatch(/undefined|null|Residents|understand/);
  expect(screen.getByText(/Location saved/)).toBeInTheDocument();
});

it('keeps legitimate zero and false values while removing undefined array entries and titles', () => {
  const { container } = render(
    <AgentResultData
      value={{ rows: [undefined, 'undefined', { name: undefined, count: 0, measured: false }] }}
    />,
  );
  expect(container.textContent).not.toMatch(/undefined/);
  expect(screen.getByText('0')).toBeInTheDocument();
  expect(screen.getByText('No')).toBeInTheDocument();
});

it('summarizes missing coverage once instead of repeating unavailable rows', () => {
  const { container } = render(
    <AgentResultData
      toolName="inspect_coverage"
      value={{
        coverage: {
          items: ['rainfall', 'groundwater', 'quality'].map((capability) => ({
            capability,
            availability: 'unavailable',
            reason: 'No source is registered for this capability.',
          })),
        },
        readiness: { items: [{ availability: 'unavailable' }] },
      }}
    />,
  );
  expect(
    screen.getByText('No usable source data is registered for this area yet.'),
  ).toBeInTheDocument();
  expect(screen.getByText(/Next: review the area data/)).toBeInTheDocument();
  expect(container.textContent).not.toMatch(/unavailable|No source is registered|Readiness/);
  expect(container.querySelectorAll('details')).toHaveLength(0);
});
