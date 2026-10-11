import { useId, useState, type FormEvent } from 'react';

import { Button, ErrorSummary, Field, Input, type FieldError } from '../../components';
import { CountrySelect } from './CountrySelect';
import type { Place } from './types';
import styles from './Location.module.scss';

export interface CustomPoint {
  name: string;
  latitude: string;
  longitude: string;
  countryCode: string;
}

interface CustomLocationFormProps {
  initial: Partial<CustomPoint>;
  onSubmit: (place: Place) => void;
  onCancel: () => void;
}

const COORD = /^-?\d{1,3}(\.\d{1,7})?$/;
type Fields = keyof CustomPoint;

function validate(v: CustomPoint): Partial<Record<Fields, string>> {
  const errors: Partial<Record<Fields, string>> = {};
  if (v.name.trim().length < 2)
    errors.name = 'Give the location a name, for example “Our village well”.';
  const lat = Number(v.latitude);
  if (!COORD.test(v.latitude.trim()) || lat < -90 || lat > 90) {
    errors.latitude = 'Enter a latitude between -90 and 90, such as -1.2864 (up to 7 decimals).';
  }
  const lon = Number(v.longitude);
  if (!COORD.test(v.longitude.trim()) || lon < -180 || lon > 180) {
    errors.longitude =
      'Enter a longitude between -180 and 180, such as 36.8172 (up to 7 decimals).';
  }
  if (!/^[A-Z]{2}$/.test(v.countryCode))
    errors.countryCode = 'Choose the country this location is in.';
  return errors;
}

/** A location the person types in. It stays private to them (ADR 0009). */
export function CustomLocationForm({ initial, onSubmit, onCancel }: CustomLocationFormProps) {
  const formId = useId();
  const [values, setValues] = useState<CustomPoint>({
    name: initial.name ?? '',
    latitude: initial.latitude ?? '',
    longitude: initial.longitude ?? '',
    countryCode: initial.countryCode ?? '',
  });
  const [errors, setErrors] = useState<Partial<Record<Fields, string>>>({});
  const ids: Record<Fields, string> = {
    name: `${formId}-name`,
    latitude: `${formId}-lat`,
    longitude: `${formId}-lon`,
    countryCode: `${formId}-country`,
  };
  const set = (field: Fields) => (value: string) => setValues((v) => ({ ...v, [field]: value }));

  function submit(event: FormEvent) {
    event.preventDefault();
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    onSubmit({
      placeId: '',
      name: values.name.trim(),
      formattedAddress: null,
      latitude: String(Number(values.latitude.trim())),
      longitude: String(Number(values.longitude.trim())),
      countryCode: values.countryCode,
      scope: 'POINT',
      types: [],
      admin: { countryName: null, admin1: null, admin2: null, locality: null, sublocality: null },
    });
  }

  const summary: FieldError[] = (Object.keys(ids) as Fields[]).flatMap((f) =>
    errors[f] ? [{ fieldId: ids[f], message: errors[f] ?? '' }] : [],
  );

  return (
    <form
      className={styles.form}
      onSubmit={submit}
      noValidate
      aria-label="Enter a location yourself"
    >
      <ErrorSummary errors={summary} />
      <Field id={ids.name} label="Name" error={errors.name} required>
        {(p) => (
          <Input
            {...p}
            maxLength={120}
            value={values.name}
            onChange={(e) => set('name')(e.target.value)}
          />
        )}
      </Field>
      <div className={styles.formRow}>
        <Field
          id={ids.latitude}
          label="Latitude"
          hint="Decimal degrees; south is negative."
          error={errors.latitude}
          required
        >
          {(p) => (
            <Input
              {...p}
              inputMode="decimal"
              value={values.latitude}
              onChange={(e) => set('latitude')(e.target.value)}
            />
          )}
        </Field>
        <Field
          id={ids.longitude}
          label="Longitude"
          hint="Decimal degrees; west is negative."
          error={errors.longitude}
          required
        >
          {(p) => (
            <Input
              {...p}
              inputMode="decimal"
              value={values.longitude}
              onChange={(e) => set('longitude')(e.target.value)}
            />
          )}
        </Field>
      </div>
      <CountrySelect
        id={ids.countryCode}
        value={values.countryCode}
        onChange={set('countryCode')}
        error={errors.countryCode}
      />
      <div className={styles.actions}>
        <Button type="submit">Review this location</Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
