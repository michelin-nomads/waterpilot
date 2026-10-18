import { useId, useState, type ReactNode } from 'react';

import {
  Accordion,
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
  GoalAssessmentFieldsFragment,
  Priority,
  SiteRestriction,
  SiteScale,
  TargetMode,
  Unit,
} from '../../graphql/generated/graphql';
import {
  effectsField,
  PRESETS,
  type DraftErrors,
  type EffectDraft,
  type EstimateDraft,
  type GoalDraft,
  type YesNo,
} from './goalDraft';
import {
  KIND_LABEL,
  MODE_LABEL,
  MODES,
  PRIORITY_LABEL,
  RESTRICTION_LABEL,
  SCALE_LABEL,
  STANDARD_KINDS,
  UNIT_LABEL,
  UNITS,
} from './goalLabels';
import styles from './Goals.module.scss';
import { GoalChoices } from './GoalChoices';
import { GoalSummary } from './GoalSummary';
import { GoalDurationField } from './GoalDurationField';
import { FinancialInputs } from './FinancialInputs';

type Catalogue = InterventionCatalogueQuery['interventionCatalogue'];

interface GoalFormProps {
  draft: GoalDraft;
  onChange: (draft: GoalDraft) => void;
  errors: DraftErrors;
  catalogue: Catalogue | null;
  /** The location's currency; budgets in another currency are never converted. */
  areaCurrency: string | null;
  actions: ReactNode;
  assessment?: GoalAssessmentFieldsFragment | null;
  disabled?: boolean;
  onCompare: () => void;
}

const ESTIMATE_FIELDS = [
  'costLow',
  'costHigh',
  'costCurrency',
  'recurringLow',
  'recurringHigh',
  'recurringCurrency',
  'buildLow',
  'buildHigh',
] as const satisfies readonly (keyof EstimateDraft)[];

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

const YES_NO_LABEL = {
  storageSpace: 'Space for a tank?',
  pipedSupply: 'Piped water supply?',
  groundwaterUse: 'Use a borewell or other groundwater?',
} as const;

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
  catalogue,
  areaCurrency,
  actions,
  assessment,
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
  const [estimateFor, setEstimateFor] = useState('');
  const [open, setOpen] = useState<string[]>([]);

  const kind = draft.kind;
  const modes = kind ? MODES[kind] : [];
  const units = kind ? UNITS[kind] : [];
  const ratio = draft.mode === 'RELATIVE_REDUCTION' || draft.unit === 'RATIO';
  const interventions = catalogue?.interventions ?? [];
  const nameOf = (iid: string) => interventions.find((i) => i.id === iid)?.name ?? iid;
  const effectInputsOf = (iid: string) =>
    interventions.find((i) => i.id === iid)?.effectInputs ?? [];
  const setEffect = (
    i: number,
    spec: { key: string; unit: Unit },
    side: 'low' | 'high',
    value: string,
  ) =>
    set(
      'estimates',
      draft.estimates.map((x, j) => {
        if (j !== i) return x;
        const found = x.effects.find((f) => f.key === spec.key);
        const next: EffectDraft = {
          ...(found ?? { key: spec.key, unit: spec.unit, low: '', high: '' }),
          [side]: value,
        };
        return {
          ...x,
          effects: found
            ? x.effects.map((f) => (f.key === spec.key ? next : f))
            : [...x.effects, next],
        };
      }),
    );

  const summary: FieldError[] = Object.entries(errors).flatMap(([field, message]) =>
    message ? [{ fieldId: fid(field), message }] : [],
  );

  const withErrors = Object.keys(errors)
    .filter((f) => errors[f])
    .map(sectionOf)
    .filter((s): s is string => s !== null);
  const expanded = [...new Set([...open, ...withErrors])];
  const selectedPreset = presetFor(draft);
  const example = PRESETS.find((p) => p.id === selectedPreset && p.apply(draft).mode !== null);

  const sections = kind
    ? [
        {
          id: 'site',
          title: 'Site constraints',
          icon: 'adjustments' as const,
          summary: draft.restrictions.length
            ? `${draft.restrictions.length} restrictions specified`
            : 'Optional · unknown details stay unknown',
          content: (
            <div className={styles.stack}>
              <div className={styles.grid}>
                <Field id={fid('scale')} label="Scale" error={errors.scale}>
                  {(p) => (
                    <Select
                      {...p}
                      value={draft.scale}
                      onChange={(e) => set('scale', e.target.value as SiteScale | '')}
                    >
                      <option value="">Not sure</option>
                      {(Object.keys(SCALE_LABEL) as SiteScale[]).map((v) => (
                        <option key={v} value={v}>
                          {SCALE_LABEL[v]}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field
                  id={fid('roofArea')}
                  label="Roof area you can collect from (m²)"
                  error={errors.roofArea}
                >
                  {(p) => (
                    <Input
                      {...p}
                      inputMode="decimal"
                      value={draft.roofArea}
                      onChange={(e) => set('roofArea', e.target.value)}
                    />
                  )}
                </Field>
                <Field
                  id={fid('openGround')}
                  label="Open or unpaved ground (m²)"
                  error={errors.openGround}
                >
                  {(p) => (
                    <Input
                      {...p}
                      inputMode="decimal"
                      value={draft.openGround}
                      onChange={(e) => set('openGround', e.target.value)}
                    />
                  )}
                </Field>
                {(['storageSpace', 'pipedSupply', 'groundwaterUse'] as const).map((key) => (
                  <Field key={key} id={fid(key)} label={YES_NO_LABEL[key]}>
                    {(p) => (
                      <Select
                        {...p}
                        value={draft[key]}
                        onChange={(e) => set(key, e.target.value as YesNo)}
                      >
                        <option value="">Not sure</option>
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </Select>
                    )}
                  </Field>
                ))}
              </div>
              <fieldset className={styles.checks}>
                <legend className={styles.legend}>Rule out</legend>
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
        {
          id: 'finance',
          title: 'Water costs & funding',
          icon: 'wallet' as const,
          summary: 'Optional · tariffs, contingency and funding',
          content: (
            <div className={styles.stack}>
              <Field
                id={fid('currency')}
                label="Budget currency"
                error={errors.currency}
                labelAction={
                  <Tooltip label="About budget currency">
                    {areaCurrency ? `The selected location uses ${areaCurrency}. ` : ''}Amounts
                    remain in their stated currency; no currency conversion is applied.
                  </Tooltip>
                }
              >
                {(p) => (
                  <Input
                    {...p}
                    maxLength={3}
                    value={draft.currency}
                    onChange={(e) => set('currency', e.target.value.toUpperCase())}
                  />
                )}
              </Field>
              <FinancialInputs draft={draft} onChange={onChange} errors={errors} fid={fid} />
            </div>
          ),
        },
        {
          id: 'also',
          title: 'Other goals to balance',
          summary:
            kind === 'CUSTOM'
              ? 'Match measures to your custom outcome'
              : 'Optional · up to three additional outcomes',
          content: (
            <fieldset className={styles.checks}>
              <legend className={styles.legend}>Also aim to</legend>
              {STANDARD_KINDS.filter((k) => k !== kind).map((k) => (
                <label key={k} className={styles.check}>
                  <input
                    type="checkbox"
                    checked={draft.also.includes(k)}
                    disabled={!draft.also.includes(k) && draft.also.length >= 3}
                    onChange={() => toggle('also', k)}
                  />
                  {KIND_LABEL[k]}
                </label>
              ))}
            </fieldset>
          ),
        },
        {
          id: 'estimates',
          title: 'Cost & performance assumptions',
          icon: 'chart' as const,
          summary: 'Optional · your own estimates',
          content: (
            <div className={styles.stack}>
              {draft.estimates.map((e, i) => (
                <fieldset key={e.interventionId} className={styles.estimate}>
                  <legend className={styles.legend}>{nameOf(e.interventionId)}</legend>
                  <div className={styles.grid}>
                    {ESTIMATE_FIELDS.map((f) => (
                      <Field
                        key={f}
                        id={fid(`estimates.${i}.${f}`)}
                        label={
                          {
                            costLow: `Lowest cost (${e.costCurrency || draft.currency})`,
                            costCurrency: 'Capital cost currency',
                            recurringLow: `Annual maintenance — low (${e.recurringCurrency || draft.currency})`,
                            recurringHigh: `Annual maintenance — high (${e.recurringCurrency || draft.currency})`,
                            recurringCurrency: 'Maintenance currency',
                            costHigh: `Highest cost (${e.costCurrency || draft.currency})`,
                            buildLow: 'Shortest build (days)',
                            buildHigh: 'Longest build (days)',
                          }[f]
                        }
                        error={errors[`estimates.${i}.${f}`]}
                      >
                        {(p) => (
                          <Input
                            {...p}
                            inputMode="decimal"
                            value={
                              e[f] ??
                              (f === 'costCurrency' || f === 'recurringCurrency'
                                ? draft.currency
                                : '')
                            }
                            onChange={(ev) =>
                              set(
                                'estimates',
                                draft.estimates.map((x, j) =>
                                  j === i ? { ...x, [f]: ev.target.value } : x,
                                ),
                              )
                            }
                          />
                        )}
                      </Field>
                    ))}
                  </div>
                  {effectInputsOf(e.interventionId).length > 0 ? (
                    <div className={styles.grid} role="group" aria-label="Water effect ranges">
                      {effectInputsOf(e.interventionId).map((spec, k) => {
                        const share = spec.unit === 'RATIO';
                        const suffix = share ? '%' : (UNIT_LABEL[spec.unit] ?? spec.unit);
                        const value = e.effects.find((f) => f.key === spec.key);
                        return (['low', 'high'] as const).map((side) => (
                          <Field
                            key={`${spec.key}.${side}`}
                            id={
                              k === 0 && side === 'low'
                                ? fid(effectsField(i))
                                : fid(`${effectsField(i)}.${spec.key}.${side}`)
                            }
                            label={`${spec.label} — ${side === 'low' ? 'low' : 'high'} (${suffix})`}
                            hint={
                              side === 'low' ? spec.note || (share ? 'Your own figure.' : '') : ''
                            }
                            error={k === 0 && side === 'low' ? errors[effectsField(i)] : undefined}
                          >
                            {(p) => (
                              <Input
                                {...p}
                                inputMode="decimal"
                                value={value?.[side] ?? ''}
                                onChange={(ev) => setEffect(i, spec, side, ev.target.value)}
                              />
                            )}
                          </Field>
                        ));
                      })}
                    </div>
                  ) : (
                    <p className={styles.muted}>
                      This measure&apos;s water effect is not modelled, so it is not counted when
                      plans are compared.
                    </p>
                  )}
                  <Field id={fid(`estimates.${i}.note`)} label="Where these figures come from">
                    {(p) => (
                      <Input
                        {...p}
                        maxLength={500}
                        value={e.note}
                        onChange={(ev) =>
                          set(
                            'estimates',
                            draft.estimates.map((x, j) =>
                              j === i ? { ...x, note: ev.target.value } : x,
                            ),
                          )
                        }
                      />
                    )}
                  </Field>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      set(
                        'estimates',
                        draft.estimates.filter((_, j) => j !== i),
                      )
                    }
                  >
                    Remove estimate
                  </Button>
                </fieldset>
              ))}
              <div className={styles.inline}>
                <Field id={fid('estimateFor')} label="Add an estimate for">
                  {(p) => (
                    <Select
                      {...p}
                      value={estimateFor}
                      onChange={(e) => setEstimateFor(e.target.value)}
                    >
                      <option value="">Choose a measure</option>
                      {interventions
                        .filter((i) => !draft.estimates.some((e) => e.interventionId === i.id))
                        .map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name}
                          </option>
                        ))}
                    </Select>
                  )}
                </Field>
                <Button
                  variant="secondary"
                  size="sm"
                  startIcon="plus"
                  disabled={!estimateFor}
                  onClick={() => {
                    set('estimates', [
                      ...draft.estimates,
                      {
                        interventionId: estimateFor,
                        costLow: '',
                        costHigh: '',
                        buildLow: '',
                        buildHigh: '',
                        effects: [],
                        note: '',
                      },
                    ]);
                    setEstimateFor('');
                  }}
                >
                  Add estimate
                </Button>
              </div>
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
                <span className={styles.sectionNumber}>01</span>Choose your primary goal
              </h2>
              <span className={styles.muted}>Choose one</span>
            </div>
            <GoalChoices draft={draft} onChange={onChange} />
            {kind === 'CUSTOM' && (
              <div className={styles.stack}>
                <Field
                  id={fid('description')}
                  label="Describe your goal"
                  error={errors.description}
                  required
                >
                  {(p) => (
                    <Textarea
                      {...p}
                      rows={3}
                      maxLength={2000}
                      value={draft.description}
                      onChange={(e) =>
                        onChange({ ...draft, description: e.target.value, confirmed: false })
                      }
                    />
                  )}
                </Field>
                <label className={styles.check} id={fid('confirmed')}>
                  <input
                    type="checkbox"
                    checked={draft.confirmed}
                    disabled={!draft.description.trim()}
                    onChange={(e) => set('confirmed', e.target.checked)}
                  />
                  This wording is what I mean; use it for planning.
                </label>
                {errors.confirmed && <p className={styles.error}>{errors.confirmed}</p>}
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
                        ratio ? 'Target (%)' : `Target (${UNIT_LABEL[draft.unit ?? 'COUNT'] ?? ''})`
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
                          value={draft.targetValue}
                          onChange={(e) => set('targetValue', e.target.value)}
                        />
                      )}
                    </Field>
                  )}
                  {draft.mode === 'ABSOLUTE_LEVEL' && units.length > 1 && (
                    <Field id={fid('unit')} label="Unit">
                      {(p) => (
                        <Select
                          {...p}
                          value={draft.unit ?? ''}
                          onChange={(e) => set('unit', e.target.value as Unit)}
                        >
                          {units.map((u) => (
                            <option key={u} value={u}>
                              {UNIT_LABEL[u] ?? u}
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
                          Use a lowercase parameter name, such as turbidity or nitrate. A custom
                          outcome needs a matching baseline measure and supported model to be
                          assessed.
                        </Tooltip>
                      }
                      error={errors.targetParameter}
                    >
                      {(p) => (
                        <Input
                          {...p}
                          value={draft.targetParameter}
                          onChange={(e) => set('targetParameter', e.target.value)}
                        />
                      )}
                    </Field>
                  )}
                </div>
              </fieldset>
              {example && (
                <div className={styles.exampleTarget}>
                  <span className={styles.muted}>Need a starting point?</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={styles.textAction}
                    onClick={() => onChange(example.apply(draft))}
                  >
                    Use example: {example.title}
                  </Button>
                </div>
              )}
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
                <Field
                  id={fid('budgetAmount')}
                  label={`Maximum implementation budget (${draft.currency || 'currency'})`}
                  error={errors.budgetAmount}
                  labelAction={
                    <Tooltip label="About the implementation budget">
                      Enter the maximum budget in {draft.currency || 'your stated currency'},
                      without commas or currency symbols. Leave blank for no budget limit.
                    </Tooltip>
                  }
                >
                  {(p) => (
                    <Input
                      {...p}
                      inputMode="decimal"
                      value={draft.budgetAmount}
                      onChange={(e) => set('budgetAmount', e.target.value)}
                    />
                  )}
                </Field>
                <GoalDurationField
                  id={fid('timelineDays')}
                  label="Preferred implementation time"
                  value={draft.timelineDays}
                  onChange={(value) => set('timelineDays', value)}
                  error={errors.timelineDays}
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
                <GoalDurationField
                  id={fid('horizonDays')}
                  label="Compare benefits over"
                  value={draft.horizonDays}
                  onChange={(value) => set('horizonDays', value)}
                  error={errors.horizonDays}
                  horizon
                />
              </div>
            </section>
          )}
          {sections.length > 0 && (
            <Accordion
              items={sections}
              headingLevel={3}
              expanded={expanded}
              onExpandedChange={setOpen}
            />
          )}
        </fieldset>
        <GoalSummary draft={draft} assessment={assessment} />
      </div>
      {actions}
    </form>
  );
}
