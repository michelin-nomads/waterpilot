import { useId, useRef, useState, type FormEvent } from 'react';

import { Button, ErrorSummary, Field, Input, Select, Textarea } from '../../components';
import type { FieldError } from '../../components';
import { MutationFailure, newIdempotencyKey, unwrapPayload } from '../../graphql/client';
import { RecordManualInputDocument, type ReadinessInput } from '../../graphql/generated/graphql';
import { useGraphQLMutation } from '../../graphql/hooks';
import { ENTRY_UNITS } from './readinessLabels';
import styles from './Readiness.module.scss';

interface ManualInputFormProps {
  sessionId: string;
  input: ReadinessInput;
  label: string;
  /** Local date in the area's timezone; the latest allowed "as of" date. */
  maxDate: string;
}

type Values = { value: string; unit: string; asOf: string; note: string };
const FIELDS = ['value', 'unit', 'asOf', 'note'] as const;

/**
 * Record a value the user knows, with its source. Saved values are labelled "Entered by
 * you" and never shown as measured data. One idempotency key covers the intent, so a
 * retry after a lost response cannot save the value twice.
 */
export function ManualInputForm({ sessionId, input, label, maxDate }: ManualInputFormProps) {
  const units = ENTRY_UNITS[input] ?? [];
  const formId = useId();
  const [values, setValues] = useState<Values>({
    value: '',
    unit: units[0]?.value ?? '',
    asOf: maxDate,
    note: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const intent = useRef<string | null>(null);
  const mutation = useGraphQLMutation('recordManualInput', RecordManualInputDocument);

  const ids = Object.fromEntries(FIELDS.map((f) => [f, `${formId}-${f}`])) as Record<
    keyof Values,
    string
  >;
  const change = (field: keyof Values) => (value: string) => {
    intent.current = null;
    setSaved(false);
    setValues((v) => ({ ...v, [field]: value }));
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFailure(null);
    const local: Partial<Record<keyof Values, string>> = {};
    if (!/^-?(0|[1-9]\d*)(\.\d+)?$/.test(values.value.trim())) {
      local.value = 'Enter a number such as 2.5, without commas or units.';
    }
    if (values.note.trim().length < 3) local.note = 'Say where this figure comes from.';
    if (!values.asOf) local.asOf = 'Enter the date the figure describes.';
    setErrors(local);
    if (Object.keys(local).length > 0) return;
    intent.current ??= newIdempotencyKey();
    try {
      const data = await mutation.mutateAsync({
        sessionId,
        input,
        value: values.value.trim(),
        unit: values.unit,
        asOf: values.asOf,
        note: values.note.trim(),
        idempotencyKey: intent.current,
      });
      unwrapPayload(data.recordManualInput);
      intent.current = null;
      setSaved(true);
      setValues((v) => ({ ...v, value: '', note: '' }));
    } catch (error) {
      if (error instanceof MutationFailure) {
        const server: Partial<Record<keyof Values, string>> = {};
        for (const fe of error.error.fieldErrors) {
          const field = (FIELDS as readonly string[]).includes(fe.field)
            ? (fe.field as keyof Values)
            : 'value';
          server[field] = fe.message;
        }
        setErrors(server);
        if (error.error.fieldErrors.length === 0) setFailure(error.message);
      } else {
        setFailure('Could not save. Check your connection and try again; nothing was lost.');
      }
    }
  }

  const summary: FieldError[] = FIELDS.flatMap((f) =>
    errors[f] ? [{ fieldId: ids[f], message: errors[f] ?? '' }] : [],
  );

  return (
    <form className={styles.form} onSubmit={(e) => void submit(e)} noValidate>
      <ErrorSummary errors={summary} />
      <div className={styles.formRow}>
        <Field id={ids.value} label={`${label} value`} error={errors.value} required>
          {(p) => (
            <Input
              {...p}
              inputMode="decimal"
              value={values.value}
              onChange={(e) => change('value')(e.target.value)}
            />
          )}
        </Field>
        <Field id={ids.unit} label="Unit" error={errors.unit} required>
          {(p) => (
            <Select {...p} value={values.unit} onChange={(e) => change('unit')(e.target.value)}>
              {units.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field id={ids.asOf} label="As of" error={errors.asOf} required>
          {(p) => (
            <Input
              {...p}
              type="date"
              max={maxDate}
              value={values.asOf}
              onChange={(e) => change('asOf')(e.target.value)}
            />
          )}
        </Field>
      </div>
      <Field
        id={ids.note}
        label="Source"
        hint="For example: water bill for September 2026, or ward census table 2011."
        error={errors.note}
        required
      >
        {(p) => (
          <Textarea
            {...p}
            rows={2}
            maxLength={500}
            value={values.note}
            onChange={(e) => change('note')(e.target.value)}
          />
        )}
      </Field>
      {failure && (
        <p role="alert" className={styles.error}>
          {failure}
        </p>
      )}
      {saved && (
        <p role="status" className={styles.saved}>
          Saved. It is shown as entered by you, not as measured data.
        </p>
      )}
      <Button type="submit" variant="secondary" size="sm" loading={mutation.isPending}>
        Save value
      </Button>
    </form>
  );
}
