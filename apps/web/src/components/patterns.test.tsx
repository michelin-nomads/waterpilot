import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';

import { Button } from './Button/Button';
import { ChoiceCards, type ChoiceOption } from './ChoiceCards/ChoiceCards';
import { ErrorSummary } from './ErrorSummary/ErrorSummary';
import { Field, Input } from './Field/Field';
import { Notice } from './Notice/Notice';
import { StaleBanner } from './StatePanel/StatePanel';
import { StepActions } from './StepActions/StepActions';

describe('Notice', () => {
  it('announces politely by default and keeps its action usable', () => {
    const onAction = vi.fn();
    render(
      <Notice
        kind="budget"
        title="Assistant paused"
        action={<Button onClick={onAction}>Use Traditional mode</Button>}
      >
        The assistant has reached today&apos;s usage limit. Traditional mode still works.
      </Notice>,
    );
    const notice = screen.getByRole('status');
    expect(notice).toHaveAttribute('data-notice', 'budget');
    expect(within(notice).getByText('Assistant paused')).toBeInTheDocument();
    fireEvent.click(within(notice).getByRole('button', { name: 'Use Traditional mode' }));
    expect(onAction).toHaveBeenCalledOnce();
  });

  it('can be static for conditions present on load (e.g. archived)', () => {
    render(
      <Notice kind="archived" announce={false}>
        This community is archived. You can read its reports; joining is closed.
      </Notice>,
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByText(/archived/)).toBeInTheDocument();
  });

  it('StaleBanner is a stale Notice with a Refresh action', () => {
    const onRefresh = vi.fn();
    render(
      <StaleBanner onRefresh={onRefresh}>Inputs changed since this was calculated.</StaleBanner>,
    );
    expect(screen.getByRole('status')).toHaveAttribute('data-notice', 'stale');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(onRefresh).toHaveBeenCalledOnce();
  });
});

describe('ErrorSummary', () => {
  function Form() {
    const [errors, setErrors] = useState<{ fieldId: string; message: string }[]>([]);
    const nameError = errors.find((e) => e.fieldId === 'community-name')?.message;
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setErrors([
            { fieldId: 'community-name', message: 'Name: enter 3 to 80 characters' },
            { fieldId: 'community-place', message: 'Place: choose a location' },
          ]);
        }}
      >
        <ErrorSummary errors={errors} />
        <Field id="community-name" label="Name" error={nameError}>
          {(control) => <Input {...control} />}
        </Field>
        <Field id="community-place" label="Place">
          {(control) => <Input {...control} />}
        </Field>
        <button type="submit">Create community</button>
      </form>
    );
  }

  it('renders nothing without errors, takes focus on submit and links to fields', () => {
    render(<Form />);
    expect(screen.queryByText('Check these fields')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Create community' }));
    const heading = screen.getByRole('heading', { name: 'Check these fields' });
    const summary = heading.parentElement as HTMLElement;
    expect(summary).toHaveFocus();
    expect(summary).toHaveAccessibleName('Check these fields');

    fireEvent.click(screen.getByRole('link', { name: 'Place: choose a location' }));
    expect(screen.getByLabelText('Place')).toHaveFocus();

    const name = screen.getByLabelText('Name');
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(name).toHaveAccessibleDescription('Name: enter 3 to 80 characters');
  });
});

describe('ChoiceCards', () => {
  const options: ChoiceOption<'traditional' | 'assistant'>[] = [
    { value: 'traditional', title: 'Traditional', description: 'Work through each step yourself.' },
    {
      value: 'assistant',
      title: 'With the assistant',
      description: 'Ask questions; the same calculations fill in the steps.',
      disabledReason: 'The assistant is not available in this build.',
    },
  ];

  function Chooser() {
    const [value, setValue] = useState<'traditional' | 'assistant' | null>(null);
    return (
      <ChoiceCards
        legend="How do you want to plan?"
        options={options}
        value={value}
        onChange={setValue}
      />
    );
  }

  it('is a named radio group with descriptions and an explained unavailable option', () => {
    render(<Chooser />);
    const group = screen.getByRole('group', { name: 'How do you want to plan?' });
    const traditional = within(group).getByRole('radio', { name: /traditional/i });
    const assistant = within(group).getByRole('radio', { name: /with the assistant/i });

    expect(traditional).not.toBeChecked();
    expect(traditional).toHaveAccessibleDescription('Work through each step yourself.');
    expect(assistant).toBeDisabled();
    expect(assistant).toHaveAccessibleDescription(
      'Ask questions; the same calculations fill in the steps. The assistant is not available in this build.',
    );

    fireEvent.click(traditional);
    expect(traditional).toBeChecked();
  });

  it('never reports a change for an unavailable option', () => {
    const onChange = vi.fn();
    render(<ChoiceCards legend="Mode" options={options} value="traditional" onChange={onChange} />);
    // jsdom flips `checked` on direct clicks even when disabled; the contract is the callback.
    fireEvent.click(screen.getByRole('radio', { name: /with the assistant/i }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('StepActions', () => {
  it('renders one primary with secondary and back actions and a linked note', () => {
    render(
      <StepActions
        back={<Button variant="ghost">Back to goal</Button>}
        secondary={<Button variant="secondary">View details</Button>}
        primary={
          <Button aria-disabled="true" aria-describedby="plan-note">
            Review selected plan
          </Button>
        }
        note={<p id="plan-note">Choose a plan to continue.</p>}
      />,
    );
    const primary = screen.getByRole('button', { name: 'Review selected plan' });
    expect(primary).toHaveAccessibleDescription('Choose a plan to continue.');
    const buttons = screen.getAllByRole('button').map((b) => b.textContent);
    expect(buttons).toEqual(['Back to goal', 'View details', 'Review selected plan']);
  });
});
