import { useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';

import { Badge, Button, Field, Input, Notice, Select } from '../../components';
import { graphqlRequest } from '../../graphql/client';
import {
  PreviewScenarioDocument,
  type AdjustmentChange,
  type ScenarioComparisonFieldsFragment,
} from '../../graphql/generated/graphql';
import { queryKeys } from '../../graphql/queryKeys';
import type { SessionState } from '../../session/sessionState';
import { ScenarioRows } from './ScenarioRows';
import {
  CHANGE_LABEL,
  emptyWhatIf,
  fromAdjustments,
  PARAMETERS,
  rowOf,
  toAdjustments,
  type Parameter,
  type WhatIfDraft,
} from './plansFormat';
import styles from './Plans.module.scss';

interface Props {
  sessionId: string;
  revision: number;
  scenario: SessionState['scenario'];
  saved: ScenarioComparisonFieldsFragment;
  /** True while a scenario edit is being saved. */
  pending: boolean;
  onSave: (scenario: SessionState['scenario']) => void;
}

/**
 * The shared scenario editor. Previewing checks a scenario against the same baseline without saving
 * anything; applying saves it with the session, so plans are compared under it and the
 * chosen plan is cleared. A scenario parsed from words applies only once confirmed.
 */
export function WhatIfPanel({ sessionId, revision, scenario, saved, pending, onSave }: Props) {
  const id = useId();
  const client = useQueryClient();
  const [draft, setDraft] = useState<WhatIfDraft>(() =>
    scenario ? fromAdjustments(scenario.adjustments ?? []) : emptyWhatIf(),
  );
  const [errors, setErrors] = useState<Partial<Record<Parameter, string>>>({});
  const [preview, setPreview] = useState<{
    json: string;
    comparison: ScenarioComparisonFieldsFragment;
  } | null>(null);
  const [checking, setChecking] = useState(false);

  const current = toAdjustments(draft);
  const currentJson = current.adjustments ? JSON.stringify(current.adjustments) : null;
  const savedJson = JSON.stringify(scenario?.adjustments ?? []);
  const unsaved = currentJson !== null && currentJson !== savedJson;
  const awaiting = saved.status === 'awaiting_confirmation';

  function setRow(p: Parameter, row: Partial<WhatIfDraft[Parameter]>) {
    setDraft({ ...draft, [p]: { ...draft[p], ...row } });
    setErrors({});
  }

  async function runPreview() {
    const { adjustments, errors: local } = toAdjustments(draft);
    setErrors(local);
    if (!adjustments) return;
    const json = JSON.stringify(adjustments);
    setChecking(true);
    try {
      const result = await client.fetchQuery({
        queryKey: queryKeys.sessions.scenarioPreview(sessionId, revision, json),
        queryFn: ({ signal }) =>
          graphqlRequest(
            PreviewScenarioDocument,
            { sessionId, scenario: { adjustments } },
            { signal },
          ),
      });
      const found: Partial<Record<Parameter, string>> = {};
      for (const e of result.previewScenario.errors) {
        const row = rowOf(e.field, adjustments);
        if (row) found[row] ??= e.message;
      }
      setErrors(found);
      const comparison = result.previewScenario.comparison;
      setPreview(comparison ? { json, comparison } : null);
    } finally {
      setChecking(false);
    }
  }

  function apply() {
    const { adjustments, errors: local } = toAdjustments(draft);
    setErrors(local);
    if (!adjustments) return;
    onSave(adjustments.length ? { adjustments, interpretedFrom: null, confirmed: true } : null);
  }

  const shown = preview && preview.json === currentJson ? preview.comparison : null;

  return (
    <section className={styles.panel} aria-labelledby={`${id}-title`}>
      <div className={styles.head}>
        <h3 id={`${id}-title`} className={styles.title}>
          Explore a what-if
        </h3>
        <Badge tone={saved.status === 'applied' ? 'accent' : 'neutral'}>
          {saved.status === 'applied'
            ? 'What-if applied to plans'
            : awaiting
              ? 'Waiting for your confirmation'
              : 'No what-if applied'}
        </Badge>
      </div>
      <p className={styles.muted}>
        Change demand, supply or rainfall to test a possible future. Preview first, then apply the
        scenario to use it in plan comparison. Your baseline stays unchanged.
      </p>
      {awaiting && scenario && (
        <Notice kind="stale" title="Confirm the what-if the agent prepared" announce={false}>
          {scenario.interpretedFrom && <p className={styles.text}>“{scenario.interpretedFrom}”</p>}
          <p className={styles.text}>
            Plans ignore it until you confirm. Check the values below first.
          </p>
          <Button
            size="sm"
            disabled={pending}
            onClick={() => onSave({ ...scenario, confirmed: true })}
          >
            Confirm what-if
          </Button>
        </Notice>
      )}
      <div className={styles.whatIf}>
        {PARAMETERS.map((p) => {
          const row = draft[p.id];
          return (
            <fieldset key={p.id} className={styles.whatIfRow}>
              <legend className={styles.legend}>{p.label}</legend>
              <Field id={`${id}-${p.id}-change`} label="Change">
                {(props) => (
                  <Select
                    {...props}
                    value={row.change}
                    onChange={(e) =>
                      setRow(p.id, { change: e.target.value as AdjustmentChange | '' })
                    }
                  >
                    <option value="">No change</option>
                    {(Object.keys(CHANGE_LABEL) as AdjustmentChange[]).map((c) => (
                      <option key={c} value={c}>
                        {c === 'SET_TO' ? `Set to (${p.unitLabel})` : CHANGE_LABEL[c]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              {row.change && (
                <Field
                  id={`${id}-${p.id}-value`}
                  label={row.change === 'SET_TO' ? `Value (${p.unitLabel})` : 'Percentage'}
                  error={errors[p.id]}
                >
                  {(props) => (
                    <Input
                      {...props}
                      inputMode="decimal"
                      value={row.value}
                      onChange={(e) => setRow(p.id, { value: e.target.value })}
                    />
                  )}
                </Field>
              )}
            </fieldset>
          );
        })}
      </div>
      <div className={styles.actions}>
        <Button variant="secondary" onClick={() => void runPreview()} loading={checking}>
          Preview
        </Button>
        <Button onClick={apply} loading={pending} disabled={!unsaved || pending}>
          Apply scenario
        </Button>
        {scenario && (
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => {
              setDraft(emptyWhatIf());
              setPreview(null);
              onSave(null);
            }}
          >
            Remove what-if
          </Button>
        )}
      </div>
      {shown ? (
        <div className={styles.stack} data-scenario-source="preview">
          <p className={styles.muted}>Preview, not applied yet: nothing is saved.</p>
          <ScenarioRows comparison={shown} />
        </div>
      ) : saved.status !== 'none' && !unsaved ? (
        <div className={styles.stack} data-scenario-source="saved">
          <ScenarioRows comparison={saved} />
        </div>
      ) : null}
      {preview && preview.json !== currentJson && (
        <Notice kind="stale">You changed the what-if after previewing it. Preview it again.</Notice>
      )}
    </section>
  );
}
