import { useState } from 'react';
import { Field, Input, Select, Tooltip } from '../../components';
import styles from './Goals.module.scss';

/** Preset day counts with an explicit custom input; saved arbitrary durations never get rounded. */
export function GoalDurationField({
  id,
  label,
  value,
  onChange,
  error,
  horizon = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  horizon?: boolean;
}) {
  const options = horizon
    ? [
        ['365', '1 year (365 days)'],
        ['1825', '5 years (1,825 days)'],
        ['3650', '10 years (3,650 days)'],
      ]
    : [
        ['180', '6 months (180 days)'],
        ['365', '12 months (365 days)'],
        ['730', '24 months (730 days)'],
      ];
  const [customRequested, setCustomRequested] = useState(false);
  const custom = customRequested || (value !== '' && !options.some(([days]) => days === value));
  return (
    <div className={styles.stack}>
      <Field
        id={custom ? `${id}-preset` : id}
        label={label}
        error={custom ? undefined : error}
        labelAction={
          <Tooltip label={`About ${label.toLowerCase()}`}>
            {horizon
              ? 'The period used to compare costs and benefits. This is separate from the construction deadline.'
              : 'The maximum time allowed for implementation, separate from the period used to assess benefits.'}
          </Tooltip>
        }
      >
        {(p) => (
          <Select
            {...p}
            value={custom ? 'custom' : value}
            onChange={(e) => {
              setCustomRequested(e.target.value === 'custom');
              onChange(e.target.value === 'custom' ? '' : e.target.value);
            }}
          >
            <option value="">Not set</option>
            {options.map(([days, text]) => (
              <option key={days} value={days}>
                {text}
              </option>
            ))}
            <option value="custom">Enter days…</option>
          </Select>
        )}
      </Field>
      {custom && (
        <Field id={id} label={`${label} (days)`} error={error}>
          {(p) => (
            <Input
              {...p}
              inputMode="numeric"
              value={value}
              onChange={(e) => onChange(e.target.value)}
            />
          )}
        </Field>
      )}
    </div>
  );
}
