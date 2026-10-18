import { Field, Input } from '../../components';
import styles from './Goals.module.scss';

/** The text value stays exact and optional; the slider only changes it on user input. */
export function GoalRangeField({
  id,
  label,
  value,
  onChange,
  error,
  max,
  min = 0,
  step = 1,
  sliderLabel,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  max: number;
  min?: number;
  step?: number;
  sliderLabel: string;
  placeholder: string;
}) {
  const numeric = Number(value);
  const position =
    value.trim() && Number.isFinite(numeric) ? Math.max(min, Math.min(max, numeric)) : min;
  return (
    <Field id={id} label={label} error={error}>
      {(p) => (
        <div className={styles.rangeField}>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={position}
            aria-label={sliderLabel}
            aria-valuetext={value || 'Not set'}
            onChange={(e) => onChange(e.target.value)}
          />
          <Input
            {...p}
            inputMode="decimal"
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      )}
    </Field>
  );
}
