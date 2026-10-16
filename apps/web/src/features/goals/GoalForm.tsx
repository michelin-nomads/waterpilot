import { useId, useState, type ReactNode } from 'react';

import {
  Accordion,
  Button,
  ChoiceCards,
  ErrorSummary,
  Field,
  Input,
  Select,
  Textarea,
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

type Catalogue = InterventionCatalogueQuery['interventionCatalogue'];

interface GoalFormProps {
  draft: GoalDraft;
  onChange: (draft: GoalDraft) => void;
  errors: DraftErrors;
  catalogue: Catalogue | null;
  /** The location's currency; budgets in another currency are never converted. */
  areaCurrency: string | null;
  actions: ReactNode;
}

const ESTIMATE_FIELDS = [
  'costLow',
  'costHigh',
  'buildLow',
  'buildHigh',
] as const satisfies readonly (keyof EstimateDraft)[];

const SECTION_FIELDS: Record<string, readonly string[]> = {
  constraints: ['currency', 'horizonDays', 'priority'],
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
  const primaryGoalIds = ['shortage', 'tanker', 'bills'];
  const otherGoals = PRESETS.filter((preset) => !primaryGoalIds.includes(preset.id));
  const selectedPreset = presetFor(draft);
  const otherGoalSelected = otherGoals.some((preset) => preset.id === selectedPreset);
  const [moreGoalsOpen, setMoreGoalsOpen] = useState(false);

  const sections = kind
    ? [
        {
          id: 'constraints',
          title: 'Additional planning constraints',
          summary: 'Optional. Set the planning horizon, currency and priority.',
          content: (
            <div className={styles.grid}>
              <Field
                id={fid('currency')}
                label="Currency"
                hint={
                  areaCurrency
                    ? `This location uses ${areaCurrency}. Amounts are never converted.`
                    : 'Amounts are never converted between currencies.'
                }
                error={errors.currency}
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
              <Field
                id={fid('horizonDays')}
                label="Planning horizon (days)"
                hint="How long benefits should count, separate from build time."
                error={errors.horizonDays}
              >
                {(p) => (
                  <Input
                    {...p}
                    inputMode="numeric"
                    value={draft.horizonDays}
                    onChange={(e) => set('horizonDays', e.target.value)}
                  />
                )}
              </Field>
              <Field id={fid('priority')} label="Priority" error={errors.priority}>
                {(p) => (
                  <Select
                    {...p}
                    value={draft.priority}
                    onChange={(e) => set('priority', e.target.value as Priority | '')}
                  >
                    <option value="">No preference</option>
                    {(Object.keys(PRIORITY_LABEL) as Priority[]).map((v) => (
                      <option key={v} value={v}>
                        {PRIORITY_LABEL[v]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
          ),
        },
        {
          id: 'site',
          title: 'Your site',
          summary: 'What is there decides which measures can be used. Leave unknown blank.',
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
          id: 'also',
          title: 'Other goals to balance',
          summary:
            kind === 'CUSTOM'
              ? 'Pick the goals closest to yours so measures can be matched.'
              : 'Optional. Checked for conflicts with your main goal.',
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
          title: 'Your own estimates',
          summary:
            'Optional. No sourced costs or build times exist for this location; yours are labelled as yours.',
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
                            costLow: `Lowest cost (${draft.currency})`,
                            costHigh: `Highest cost (${draft.currency})`,
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
                            value={e[f]}
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
    <form className={styles.form} noValidate onSubmit={(e) => e.preventDefault()}>
      <ErrorSummary errors={summary} />
      <div id={fid('kind')} tabIndex={-1}>
        <ChoiceCards
          legend="What do you want to achieve?"
          hint="Choose a goal to compare against your baseline. Selecting a goal does not promise it is achievable."
          options={PRESETS.filter((p) => primaryGoalIds.includes(p.id)).map((p) => ({
            value: p.id,
            title: p.title,
            description: p.description,
          }))}
          value={selectedPreset && primaryGoalIds.includes(selectedPreset) ? selectedPreset : null}
          onChange={(presetId) => {
            const preset = PRESETS.find((p) => p.id === presetId);
            if (preset) onChange(preset.apply({ ...draft, targetParameter: '', also: [] }));
          }}
          columns={3}
          presentation="featured"
        />
      </div>
      <details
        className={styles.otherGoals}
        open={moreGoalsOpen || otherGoalSelected}
        onToggle={(event) => setMoreGoalsOpen(event.currentTarget.open)}
      >
        <summary>More goals and constraints</summary>
        <ChoiceCards
          legend="Other supported goals"
          options={otherGoals.map((p) => ({
            value: p.id,
            title: p.title,
            description: p.description,
          }))}
          value={otherGoalSelected ? selectedPreset : null}
          onChange={(presetId) => {
            const preset = PRESETS.find((p) => p.id === presetId);
            if (preset) onChange(preset.apply({ ...draft, targetParameter: '', also: [] }));
          }}
          columns={2}
        />
      </details>
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
      {kind && (
        <div className={styles.goalLimits} role="group" aria-label="Optional budget and timeframe">
          <Field
            id={fid('budgetAmount')}
            label={`Budget (${draft.currency || 'currency'})`}
            hint="Optional. Whole amount without commas or symbols. Amounts are never converted."
            error={errors.budgetAmount}
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
          <Field
            id={fid('timelineDays')}
            label="Timeframe (maximum build days)"
            hint="Optional. How long implementation may take."
            error={errors.timelineDays}
          >
            {(p) => (
              <Input
                {...p}
                inputMode="numeric"
                value={draft.timelineDays}
                onChange={(e) => set('timelineDays', e.target.value)}
              />
            )}
          </Field>
        </div>
      )}
      {kind && (
        <fieldset className={styles.target}>
          <legend className={styles.legend}>Target for: {KIND_LABEL[kind]}</legend>
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
                label={ratio ? 'Target (%)' : `Target (${UNIT_LABEL[draft.unit ?? 'COUNT'] ?? ''})`}
                hint={
                  draft.mode === 'RELATIVE_REDUCTION'
                    ? 'How much lower than your baseline, for example 30.'
                    : kind === 'REDUCE_SHORTAGE'
                      ? 'At most this many shortage days in a year.'
                      : undefined
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
                label="Parameter"
                hint="Lowercase name, for example turbidity or nitrate."
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
      )}
      {sections.length > 0 && (
        <Accordion
          items={sections}
          headingLevel={3}
          expanded={expanded}
          onExpandedChange={setOpen}
        />
      )}
      {actions}
    </form>
  );
}
