import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';

import { Accordion } from './Accordion/Accordion';
import { BarChart } from './charts/BarChart';
import { LineChart } from './charts/LineChart';
import { niceTicks } from './charts/scale';
import { Field, Input } from './Field/Field';
import { MetricCard } from './MetricCard/MetricCard';
import { SuggestionChips } from './SuggestionChips/SuggestionChips';
import { Tabs } from './Tabs/Tabs';
import { Tooltip } from './Tooltip/Tooltip';

describe('MetricCard', () => {
  it('shows "Unavailable" with its reason and never a number', () => {
    render(
      <MetricCard
        label="Water quality"
        metric={{ availability: 'unavailable', reason: 'Needs local measurements.' }}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Water quality' })).toBeInTheDocument();
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    expect(screen.getByText('Needs local measurements.')).toBeInTheDocument();
    expect(screen.queryByText(/\d/)).not.toBeInTheDocument();
  });

  it('labels provisional values and their evidence', () => {
    render(
      <MetricCard
        label="Current deficit"
        metric={{ availability: 'provisional', value: '2.0', unit: 'MLD' }}
        evidence="synthetic"
        definition="Demand minus reliable supply."
      />,
    );
    expect(screen.getByText('2.0')).toBeInTheDocument();
    expect(screen.getByText('Provisional')).toBeInTheDocument();
    expect(screen.getByText('Synthetic demo data')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'About current deficit' }),
    ).toHaveAccessibleDescription('Demand minus reliable supply.');
  });
});

describe('Tabs', () => {
  const items = [
    { id: 'summary', label: 'Summary', content: <p>Summary body</p> },
    { id: 'sources', label: 'Data Sources', content: <p>Sources body</p> },
    { id: 'assumptions', label: 'Assumptions', content: <p>Assumptions body</p> },
  ];

  it('uses roving tabindex and Arrow/Home/End keys', () => {
    render(<Tabs label="Details" items={items} />);
    const [summary, sources, assumptions] = screen.getAllByRole('tab');
    expect(summary).toHaveAttribute('tabindex', '0');
    expect(sources).toHaveAttribute('tabindex', '-1');

    fireEvent.keyDown(summary!, { key: 'ArrowRight' });
    expect(sources).toHaveFocus();
    expect(sources).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Sources body')).toBeVisible();
    expect(screen.getByText('Summary body')).not.toBeVisible();

    fireEvent.keyDown(sources!, { key: 'End' });
    expect(assumptions).toHaveFocus();
    fireEvent.keyDown(assumptions!, { key: 'ArrowRight' });
    expect(summary).toHaveFocus();
    fireEvent.keyDown(summary!, { key: 'ArrowLeft' });
    expect(assumptions).toHaveFocus();
    fireEvent.keyDown(assumptions!, { key: 'Home' });
    expect(summary).toHaveFocus();
  });

  it('links each panel to its tab', () => {
    render(<Tabs label="Details" items={items} />);
    expect(screen.getByRole('tabpanel', { name: 'Summary' })).toHaveTextContent('Summary body');
  });
});

describe('Accordion', () => {
  it('toggles aria-expanded and the region', () => {
    render(
      <Accordion
        defaultExpanded={['funding']}
        items={[
          { id: 'included', title: "What's included", content: <p>Included body</p> },
          { id: 'funding', title: 'Funding options', content: <p>Funding body</p> },
        ]}
      />,
    );
    const included = screen.getByRole('button', { name: /what's included/i });
    const funding = screen.getByRole('button', { name: /funding options/i });
    expect(included).toHaveAttribute('aria-expanded', 'false');
    expect(funding).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('region', { name: /funding options/i })).toBeVisible();

    fireEvent.click(included);
    expect(included).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Included body')).toBeVisible();
    fireEvent.click(funding);
    expect(screen.getByText('Funding body')).not.toBeVisible();
  });
});

describe('Tooltip', () => {
  it('opens on focus, closes on Escape and is always the trigger description', () => {
    render(<Tooltip label="About shortage days">Days with supply below demand.</Tooltip>);
    const trigger = screen.getByRole('button', { name: 'About shortage days' });
    expect(trigger).toHaveAccessibleDescription('Days with supply below demand.');
    const tip = screen.getByRole('tooltip', { hidden: true });
    fireEvent.focus(trigger);
    expect(tip).toHaveAttribute('data-open', 'true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(tip).toHaveAttribute('data-open', 'false');
  });
});

describe('Field', () => {
  it('links label, hint and actionable error to the control', () => {
    render(
      <Field label="Budget" hint="In INR" error="Choose a budget range." required>
        {(control) => <Input {...control} />}
      </Field>,
    );
    const input = screen.getByRole('textbox', { name: /budget/i });
    expect(input).toBeRequired();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('In INR Choose a budget range.');
  });
});

describe('SuggestionChips', () => {
  it('fills editable input and never selects an unavailable suggestion', () => {
    function Harness() {
      const [value, setValue] = useState('');
      return (
        <>
          <SuggestionChips
            label="Try"
            onSelect={setValue}
            suggestions={[
              { id: 'a', label: 'Demand rises 15%', value: 'Demand rises 15%' },
              {
                id: 'b',
                label: 'Groundwater falls',
                value: 'gw',
                unavailableReason: 'Needs a reviewed model.',
              },
            ]}
          />
          <input aria-label="Scenario" value={value} onChange={(e) => setValue(e.target.value)} />
        </>
      );
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /demand rises/i }));
    const input = screen.getByRole('textbox', { name: 'Scenario' });
    expect(input).toHaveValue('Demand rises 15%');
    fireEvent.change(input, { target: { value: 'Demand rises 20%' } });
    expect(input).toHaveValue('Demand rises 20%');

    const locked = screen.getByRole('button', { name: /groundwater falls/i });
    expect(locked).toHaveAttribute('aria-disabled', 'true');
    expect(locked).toHaveAccessibleDescription('Needs a reviewed model.');
    fireEvent.click(locked);
    expect(input).toHaveValue('Demand rises 20%');
  });
});

describe('charts', () => {
  const data = {
    title: 'Deficit',
    description: 'Two series',
    unit: 'MLD',
    categories: ['2026', '2027'],
    series: [
      { id: 'a', label: 'Plan A', values: [2, 1.5] },
      { id: 'b', label: 'Baseline', values: [2, null] },
    ],
  };

  it('bar chart exposes a labelled image and a table where missing values read "Unavailable"', () => {
    render(<BarChart data={data} />);
    expect(screen.getByRole('img', { name: 'Deficit' })).toHaveAccessibleDescription('Two series');
    fireEvent.click(screen.getByRole('button', { name: /show table/i }));
    const table = screen.getByRole('table', { name: /deficit/i });
    const row2027 = within(table).getByRole('row', { name: /2027/ });
    expect(within(row2027).getByText('Unavailable')).toBeInTheDocument();
    expect(within(row2027).queryByText('0')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /show chart/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('line chart breaks the line at missing values instead of drawing zero', () => {
    const { container } = render(<LineChart data={data} />);
    const baselinePoints = container.querySelectorAll('g:last-of-type circle');
    expect(baselinePoints).toHaveLength(1);
  });

  it.each([
    [0, 7.3, [0, 2, 4, 6, 8]],
    [0, 1, [0, 0.5, 1]],
    [0, 0.3, [0, 0.1, 0.2, 0.3]],
    [-3, 5, [-4, -2, 0, 2, 4, 6]],
    [5, 5, [0, 2, 4, 6]],
  ])('niceTicks(%d, %d)', (min, max, expected) => {
    expect(niceTicks(min, max)).toEqual(expected);
  });
});
