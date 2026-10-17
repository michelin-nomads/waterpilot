import { useState } from 'react';
import { Badge, Button, Field, Icon, Input, Select, Tooltip } from '../../components';
import type { CommunityBaselineInput, WaterSourceInput } from '../../graphql/generated/graphql';
import { sourceDaily } from './supplyMath';
import styles from './CommunityBaseline.module.scss';

export const NO_SOURCE_RECORD =
  'User-entered source; no supporting record or observation date supplied.';
const KINDS = {
  municipal: 'Municipal / piped water',
  tanker: 'Tanker deliveries',
  groundwater: 'Borewell / groundwater',
  rainwater: 'Rainwater used',
  other: 'Other source',
};
const METHODS = {
  daily_average: 'Daily average',
  volume_over_period: 'Volume over a period',
  tanker_deliveries: 'Tanker deliveries',
  pump_runtime: 'Pump flow × runtime',
};

export function WaterSupplyFields({
  data,
  edit,
}: {
  data: CommunityBaselineInput;
  edit: (patch: Partial<CommunityBaselineInput>) => void;
}) {
  const [active, setActive] = useState<number | null>(null);
  const changeSource = (index: number, patch: Partial<WaterSourceInput>) =>
    edit({
      sources: data.sources.map((source, i) => (i === index ? { ...source, ...patch } : source)),
      ...(patch.quantity === null ? { supplyComplete: false } : {}),
    });
  const knownTotal = data.sources.reduce((total, source) => total + (sourceDaily(source) ?? 0), 0);
  const complete =
    data.sources.length > 0 && data.sources.every((source) => sourceDaily(source) !== null);
  const addSource = () => {
    setActive(data.sources.length);
    edit({
      supplyComplete: false,
      sources: [
        ...data.sources,
        {
          name: KINDS.municipal,
          kind: 'municipal',
          method: 'daily_average',
          quantity: null,
          multiplier: '1',
          periodDays: 1,
          estimated: false,
          source: NO_SOURCE_RECORD,
        },
      ],
    });
  };
  return (
    <details className={styles.supplyAccordion} open={data.sources.length > 0 || undefined}>
      <summary className={styles.supplyHeading}>
        <Icon name="layers" />
        <h2>Water sources and supply details</h2>
        <Badge tone="neutral">
          {data.sources.length
            ? `${data.sources.length} source${data.sources.length === 1 ? '' : 's'}`
            : 'Not added'}
        </Badge>
        <Icon name="chevron-down" />
      </summary>
      <div className={styles.supplyBody}>
        <div className={styles.supplyToolbar}>
          <p>Add the water your community receives from each source.</p>
          <Button
            variant="secondary"
            size="sm"
            startIcon="plus"
            disabled={data.sources.length >= 30}
            onClick={addSource}
          >
            Add water source
          </Button>
        </div>
        {data.sources.map((source, index) => {
          const daily = sourceDaily(source);
          return (
            <details key={index} className={styles.sourceItem} open={active === index}>
              <summary
                className={styles.sourceHeading}
                onClick={(event) => {
                  event.preventDefault();
                  setActive(active === index ? null : index);
                }}
              >
                <span className={styles.sourceName}>{source.name || 'New water source'}</span>
                <span className={styles.sourceAmount}>
                  {daily === null
                    ? 'Unknown'
                    : `${daily.toLocaleString('en-IN', { maximumFractionDigits: 3 })} L/day`}
                </span>
                <Badge tone={daily === null ? 'neutral' : source.estimated ? 'info' : 'success'}>
                  {daily === null ? 'Unknown' : source.estimated ? 'Estimated' : 'User provided'}
                </Badge>
                <Icon name="chevron-down" size="sm" />
              </summary>
              <div className={styles.sourceEditor} aria-label={`Water source ${index + 1}`}>
                <div className={styles.sourceGrid}>
                  <Field id={`source-${index}-kind`} label="Water source" required>
                    {(p) => (
                      <Select
                        {...p}
                        value={source.kind}
                        onChange={(event) =>
                          changeSource(index, {
                            kind: event.target.value,
                            name:
                              event.target.value === 'other'
                                ? ''
                                : KINDS[event.target.value as keyof typeof KINDS],
                          })
                        }
                      >
                        {Object.entries(KINDS).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                  {(source.kind === 'other' ||
                    source.name !== KINDS[source.kind as keyof typeof KINDS]) && (
                    <Field id={`source-${index}-name`} label="Source name" required>
                      {(p) => (
                        <Input
                          {...p}
                          maxLength={100}
                          value={source.name}
                          onChange={(event) => changeSource(index, { name: event.target.value })}
                        />
                      )}
                    </Field>
                  )}
                  <Field id={`source-${index}-method`} label="Calculation" required>
                    {(p) => (
                      <Select
                        {...p}
                        value={source.method}
                        onChange={(event) =>
                          changeSource(index, {
                            method: event.target.value,
                            multiplier: '1',
                            periodDays: 1,
                            estimated: event.target.value === 'pump_runtime' || source.estimated,
                          })
                        }
                      >
                        {Object.entries(METHODS).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                  <Field
                    id={`source-${index}-quantity`}
                    label={
                      source.method === 'pump_runtime'
                        ? 'Flow rate (L/hour)'
                        : source.method === 'tanker_deliveries'
                          ? 'Tanker capacity (L)'
                          : source.method === 'volume_over_period'
                            ? 'Volume received (L)'
                            : 'Daily average (litres / day)'
                    }
                  >
                    {(p) => (
                      <Input
                        {...p}
                        type="number"
                        min={0}
                        max="1000000000000"
                        step="0.001"
                        placeholder="Unknown"
                        value={source.quantity ?? ''}
                        onChange={(event) =>
                          changeSource(index, { quantity: event.target.value || null })
                        }
                      />
                    )}
                  </Field>
                  {['pump_runtime', 'tanker_deliveries'].includes(source.method) && (
                    <Field
                      id={`source-${index}-multiplier`}
                      label={
                        source.method === 'pump_runtime' ? 'Operating hours / day' : 'Deliveries'
                      }
                      required
                    >
                      {(p) => (
                        <Input
                          {...p}
                          type="number"
                          min="0.001"
                          max={source.method === 'pump_runtime' ? 24 : 1000000}
                          step={source.method === 'pump_runtime' ? '0.001' : '1'}
                          value={source.multiplier}
                          onChange={(event) =>
                            changeSource(index, { multiplier: event.target.value })
                          }
                        />
                      )}
                    </Field>
                  )}
                  {['volume_over_period', 'tanker_deliveries'].includes(source.method) && (
                    <Field id={`source-${index}-days`} label="Period (days)" required>
                      {(p) => (
                        <Input
                          {...p}
                          type="number"
                          min={1}
                          max={3660}
                          step={1}
                          value={source.periodDays}
                          onChange={(event) =>
                            changeSource(index, { periodDays: Number(event.target.value) })
                          }
                        />
                      )}
                    </Field>
                  )}
                </div>
                <div className={styles.sourceFooter}>
                  <label className={styles.check}>
                    <input
                      type="checkbox"
                      checked={source.estimated}
                      onChange={(event) => changeSource(index, { estimated: event.target.checked })}
                    />
                    Estimated quantity
                  </label>

                  <Button
                    variant="ghost"
                    size="sm"
                    startIcon="minus"
                    className={styles.removeSource}
                    onClick={() => {
                      setActive(null);
                      edit({
                        sources: data.sources.filter((_, i) => i !== index),
                        supplyComplete: false,
                      });
                    }}
                  >
                    Remove source {index + 1}
                  </Button>
                </div>
                <details className={styles.sourceNotes}>
                  <summary>Where did this figure come from?</summary>
                  <Field
                    id={`source-${index}-evidence`}
                    label="Where did this figure come from?"
                    hideLabel
                  >
                    {(p) => (
                      <Input
                        {...p}
                        placeholder="e.g. a meter reading, tanker delivery log or assumption"
                        minLength={3}
                        maxLength={500}
                        value={source.source === NO_SOURCE_RECORD ? '' : source.source}
                        onChange={(event) =>
                          changeSource(index, { source: event.target.value || NO_SOURCE_RECORD })
                        }
                      />
                    )}
                  </Field>
                </details>
              </div>
            </details>
          );
        })}
        {data.sources.length > 0 && (
          <div className={styles.supplyTotals}>
            <span>
              Known supply:{' '}
              <strong>
                {data.sources.some((source) => sourceDaily(source) !== null)
                  ? `${knownTotal.toLocaleString('en-IN', { maximumFractionDigits: 3 })} L/day`
                  : 'Unknown'}
              </strong>
              {!data.supplyComplete && ' · Incomplete'}
            </span>
            <div className={styles.completenessCheck}>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  disabled={!complete}
                  checked={data.supplyComplete && complete}
                  onChange={(event) => edit({ supplyComplete: event.target.checked })}
                />
                I have added every water source and its quantity
              </label>
              <Tooltip label="About complete supply">
                Confirm all sources and quantities are included to calculate the supply gap. Daily
                water use must also be known.
              </Tooltip>
            </div>
          </div>
        )}
      </div>
    </details>
  );
}
