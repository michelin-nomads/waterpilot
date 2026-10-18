import { useId, useState, type ReactNode } from 'react';

import {
  Accordion,
  Badge,
  Button,
  ErrorSummary,
  Field,
  Input,
  Select,
  Textarea,
  Tooltip,
  type FieldError,
} from '../../components';
import type {
  InterventionCatalogueQuery,
  Priority,
  SiteRestriction,
  SiteScale,
  TargetMode,
  Unit,
} from '../../graphql/generated/graphql';
import { PRESETS, type DraftErrors, type GoalDraft } from './goalDraft';
import {
  KIND_LABEL,
  MODE_LABEL,
  MODES,
  PRIORITY_LABEL,
  RESTRICTION_LABEL,
  SCALE_LABEL,
  UNIT_LABEL,
  UNITS,
} from './goalLabels';
import styles from './Goals.module.scss';
import { GoalChoices } from './GoalChoices';
import { GoalSummary } from './GoalSummary';
import { GoalRangeField } from './GoalRangeField';

type Catalogue = InterventionCatalogueQuery['interventionCatalogue'];

interface GoalFormProps {
  draft: GoalDraft;
  onChange: (draft: GoalDraft) => void;
  errors: DraftErrors;
  catalogue: Catalogue | null;
  /** The location's currency; budgets in another currency are never converted. */
  areaCurrency: string | null;
  actions: ReactNode;
  disabled?: boolean;
  onCompare: () => void;
}

const SECTION_FIELDS: Record<string, readonly string[]> = {
  finance: [
    'currency',
    'tariffAmount',
    'tariffCurrency',
    'tariffLitres',
    'tariffNote',
    'contingencyPercent',
  ],
  site: [
    'scale',
    'roofArea',
    'openGround',
    'storageSpace',
    'pipedSupply',
    'groundwaterUse',
    'restrictions',
  ],
  also: ['also'],
};

const SITE_FIELDS = {
  roofArea: 'Roof area you can collect from (m²)',
  openGround: 'Open or unpaved ground (m²)',
  storageSpace: 'Space for a tank',
  pipedSupply: 'Piped water supply',
  groundwaterUse: 'Borewell or groundwater use',
} as const;
type SiteFeature = keyof typeof SITE_FIELDS;

/** Accordion section holding a field, so a field with an error is never left hidden. */
function sectionOf(field: string): string | null {
  if (field.startsWith('funding.')) return 'finance';
  if (field.startsWith('estimates.')) return 'estimates';
  return Object.keys(SECTION_FIELDS).find((s) => SECTION_FIELDS[s]?.includes(field)) ?? null;
}

function presetFor(draft: GoalDraft): string | null {
  if (!draft.kind) return null;
  return PRESETS.find((p) => p.apply({ ...draft, kind: null }).kind === draft.kind)?.id ?? null;
}

export function GoalForm({
  draft,
  onChange,
  errors,
  actions,
  disabled = false,
  onCompare,
}: GoalFormProps) {
  const id = useId();
  const fid = (name: string) => `${id}-${name.replace(/\./g, '-')}`;
  const set = <K extends keyof GoalDraft>(key: K, value: GoalDraft[K]) =>
    onChange({ ...draft, [key]: value });
  const toggle = <T extends string>(key: 'also' | 'restrictions', value: T) => {
    const list = draft[key] as readonly string[];
    set(key, (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]) as never);
  };
  const [open, setOpen] = useState<string[]>([]);

  const [selectedAreas, setSelectedAreas] = useState({
    roofArea: Boolean(draft.roofArea.trim()),
    openGround: Boolean(draft.openGround.trim()),
  });
  const kind = draft.kind;
  const modes = kind ? MODES[kind] : [];
  const units = kind ? UNITS[kind] : [];
  const ratio = draft.mode === 'RELATIVE_REDUCTION' || draft.unit === 'RATIO';
  const summary: FieldError[] = Object.entries(errors).flatMap(([field, message]) =>
    message ? [{ fieldId: fid(field), message }] : [],
  );

  const withErrors = Object.keys(errors)
    .filter((f) => errors[f])
    .map(sectionOf)
    .filter((s): s is string => s !== null);
  const expanded = [...new Set([...open, ...withErrors])];
  const selectedPreset = presetFor(draft);
  const example = kind === 'CUSTOM' ? undefined : PRESETS.find((p) => p.id === selectedPreset);

  const countPill = (count: number, unit: string) => (
    <Badge tone={count ? 'accent' : 'neutral'}>
      {count ? `${count} ${unit} · Optional` : 'Optional'}
    </Badge>
  );
  const siteCount =
    [
      draft.scale,
      draft.roofArea,
      draft.openGround,
      draft.storageSpace,
      draft.pipedSupply,
      draft.groundwaterUse,
    ].filter((value) => value.trim()).length + draft.restrictions.length;

  const sections = kind
    ? [
        {
          id: 'site',
          title: 'Site constraints',
          icon: 'adjustments' as const,
          trailing: countPill(siteCount, 'specified'),
          content: (
            <div className={styles.stack}>
              <div className={styles.siteScale}>
                <Field id={fid('scale')} label="Scale" error={errors.scale}>
                  {(p) => (
                    <Select
                      {...p}
                      value={draft.scale}
                      onChange={(e) => set('scale', e.target.value as SiteScale | '')}
                    >
                      <option value="">Not sure</option>
                      {(Object.keys(SCALE_LABEL) as SiteScale[]).map((value) => (
                        <option key={value} value={value}>
                          {SCALE_LABEL[value]}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              </div>
              <fieldset className={styles.siteFieldPicker}>
                <legend className={styles.hidden}>Available site features</legend>
                <div className={styles.siteFieldOptions}>
                  {(Object.keys(SITE_FIELDS) as SiteFeature[]).map((key) => {
                    if (key === 'roofArea' || key === 'openGround') {
                      const checked = selectedAreas[key] || Boolean(errors[key]);
                      return (
                        <div key={key} className={styles.siteFeatureRow}>
                          <label>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                setSelectedAreas({ ...selectedAreas, [key]: e.target.checked });
                                if (!e.target.checked) set(key, '');
                              }}
                            />
                            {SITE_FIELDS[key]}
                          </label>
                          {checked && (
                            <Field
                              id={fid(key)}
                              label={SITE_FIELDS[key]}
                              hideLabel
                              error={errors[key]}
                            >
                              {(p) => (
                                <Input
                                  {...p}
                                  inputMode="decimal"
                                  placeholder={key === 'roofArea' ? 'e.g. 120' : 'e.g. 50'}
                                  value={draft[key]}
                                  onChange={(e) => set(key, e.target.value)}
                                />
                              )}
                            </Field>
                          )}
                        </div>
                      );
                    }
                    return (
                      <div key={key} className={styles.siteFeatureRow} data-no-area="true">
                        <label>
                          <input
                            type="checkbox"
                            checked={draft[key] === 'yes'}
                            onChange={(e) => set(key, e.target.checked ? 'yes' : 'no')}
                          />
                          {SITE_FIELDS[key]}
                        </label>
                      </div>
                    );
                  })}
                </div>
              </fieldset>
              <fieldset className={styles.checks}>
                <legend className={styles.legend}>Activities not allowed on your site</legend>
                {(Object.keys(RESTRICTION_LABEL) as SiteRestriction[]).map((r) => (
                  <label key={r} className={styles.check}>
                    <input
                      type="checkbox"
                      checked={draft.restrictions.includes(r)}
                      onChange={() => toggle('restrictions', r)}
                    />
                    {RESTRICTION_LABEL[r]}
                  </label>
                ))}
              </fieldset>
            </div>
          ),
        },
      ]
    : [];

  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!disabled) onCompare();
      }}
    >
      <ErrorSummary errors={summary} />
      <div className={styles.editorLayout}>
        <fieldset className={styles.mainFields} disabled={disabled}>
          <section className={styles.panel}>
            <div className={styles.sectionHead}>
              <h2 id={fid('kind')} tabIndex={-1}>
                <span className={styles.sectionNumber}>01</span>Choose your primary goal{' '}
                <span aria-hidden="true">*</span>
              </h2>
              <span className={styles.muted}>Choose one</span>
            </div>
            <GoalChoices draft={draft} onChange={onChange} />
            {kind === 'CUSTOM' && (
              <div className={styles.customGoalFields}>
                <Field
                  id={fid('description')}
                  label="Describe your goal"
                  error={errors.description}
                  required
                >
                  {(p) => (
                    <Textarea
                      {...p}
                      rows={1}
                      className={styles.customDescription}
                      maxLength={2000}
                      placeholder="Describe the outcome you want for your community"
                      value={draft.description}
                      onChange={(e) => set('description', e.target.value)}
                    />
                  )}
                </Field>
              </div>
            )}
          </section>
          {kind && (
            <section className={styles.panel}>
              <div className={styles.sectionHead}>
                <h2>
                  <span className={styles.sectionNumber}>02</span>Make it measurable
                </h2>
                <span className={styles.muted}>Optional</span>
              </div>
              <fieldset className={styles.target}>
                <legend className={styles.hidden}>Target for: {KIND_LABEL[kind]}</legend>
                <div className={styles.grid}>
                  <Field id={fid('mode')} label="Kind of target">
                    {(p) => (
                      <Select
                        {...p}
                        value={draft.mode ?? ''}
                        onChange={(e) => {
                          const mode = (e.target.value || null) as TargetMode | null;
                          onChange({
                            ...draft,
                            mode,
                            unit: mode === 'RELATIVE_REDUCTION' ? 'RATIO' : (units[0] ?? null),
                          });
                        }}
                      >
                        <option value="">No numeric target</option>
                        {modes.map((m) => (
                          <option key={m} value={m}>
                            {MODE_LABEL[m]}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                  {draft.mode && (
                    <Field
                      id={fid('targetValue')}
                      label={
                        ratio
                          ? 'Target (%)'
                          : `Target (${kind === 'CUSTOM' && draft.unit === 'COUNT' ? 'count' : (UNIT_LABEL[draft.unit ?? 'COUNT'] ?? '')})`
                      }
                      labelAction={
                        <Tooltip label="About this target">
                          {draft.mode === 'RELATIVE_REDUCTION'
                            ? 'A percentage reduction compared with your baseline. This is not a percentage-point reduction.'
                            : kind === 'REDUCE_SHORTAGE'
                              ? 'The maximum shortage days in a year. Assessing it needs a full year of daily supply and demand records.'
                              : kind === 'IMPROVE_GROUNDWATER'
                                ? 'Depth in metres below ground. A smaller depth means groundwater is closer to the surface.'
                                : 'An absolute target in the chosen unit. Availability of baseline and model evidence determines whether it can be assessed.'}
                        </Tooltip>
                      }
                      error={errors.targetValue}
                      required
                    >
                      {(p) => (
                        <Input
                          {...p}
                          inputMode="decimal"
                          placeholder={ratio ? 'e.g. 25' : 'Enter target value'}
                          value={draft.targetValue}
                          onChange={(e) => set('targetValue', e.target.value)}
                        />
                      )}
                    </Field>
                  )}
                  {draft.mode === 'ABSOLUTE_LEVEL' && units.length > 1 && (
                    <Field id={fid('unit')} label="Unit" required>
                      {(p) => (
                        <Select
                          {...p}
                          value={draft.unit ?? ''}
                          onChange={(e) => set('unit', e.target.value as Unit)}
                        >
                          {units.map((u) => (
                            <option key={u} value={u}>
                              {kind === 'CUSTOM' && u === 'COUNT' ? 'count' : (UNIT_LABEL[u] ?? u)}
                            </option>
                          ))}
                        </Select>
                      )}
                    </Field>
                  )}
                  {draft.mode && (kind === 'IMPROVE_WATER_QUALITY' || kind === 'CUSTOM') && (
                    <Field
                      id={fid('targetParameter')}
                      label="What will you measure?"
                      labelAction={
                        <Tooltip label="About the target parameter">
                          {kind === 'CUSTOM'
                            ? 'Name your own measured quantity using lowercase letters and underscores. Assessing it needs matching baseline data and a supported model.'
                            : 'Use the parameter name that matches your reading, such as turbidity or nitrate.'}
                        </Tooltip>
                      }
                      required={kind === 'IMPROVE_WATER_QUALITY'}
                      error={errors.targetParameter}
                    >
                      {(p) => (
                        <Input
                          {...p}
                          placeholder={
                            kind === 'CUSTOM' ? 'Enter a quantity to measure' : 'e.g. turbidity'
                          }
                          value={draft.targetParameter}
                          onChange={(e) => set('targetParameter', e.target.value)}
                        />
                      )}
                    </Field>
                  )}
                </div>
              </fieldset>
              <div className={styles.exampleTarget}>
                {example && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className={styles.textAction}
                    title="Fill an editable example target."
                    onClick={() => onChange(example.apply(draft))}
                  >
                    Use example: {example.title}
                  </Button>
                )}
              </div>
            </section>
          )}
          {kind && (
            <section className={styles.panel} aria-label="Budget and timing">
              <div className={styles.sectionHead}>
                <h2>
                  <span className={styles.sectionNumber}>03</span>Budget & timing
                </h2>
                <span className={styles.muted}>Optional</span>
              </div>
              <div className={styles.grid}>
                <GoalRangeField
                  id={fid('budgetAmount')}
                  label={`Maximum implementation budget (${draft.currency || 'currency'})`}
                  value={draft.budgetAmount}
                  onChange={(v) => set('budgetAmount', v)}
                  error={errors.budgetAmount}
                  max={10000000}
                  step={10000}
                  placeholder="Amount"
                  sliderLabel="Budget slider"
                />
                <GoalRangeField
                  id={fid('timelineDays')}
                  label="Preferred implementation time (days)"
                  value={draft.timelineDays}
                  onChange={(v) => set('timelineDays', v)}
                  error={errors.timelineDays}
                  min={1}
                  max={730}
                  placeholder="Days"
                  sliderLabel="Implementation slider"
                />
                <GoalRangeField
                  id={fid('horizonDays')}
                  label="Compare benefits over (days)"
                  value={draft.horizonDays}
                  onChange={(v) => set('horizonDays', v)}
                  error={errors.horizonDays}
                  min={1}
                  max={3650}
                  placeholder="Days"
                  sliderLabel="Benefits slider"
                />
                <Field id={fid('priority')} label="What matters most?" error={errors.priority}>
                  {(p) => (
                    <Select
                      {...p}
                      value={draft.priority}
                      onChange={(e) => set('priority', e.target.value as Priority | '')}
                    >
                      <option value="">No preference</option>
                      {(Object.keys(PRIORITY_LABEL) as Priority[]).map((value) => (
                        <option key={value} value={value}>
                          {PRIORITY_LABEL[value]}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              </div>
            </section>
          )}
          {sections.length > 0 && (
            <section className={styles.optionalDetails} aria-label="Optional site constraints">
              <Accordion
                className={styles.optionalAccordion}
                items={sections}
                headingLevel={2}
                expanded={expanded}
                onExpandedChange={setOpen}
              />
            </section>
          )}
        </fieldset>
        <GoalSummary draft={draft} />
      </div>
      {actions}
    </form>
  );
}
