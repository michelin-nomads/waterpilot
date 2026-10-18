import { useEffect, useId, useRef, useState, type FormEvent } from 'react';

import { Badge, Button, Field, Input, Notice, Tooltip } from '../../components';
import type { AreaOrigin } from '../../graphql/generated/graphql';
import { INACCURATE_FIX_M } from './geolocation';
import { formatDistance, ORIGIN_LABEL } from './locationLabels';
import { isFixturePlace, type Place } from './types';
import type { LocationDraftInput } from './useConfirmLocation';
import styles from './Location.module.scss';
import { LocationName } from './LocationName';
import { registerLocationConfirmation } from '../planning/planningInteraction';

export interface LocationDraft {
  origin: Exclude<AreaOrigin, 'CATALOGUE'>;
  place: Place;
  accuracyMeters?: number;
}

interface CandidateReviewProps {
  sessionId?: string;
  initialRadiusKm?: number;
  draft: LocationDraft;
  pending: boolean;
  canSave: boolean;
  failure: string | null;
  fieldErrors: readonly { field: string; message: string }[];
  onConfirm: (input: LocationDraftInput) => void;
  onBack: () => void;
  onRetryName?: () => void;
  onExtentPreview?: (radiusMeters: number | null) => void;
}

const MIN_KM = 1;
const MAX_KM = 10;

function radiusError(km: string): string | null {
  const value = Number(km);
  return /^\d+(\.\d{1,3})?$/.test(km.trim()) && value >= MIN_KM && value <= MAX_KM
    ? null
    : `Enter a radius from ${MIN_KM} to ${MAX_KM} km.`;
}

/** Review a circular planning area; regional settings are inferred by the API on confirmation. */
export function CandidateReview({
  draft,
  sessionId,
  initialRadiusKm = 1,
  pending,
  canSave,
  failure,
  fieldErrors,
  onConfirm,
  onBack,
  onRetryName,
  onExtentPreview,
}: CandidateReviewProps) {
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const { place, origin } = draft;
  const [radiusKm, setRadiusKm] = useState(String(initialRadiusKm));
  const [error, setError] = useState<string | null>(null);
  const nameUnavailable = place.name === 'Location name unavailable';
  const inaccurate = (draft.accuracyMeters ?? 0) > INACCURATE_FIX_M;

  const initialRadiusMeters = Math.round(initialRadiusKm * 1000);
  useEffect(() => {
    const currentMeters = radiusError(radiusKm) === null ? Math.round(Number(radiusKm) * 1000) : null;
    if (currentMeters !== initialRadiusMeters) {
      onExtentPreview?.(currentMeters);
    }
  }, [radiusKm, initialRadiusMeters, onExtentPreview]);

  useEffect(() => {
    if (!sessionId) return;
    const available =
      !pending &&
      canSave &&
      Boolean(place.countryCode) &&
      !nameUnavailable &&
      radiusError(radiusKm) === null;
    return registerLocationConfirmation(
      sessionId,
      available ? () => formRef.current?.requestSubmit() : null,
    );
  }, [sessionId, pending, canSave, place.countryCode, nameUnavailable, radiusKm]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (pending || !canSave) return;
    const invalid = radiusError(radiusKm);
    setError(invalid);
    if (invalid || !place.countryCode || nameUnavailable) return;
    onConfirm({
      origin,
      placeId: origin === 'PLACE_SEARCH' ? place.placeId : null,
      name: place.name,
      formattedAddress: place.formattedAddress,
      latitude: place.latitude,
      longitude: place.longitude,
      countryCode: place.countryCode,
      admin: place.admin,
      types: place.types,
      accuracyMeters: draft.accuracyMeters ?? null,
      extent: 'USER_RADIUS',
      radiusMeters: Math.round(Number(radiusKm) * 1000),
      currency: null,
      timezone: null,
    });
  }

  return (
    <form
      ref={formRef}
      className={styles.review}
      onSubmit={submit}
      noValidate
      aria-labelledby={`${id}-title`}
    >
      <div className={styles.summaryHead}>
        <h2 id={`${id}-title`} className={styles.title}>
          Your selected area
        </h2>
        {isFixturePlace(place) && <Badge tone="warning">Test place, not real data</Badge>}
      </div>
      <dl className={styles.facts}>
        <div>
          <dt>
            Selected location{' '}
            <Tooltip label="About the selected location">
              The place at the centre of your planning circle. Device and map locations are named
              using the nearest available place information.
            </Tooltip>
          </dt>
          <dd>
            {nameUnavailable ? (
              <span className={styles.nameStatus}>
                <span>Place name not loaded</span>
                <Button variant="ghost" size="sm" onClick={onRetryName}>
                  Try again
                </Button>
              </span>
            ) : (
              <LocationName
                name={place.name}
                admin={place.admin}
                fullAddress={place.formattedAddress}
                testId="review-name"
              />
            )}
          </dd>
        </div>
        <div>
          <dt>
            Coordinates{' '}
            <Tooltip label="About coordinates">
              Latitude and longitude identify the exact centre of your planning circle.
            </Tooltip>
          </dt>
          <dd>
            {Number(place.latitude).toFixed(5)}, {Number(place.longitude).toFixed(5)}
          </dd>
        </div>
        <div>
          <dt>
            Location source{' '}
            <Tooltip label="About the location source">
              How the centre was selected: a place search, your device’s location service, or a
              point you picked on the map.
            </Tooltip>
          </dt>
          <dd>{ORIGIN_LABEL[origin]}</dd>
        </div>
        {draft.accuracyMeters != null && (
          <div>
            <dt>
              Location accuracy{' '}
              <Tooltip label="About location accuracy">
                Your device estimates that your actual position is within this distance of the
                reported coordinates. This is separate from the planning radius you choose below.
              </Tooltip>
            </dt>
            <dd>Approximately ±{formatDistance(draft.accuracyMeters)}</dd>
          </div>
        )}
      </dl>
      {inaccurate && (
        <Notice kind="stale" title="This device location is imprecise">
          The reported position may be off by about {formatDistance(draft.accuracyMeters ?? 0)}.
          Search for your location or pick a more precise point on the map.
        </Notice>
      )}
      <Field
        id={`${id}-radius`}
        label="Radius (km)"
        labelAction={
          <Tooltip label="About the planning radius">
            Choose a radius from 1 to 10 km. Calculations use the circle around your selected
            location. This planning area does not represent a catchment or an administrative
            boundary.
          </Tooltip>
        }
        error={error}
        required
      >
        {(control) => (
          <Input
            {...control}
            inputMode="decimal"
            value={radiusKm}
            onChange={(event) => {
              setRadiusKm(event.target.value);
              setError(null);
            }}
          />
        )}
      </Field>
      {origin !== 'PLACE_SEARCH' && (
        <p className={styles.hint}>
          This location stays private to you and cannot be shared with a community.
        </p>
      )}
      {fieldErrors.length > 0 && (
        <ul role="alert" className={styles.error}>
          {fieldErrors.map((item) => (
            <li key={item.field + item.message}>{item.message}</li>
          ))}
        </ul>
      )}
      {failure && (
        <p role="alert" className={styles.error}>
          {failure}
        </p>
      )}
      <div className={styles.actions}>
        <Button
          type="submit"
          loading={pending}
          disabled={!canSave || !place.countryCode || nameUnavailable}
        >
          Confirm area and check data
        </Button>
        <Button variant="ghost" onClick={onBack}>
          Change area
        </Button>
      </div>
    </form>
  );
}
