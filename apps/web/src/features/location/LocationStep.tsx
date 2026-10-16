import { useCallback, useMemo, useState, type ReactNode } from 'react';

import { Button, Notice } from '../../components';
import { MutationFailure } from '../../graphql/client';
import type { AreaLocationFieldsFragment } from '../../graphql/generated/graphql';
import { CandidateReview, type LocationDraft } from './CandidateReview';
import { CustomLocationForm, type CustomPoint } from './CustomLocationForm';
import { GEOLOCATION_MESSAGE, requestDevicePosition, type GeolocationOutcome } from './geolocation';
import { LocationSearch } from './LocationSearch';
import { MapPanel } from './MapPanel';
import { usePlaces } from './placesContext';
import type { Place } from './types';
import { useConfirmLocation, type LocationDraftInput } from './useConfirmLocation';
import styles from './Location.module.scss';

interface LocationStepProps {
  onConfirmed: (area: AreaLocationFieldsFragment) => void;
  onCancel?: () => void;
  /** Extra actions for the choose view, such as the local demo area. */
  extraActions?: ReactNode;
}

type Phase =
  | { kind: 'choose' }
  | { kind: 'custom'; initial: Partial<CustomPoint>; key: number }
  | { kind: 'review'; draft: LocationDraft };

type FailureState = { message: string | null; fields: { field: string; message: string }[] };
const NO_FAILURE: FailureState = { message: null, fields: [] };

/**
 * The location step: search worldwide, use the device location (only after a button
 * press), pick on a map, or type a place; then review and confirm. Each path has a
 * fallback, so the step completes with no map, no permission or no provider.
 */
export function LocationStep({ onConfirmed, onCancel, extraActions }: LocationStepProps) {
  const adapter = usePlaces();
  const { confirm, pending, canSave } = useConfirmLocation();
  const [phase, setPhase] = useState<Phase>({ kind: 'choose' });
  const [locating, setLocating] = useState(false);
  const [geoOutcome, setGeoOutcome] = useState<Exclude<GeolocationOutcome['kind'], 'fix'> | null>(
    null,
  );
  const [failure, setFailure] = useState<FailureState>(NO_FAILURE);

  const review = (draft: LocationDraft) => {
    setFailure(NO_FAILURE);
    setPhase({ kind: 'review', draft });
  };
  const back = () => {
    setFailure(NO_FAILURE);
    setPhase({ kind: 'choose' });
  };

  async function locateDevice() {
    setLocating(true);
    setGeoOutcome(null);
    const outcome = await requestDevicePosition();
    if (outcome.kind !== 'fix') {
      setGeoOutcome(outcome.kind);
      setLocating(false);
      return;
    }
    const nearby = await adapter.reverse(outcome.latitude, outcome.longitude);
    setLocating(false);
    const closest = nearby[0];
    review({
      origin: 'GEOLOCATION',
      accuracyMeters: outcome.accuracyMeters,
      nearby,
      place: {
        placeId: '',
        name: 'My device location',
        // A reverse-geocoded street address is more precise than planning needs.
        formattedAddress: null,
        latitude: outcome.latitude,
        longitude: outcome.longitude,
        countryCode: closest?.countryCode ?? null,
        scope: 'POINT',
        types: [],
        admin: closest?.admin ?? {
          countryName: null,
          admin1: null,
          admin2: null,
          locality: null,
          sublocality: null,
        },
      },
    });
  }

  const pickOnMap = useCallback(
    (latitude: string, longitude: string) => {
      setPhase({ kind: 'custom', initial: { latitude, longitude }, key: Date.now() });
      void adapter.reverse(latitude, longitude).then((places) => {
        const country = places[0]?.countryCode;
        if (!country) return;
        setPhase((p) =>
          p.kind === 'custom' && p.initial.latitude === latitude
            ? { ...p, initial: { ...p.initial, countryCode: country }, key: p.key + 1 }
            : p,
        );
      });
    },
    [adapter],
  );

  async function submit(input: LocationDraftInput) {
    setFailure(NO_FAILURE);
    try {
      onConfirmed(await confirm(input));
    } catch (error) {
      if (error instanceof MutationFailure) {
        setFailure({
          message: error.error.fieldErrors.length === 0 ? error.message : null,
          fields: error.error.fieldErrors,
        });
      } else {
        setFailure({
          message: 'Could not save the location. Check your connection and try again.',
          fields: [],
        });
      }
    }
  }

  const reviewed = phase.kind === 'review' ? phase.draft.place : null;
  const mapPoint = useMemo(
    () => (reviewed ? { latitude: reviewed.latitude, longitude: reviewed.longitude } : null),
    [reviewed],
  );

  return (
    <div className={styles.step}>
      <div className={styles.main}>
        {!canSave && (
          <Notice kind="info">Start planning first; your location is saved to the session.</Notice>
        )}
        {phase.kind === 'review' ? (
          <CandidateReview
            draft={phase.draft}
            pending={pending}
            canSave={canSave}
            failure={failure.message}
            fieldErrors={failure.fields}
            onConfirm={(input) => void submit(input)}
            onChoosePlace={(place: Place) => review({ origin: 'PLACE_SEARCH', place })}
            onBack={back}
          />
        ) : phase.kind === 'custom' ? (
          <section aria-labelledby="custom-location-title" className={styles.card}>
            <h2 id="custom-location-title" className={styles.title}>
              Enter a location yourself
            </h2>
            <p className={styles.hint}>For places search does not know. It stays private to you.</p>
            <CustomLocationForm
              key={phase.key}
              initial={phase.initial}
              onSubmit={(place) => review({ origin: 'CUSTOM', place })}
              onCancel={back}
            />
          </section>
        ) : (
          <>
            <section aria-label="Choose your location" className={styles.card}>
              <LocationSearch
                adapter={adapter}
                onSelect={(place) => review({ origin: 'PLACE_SEARCH', place })}
                onEnterManually={() => setPhase({ kind: 'custom', initial: {}, key: Date.now() })}
              />
              <div className={styles.actions}>
                <Button
                  variant="secondary"
                  startIcon="target"
                  loading={locating}
                  onClick={() => void locateDevice()}
                >
                  Use my location
                </Button>
                <Button
                  variant="secondary"
                  startIcon="plus"
                  onClick={() => setPhase({ kind: 'custom', initial: {}, key: Date.now() })}
                >
                  Enter it yourself
                </Button>
                {extraActions}
                {onCancel && (
                  <Button variant="ghost" onClick={onCancel}>
                    Keep the current location
                  </Button>
                )}
              </div>
              <p className={styles.hint}>
                Your browser asks before sharing your location. You review it before anything is
                saved.
              </p>
              {geoOutcome && (
                <p role="alert" className={styles.error}>
                  {GEOLOCATION_MESSAGE[geoOutcome]}
                </p>
              )}
            </section>
          </>
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
