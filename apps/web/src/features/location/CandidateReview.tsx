import { useEffect, useId, useState, type FormEvent } from 'react';

import { Badge, Button, ChoiceCards, Field, Input, Notice } from '../../components';
import type { AreaOrigin, ExtentKind } from '../../graphql/generated/graphql';
import { CountrySelect } from './CountrySelect';
import { INACCURATE_FIX_M } from './geolocation';
import { formatDistance, ORIGIN_LABEL, SCOPE_LABEL } from './locationLabels';
import { RegionSettingsReview, type RegionChoice } from './RegionSettingsReview';
import { isFixturePlace, type Place } from './types';
import type { LocationDraftInput } from './useConfirmLocation';
import styles from './Location.module.scss';

export interface LocationDraft {
  origin: Exclude<AreaOrigin, 'CATALOGUE'>;
  place: Place;
  /** Device fixes only. */
  accuracyMeters?: number;
  /** Device fixes only: named places nearby the person may prefer. */
  nearby?: Place[];
}

interface CandidateReviewProps {
  draft: LocationDraft;
  pending: boolean;
  /** False when there is no planning session to save the location to. */
  canSave: boolean;
  failure: string | null;
  fieldErrors: readonly { field: string; message: string }[];
  onConfirm: (input: LocationDraftInput) => void;
  onChoosePlace: (place: Place) => void;
  onBack: () => void;
  onExtentPreview?: (radiusMeters: number | null) => void;
}

const MIN_KM = 0.1;
const MAX_KM = 50;
const KEEP_INFERRED: RegionChoice = { currency: null, timezone: null };

function radiusError(km: string): string | null {
  const value = Number(km);
  if (!/^\d+(\.\d{1,3})?$/.test(km.trim()) || value < MIN_KM || value > MAX_KM) {
    return `Enter a radius from ${MIN_KM} to ${MAX_KM} km.`;
  }
  return null;
}

type Errors = { extent?: string; radius?: string; country?: string };

/**
 * Review before saving: what was found, what kind of place it is, an explicit choice of
 * how calculations treat it (never a silent boundary), the country and region settings
 * (correctable when uncertain), and the choice to confirm or pick another place.
 */
export function CandidateReview({
  draft,
  pending,
  canSave,
  failure,
  fieldErrors,
  onConfirm,
  onChoosePlace,
  onBack,
  onExtentPreview,
}: CandidateReviewProps) {
  const id = useId();
  const { place, origin } = draft;
  const [extent, setExtent] = useState<ExtentKind | null>(null);
  const [radiusKm, setRadiusKm] = useState('1');
  const [countryCode, setCountryCode] = useState(place.countryCode ?? '');
  const [region, setRegion] = useState<RegionChoice>(KEEP_INFERRED);
  const [errors, setErrors] = useState<Errors>({});
  const privateOrigin = origin !== 'PLACE_SEARCH';
  const inaccurate = (draft.accuracyMeters ?? 0) > INACCURATE_FIX_M;
  const fixture = isFixturePlace(place);

  useEffect(() => {
    onExtentPreview?.(
      extent === 'USER_RADIUS' && radiusError(radiusKm) === null
        ? Math.round(Number(radiusKm) * 1000)
        : null,
    );
  }, [extent, radiusKm, onExtentPreview]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const local: Errors = {};
    if (!extent) local.extent = 'Choose how calculations should treat this place.';
    if (extent === 'USER_RADIUS') local.radius = radiusError(radiusKm) ?? undefined;
    if (!/^[A-Z]{2}$/.test(countryCode)) local.country = 'Choose the country this place is in.';
    setErrors(local);
    if (!extent || local.radius || local.country) return;
    onConfirm({
      origin,
      placeId: origin === 'PLACE_SEARCH' ? place.placeId : null,
      name: place.name,
      formattedAddress: place.formattedAddress,
      latitude: place.latitude,
      longitude: place.longitude,
      countryCode,
      admin: place.admin,
      types: place.types,
      accuracyMeters: draft.accuracyMeters ?? null,
      extent,
      radiusMeters: extent === 'USER_RADIUS' ? Math.round(Number(radiusKm) * 1000) : null,
      currency: region.currency,
      timezone: region.timezone,
    });
  }

  return (
    <form className={styles.review} onSubmit={submit} noValidate aria-labelledby={`${id}-title`}>
      <div className={styles.summaryHead}>
        <h2 id={`${id}-title`} className={styles.title}>
          Confirm your location
        </h2>
        {fixture && <Badge tone="warning">Test place, not real data</Badge>}
      </div>
      <dl className={styles.facts}>
        <div>
          <dt>Place</dt>
          <dd data-testid="review-name">{place.name}</dd>
        </div>
        {place.formattedAddress && (
          <div>
            <dt>Address</dt>
            <dd>{place.formattedAddress}</dd>
          </div>
        )}
        <div>
          <dt>Coordinates</dt>
          <dd>
            {place.latitude}, {place.longitude}
          </dd>
        </div>
        <div>
          <dt>Found by</dt>
          <dd>{ORIGIN_LABEL[origin]}</dd>
        </div>
        {draft.accuracyMeters != null && (
          <div>
            <dt>Device accuracy</dt>
            <dd>within about {formatDistance(draft.accuracyMeters)}</dd>
          </div>
        )}
      </dl>
      {fixture && (
        <p className={styles.hint}>
          This comes from the local test gazetteer: approximate coordinates for trying WaterPilot
          out, not a real place lookup.
        </p>
      )}

      {inaccurate && (
        <Notice kind="stale" title="This device location is imprecise">
          Your device reports it is only accurate to about{' '}
          {formatDistance(draft.accuracyMeters ?? 0)}. Choose a nearby named place, search for it,
          or confirm only if this is close enough.
        </Notice>
      )}

      {draft.nearby && draft.nearby.length > 0 && (
        <div className={styles.nearby}>
          <p className={styles.label}>Or choose a named place near you</p>
          <ul className={styles.plainList}>
            {draft.nearby.map((p) => (
              <li key={p.placeId}>
                <Button size="sm" variant="secondary" onClick={() => onChoosePlace(p)}>
                  {p.formattedAddress ?? p.name}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Notice kind="info" title="A place is not a catchment" announce={false}>
        This is {SCOPE_LABEL[place.scope]}. A name or a point is not a water catchment or a ward
        boundary, and WaterPilot does not draw neighbourhood boundaries it has no reviewed source
        for. Choose below how calculations should treat it.
      </Notice>

      <ChoiceCards<ExtentKind>
        legend="Area to use for calculations (required)"
        value={extent}
        onChange={(value) => {
          setExtent(value);
          setErrors((e) => ({ ...e, extent: undefined }));
        }}
        options={[
          {
            value: 'REFERENCE_POINT',
            title: 'Just this point',
            description: 'No boundary. Steps that need an area ask you later.',
          },
          {
            value: 'USER_RADIUS',
            title: 'A circle around it',
            description: 'You set the radius; it is recorded as your assumption.',
          },
        ]}
      />
      {errors.extent && (
        <p role="alert" className={styles.error}>
          {errors.extent}
        </p>
      )}
      {extent === 'USER_RADIUS' && (
        <Field
          id={`${id}-radius`}
          label="Radius (km)"
          hint={`From ${MIN_KM} to ${MAX_KM} km.`}
          error={errors.radius}
          required
        >
          {(p) => (
            <Input
              {...p}
              inputMode="decimal"
              value={radiusKm}
              onChange={(e) => setRadiusKm(e.target.value)}
            />
          )}
        </Field>
      )}

      <CountrySelect
        id={`${id}-country`}
        value={countryCode}
        onChange={(code) => {
          setCountryCode(code);
          setRegion(KEEP_INFERRED);
        }}
        error={errors.country}
        hint={
          place.countryCode
            ? 'Reported by the place provider. Change it if it is wrong.'
            : 'The provider did not report a country for this point.'
        }
      />
      <RegionSettingsReview
        id={id}
        latitude={place.latitude}
        longitude={place.longitude}
        countryCode={countryCode}
        value={region}
        onChange={setRegion}
      />

      {privateOrigin && (
        <p className={styles.hint}>
          This location stays private to you and cannot be shared with a community.
        </p>
      )}

      {fieldErrors.length > 0 && (
        <ul role="alert" className={styles.error}>
          {fieldErrors.map((fe) => (
            <li key={fe.field + fe.message}>{fe.message}</li>
          ))}
        </ul>
      )}
      {failure && (
        <p role="alert" className={styles.error}>
          {failure}
        </p>
      )}
      <div className={styles.actions}>
        <Button type="submit" loading={pending} disabled={!canSave}>
          Confirm location
        </Button>
        <Button variant="ghost" onClick={onBack}>
          Change area
        </Button>
      </div>
    </form>
  );
}
