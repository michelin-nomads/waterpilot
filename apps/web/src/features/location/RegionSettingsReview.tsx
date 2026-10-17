import { Field, Notice, Select, Skeleton } from '../../components';
import { RegionSettingsDocument } from '../../graphql/generated/graphql';
import { useGraphQLQuery } from '../../graphql/hooks';
import { queryKeys } from '../../graphql/queryKeys';
import { UNIT_SYSTEM_LABEL } from './locationLabels';
import styles from './Location.module.scss';

export interface RegionChoice {
  /** The person's choice; null keeps the inferred value. */
  currency: string | null;
  timezone: string | null;
}

interface RegionSettingsReviewProps {
  id: string;
  latitude: string;
  longitude: string;
  countryCode: string;
  value: RegionChoice;
  onChange: (value: RegionChoice) => void;
}

/**
 * The currency, time zone and units WaterPilot infers from the country and point (never
 * from the interface language), shown before confirming. Uncertain values say so and can
 * be corrected; if the preview cannot load, the server infers them on confirmation.
 */
export function RegionSettingsReview({
  id,
  latitude,
  longitude,
  countryCode,
  value,
  onChange,
}: RegionSettingsReviewProps) {
  const enabled = /^[A-Z]{2}$/.test(countryCode);
  const query = useGraphQLQuery(
    queryKeys.locations.region(latitude, longitude, countryCode),
    RegionSettingsDocument,
    { latitude, longitude, countryCode },
    { enabled },
  );
  const region = query.data?.regionSettings;

  if (!enabled) return null;
  if (query.isPending) {
    return (
      <div aria-busy="true" aria-label="Working out region settings">
        <Skeleton width="three-quarters" />
      </div>
    );
  }
  if (query.isError || !region) {
    return (
      <Notice kind="partial" title="Region settings not previewed" announce={false}>
        They will be set from the country and point when you confirm, and shown afterwards.
      </Notice>
    );
  }

  const currency = value.currency ?? region.currency ?? '';
  const timezone = value.timezone ?? region.timezone;
  const pick = (field: keyof RegionChoice, chosen: string, inferred: string | null) =>
    onChange({ ...value, [field]: chosen === inferred ? null : chosen });
  const uncertain = [
    !region.currencyCertain && 'this country uses more than one currency (or none)',
    !region.timezoneCertain && 'the time zone depends on where exactly the place is',
  ].filter(Boolean);

  return (
    <fieldset className={styles.region}>
      <legend className={styles.label}>Region settings</legend>
      <p className={styles.hint}>
        Set from the country and this point, not from the language you read WaterPilot in.
      </p>
      {uncertain.length > 0 && (
        <Notice kind="info" title="Please check" announce={false}>
          WaterPilot is not sure because {uncertain.join(', and ')}. Correct anything that is wrong.
        </Notice>
      )}
      <div className={styles.formRow}>
        <Field
          id={`${id}-currency`}
          label="Currency"
          hint={region.currencyCertain ? 'Inferred from the country.' : 'Please check.'}
        >
          {(p) => (
            <Select
              {...p}
              value={currency}
              onChange={(e) => pick('currency', e.target.value, region.currency)}
            >
              {region.currencyOptions.length === 0 && <option value="">Not known</option>}
              {region.currencyOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field
          id={`${id}-timezone`}
          label="Time zone"
          hint={region.timezoneCertain ? 'Inferred from the point.' : 'Please check.'}
        >
          {(p) => (
            <Select
              {...p}
              value={timezone}
              onChange={(e) => pick('timezone', e.target.value, region.timezone)}
            >
              {region.timezoneOptions.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <p className={styles.hint}>Units: {UNIT_SYSTEM_LABEL[region.unitSystem]}</p>
    </fieldset>
  );
}
