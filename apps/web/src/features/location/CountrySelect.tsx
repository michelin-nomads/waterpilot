import { Field, Input, Select } from '../../components';
import { CountriesDocument } from '../../graphql/generated/graphql';
import { useGraphQLQuery } from '../../graphql/hooks';
import { queryKeys } from '../../graphql/queryKeys';

interface CountrySelectProps {
  id: string;
  value: string;
  onChange: (code: string) => void;
  error?: string;
  hint?: string;
}

/**
 * Country picker. The country sets currency, time zone defaults and units; it is never
 * inferred from the UI language. Falls back to a two-letter code field if the list
 * cannot load, so the step can still be completed.
 */
export function CountrySelect({ id, value, onChange, error, hint }: CountrySelectProps) {
  const query = useGraphQLQuery(queryKeys.locations.countries(), CountriesDocument, {});
  const countries = query.data?.countries.countries ?? [];

  if (query.isError) {
    return (
      <Field
        id={id}
        label="Country code"
        hint="The country list could not load. Enter the two-letter code, for example KE or PE."
        error={error}
        required
      >
        {(p) => (
          <Input
            {...p}
            maxLength={2}
            autoCapitalize="characters"
            value={value}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
          />
        )}
      </Field>
    );
  }
  return (
    <Field id={id} label="Country" hint={hint} error={error} required>
      {(p) => (
        <Select
          {...p}
          value={value}
          disabled={query.isPending}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{query.isPending ? 'Loading countries…' : 'Choose a country'}</option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}
