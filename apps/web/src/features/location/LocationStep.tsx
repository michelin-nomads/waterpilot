import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button, Notice } from '../../components';
import { MutationFailure } from '../../graphql/client';
import type { AreaLocationFieldsFragment } from '../../graphql/generated/graphql';
import { CandidateReview, type LocationDraft } from './CandidateReview';
import { GEOLOCATION_MESSAGE, requestDevicePosition, type GeolocationOutcome } from './geolocation';
import { LocationSearch } from './LocationSearch';
import { MapPanel } from './MapPanel';
import { usePlaces } from './placesContext';
import { resolveLocation } from './resolveLocation';
import type { Place } from './types';
import { useConfirmLocation, type LocationDraftInput } from './useConfirmLocation';
import styles from './Location.module.scss';

interface LocationStepProps {
  onConfirmed: (area: AreaLocationFieldsFragment) => void;
  onCancel?: () => void;
}

type FailureState = { message: string | null; fields: { field: string; message: string }[] };
const NO_FAILURE: FailureState = { message: null, fields: [] };
const LOOKUP_FAILED =
  'We could not identify the country for this location. Try again, search for a nearby place, or choose another point on the map.';

const pointPlace = (latitude: string, longitude: string): Place => ({
  placeId: '',
  name: 'Selected map location',
  formattedAddress: null,
  latitude,
  longitude,
  countryCode: null,
  scope: 'POINT',
  types: [],
  admin: { countryName: null, admin1: null, admin2: null, locality: null, sublocality: null },
});

/** Search, device location and map clicks all resolve to the same circular-area review. */
export function LocationStep({ onConfirmed, onCancel }: LocationStepProps) {
  const adapter = usePlaces();
  const { confirm, pending, canSave } = useConfirmLocation();
  const [draft, setDraft] = useState<LocationDraft | null>(null);
  const [previewRadius, setPreviewRadius] = useState<number | null>(1000);
  const [resolving, setResolving] = useState(false);
  const [geoOutcome, setGeoOutcome] = useState<Exclude<GeolocationOutcome['kind'], 'fix'> | null>(
    null,
  );
  const [failure, setFailure] = useState<FailureState>(NO_FAILURE);
  const selection = useRef(0);
  useEffect(
    () => () => {
      selection.current += 1;
    },
    [],
  );

  const resolveDraft = useCallback(
    async (candidate: LocationDraft, token: number) => {
      try {
        const place = await resolveLocation(adapter, candidate.place, candidate.origin);
        if (!place) throw new Error(LOOKUP_FAILED);
        if (token !== selection.current) return;
        setDraft({ ...candidate, place });
      } catch {
        if (token === selection.current) setFailure({ message: LOOKUP_FAILED, fields: [] });
      } finally {
        if (token === selection.current) setResolving(false);
      }
    },
    [adapter],
  );

  const review = (candidate: LocationDraft) => {
    const token = ++selection.current;
    setFailure(NO_FAILURE);
    setGeoOutcome(null);
    setResolving(true);
    void resolveDraft(candidate, token);
  };
  const back = () => {
    selection.current += 1;
    setFailure(NO_FAILURE);
    setResolving(false);
    setDraft(null);
  };

  async function locateDevice() {
    const token = ++selection.current;
    setResolving(true);
    setGeoOutcome(null);
    setFailure(NO_FAILURE);
    const outcome = await requestDevicePosition();
    if (token !== selection.current) return;
    if (outcome.kind !== 'fix') {
      setGeoOutcome(outcome.kind);
      setResolving(false);
      return;
    }
    await resolveDraft(
      {
        origin: 'GEOLOCATION',
        accuracyMeters: outcome.accuracyMeters,
        place: pointPlace(outcome.latitude, outcome.longitude),
      },
      token,
    );
  }

  const pickOnMap = useCallback(
    (latitude: string, longitude: string) => {
      const token = ++selection.current;
      setResolving(true);
      setGeoOutcome(null);
      setFailure(NO_FAILURE);
      void resolveDraft({ origin: 'CUSTOM', place: pointPlace(latitude, longitude) }, token);
    },
    [resolveDraft],
  );

  async function submit(input: LocationDraftInput) {
    setFailure(NO_FAILURE);
    try {
      onConfirmed(await confirm(input));
    } catch (error) {
      setFailure(
        error instanceof MutationFailure
          ? {
              message: error.error.fieldErrors.length === 0 ? error.message : null,
              fields: error.error.fieldErrors,
            }
          : {
              message: 'Could not save the location. Check your connection and try again.',
              fields: [],
            },
      );
    }
  }

  const mapPoint = useMemo(
    () =>
      draft
        ? {
            latitude: draft.place.latitude,
            longitude: draft.place.longitude,
            radiusMeters: previewRadius,
          }
        : null,
    [draft, previewRadius],
  );

  return (
    <div className={styles.step}>
      <div className={styles.main}>
        {!canSave && (
          <Notice kind="info">Start planning first; your location is saved to the session.</Notice>
        )}
        {resolving && (
          <p role="status" className={styles.hint}>
            Finding your location…
          </p>
        )}
        {draft ? (
          <CandidateReview
            key={`${draft.origin}:${draft.place.latitude}:${draft.place.longitude}`}
            onExtentPreview={setPreviewRadius}
            draft={draft}
            pending={pending}
            canSave={canSave && !resolving}
            failure={failure.message}
            fieldErrors={failure.fields}
            onConfirm={(input) => void submit(input)}
            onBack={back}
            onRetryName={() => review(draft)}
          />
        ) : (
          <section aria-label="Choose your location" className={styles.card}>
            <LocationSearch
              adapter={adapter}
              onSelect={(place) => review({ origin: 'PLACE_SEARCH', place })}
              action={
                <Button
                  className={styles.locateButton}
                  variant="secondary"
                  startIcon="target"
                  aria-label="Use my location"
                  loading={resolving}
                  onClick={() => void locateDevice()}
                >
                  <span className={styles.locateLabel}>Use my location</span>
                </Button>
              }
            />
            {onCancel && (
              <div className={styles.actions}>
                <Button variant="ghost" onClick={onCancel}>
                  Keep the current location
                </Button>
              </div>
            )}
            {geoOutcome && (
              <p role="alert" className={styles.error}>
                {GEOLOCATION_MESSAGE[geoOutcome]}
              </p>
            )}
            {failure.message && (
              <p role="alert" className={styles.error}>
                {failure.message}
              </p>
            )}
          </section>
        )}
      </div>
      <aside className={styles.aside} aria-label="Map">
        <div className={styles.mapStage}>
          <MapPanel adapter={adapter} point={mapPoint} onPick={pickOnMap} />
        </div>
      </aside>
    </div>
  );
}
