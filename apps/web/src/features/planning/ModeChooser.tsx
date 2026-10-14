import { Badge } from '../../components/Badge/Badge';
import { ChoiceCards, type ChoiceOption } from '../../components/ChoiceCards/ChoiceCards';
import type { PlanningMode } from './planningMode';

const OPTIONS: readonly ChoiceOption<PlanningMode>[] = [
  {
    value: 'traditional',
    title: 'Traditional',
    description: 'Work through each step yourself.',
    icon: 'layers',
  },
  {
    value: 'agent',
    title: 'With the assistant',
    description:
      'Describe what you need and the assistant works through the steps with you, on the same plan. Availability is shown in the conversation pane; the steps stay available beside it.',
    icon: 'sparkle',
    badge: <Badge tone="neutral">Optional help</Badge>,
  },
];

interface ModeChooserProps {
  value: PlanningMode;
  onChange: (mode: PlanningMode) => void;
  legend?: string;
}

/** S2 mode choice, shared by Welcome and New report (ux-spec §5 S2). */
export function ModeChooser({
  value,
  onChange,
  legend = 'How do you want to plan?',
}: ModeChooserProps) {
  return (
    <ChoiceCards
      legend={legend}
      hint="You can switch at any time from the planning toolbar; both ways use the same plan."
      options={OPTIONS}
      value={value}
      onChange={onChange}
    />
  );
}
