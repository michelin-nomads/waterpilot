import { Badge } from '../../components/Badge/Badge';
import { ChoiceCards, type ChoiceOption } from '../../components/ChoiceCards/ChoiceCards';
import { PLANNING_MODE_OPTIONS, type PlanningMode } from './planningMode';

const OPTIONS: readonly ChoiceOption<PlanningMode>[] = PLANNING_MODE_OPTIONS.map((option) => ({
  value: option.id,
  title: option.label,
  description: option.description,
  icon: option.icon,
  ...(option.id === 'agent' ? { badge: <Badge tone="neutral">Optional help</Badge> } : {}),
}));

interface ModeChooserProps {
  value: PlanningMode | null;
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
      hint="You can switch modes any time from the planning header without losing your work."
      options={OPTIONS}
      value={value}
      onChange={onChange}
      presentation="featured"
    />
  );
}
