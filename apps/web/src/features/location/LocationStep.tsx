import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { createPortal } from 'react-dom';

import { AreaConditions } from '../area/AreaConditions';
import { Button, Notice, WaterDropletLoader } from '../../components';
import { graphqlRequest, MutationFailure } from '../../graphql/client';
import {
  AreaBaselineDocument,
  type AreaBaselineQuery,
  type AreaLocationFieldsFragment,
} from '../../graphql/generated/graphql';
import { queryKeys } from '../../graphql/queryKeys';
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
  initialArea?: AreaLocationFieldsFragment & { placeId?: string | null };
  sessionId?: string;
  onResultsChange?: (ready: boolean) => void;
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
export function LocationStep({
  onConfirmed,
  onCancel,
  initialArea,
  sessionId,
  onResultsChange,
}: LocationStepProps) {
  const adapter = usePlaces();
  const queryClient = useQueryClient();
  const [working, setWorking] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [result, setResult] = useState<AreaBaselineQuery['area'] | null>(null);
  const resultsElement = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!result) return;
    const frame = requestAnimationFrame(() => {
      const target = resultsElement.current;
      target?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
        block: 'start',
      });
      target?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [result]);
  const clearResults = useCallback(() => {
    setResult(null);
    onResultsChange?.(false);
  }, [onResultsChange]);
  const { confirm, pending, canSave } = useConfirmLocation();
  const [draft, setDraft] = useState<LocationDraft | null>(() =>
    initialArea && initialArea.centroidLat != null && initialArea.centroidLon != null
      ? {
          origin: initialArea.origin === 'CATALOGUE' ? 'CUSTOM' : initialArea.origin,
          accuracyMeters: initialArea.accuracyMeters ?? undefined,
          place: {
            placeId: initialArea.placeId ?? '',
            name: initialArea.name,
            formattedAddress: initialArea.formattedAddress,
            latitude: initialArea.centroidLat,
            longitude: initialArea.centroidLon,
            countryCode: initialArea.countryCode,
            scope: initialArea.scope,
            types: [],
            admin: initialArea.admin,
          },
        }
      : null,
  );
  const [previewPlace, setPreviewPlace] = useState<Place | null>(null);
  const [previewRadius, setPreviewRadius] = useState<number | null>(
    initialArea?.radiusMeters ?? 1000,
  );
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
      setPreviewPlace(candidate.place);
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
    clearResults();
    const token = ++selection.current;
    setFailure(NO_FAILURE);
    setGeoOutcome(null);
    setResolving(true);
    void resolveDraft(candidate, token);
  };
  const back = () => {
    clearResults();
    selection.current += 1;
    setFailure(NO_FAILURE);
    setResolving(false);
    setDraft(null);
    setPreviewPlace(null);
  };

  async function locateDevice() {
    clearResults();
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
      clearResults();
      const token = ++selection.current;
      setResolving(true);
      setGeoOutcome(null);
      setFailure(NO_FAILURE);
      void resolveDraft({ origin: 'CUSTOM', place: pointPlace(latitude, longitude) }, token);
    },
    [resolveDraft, clearResults],
  );

  async function submit(input: LocationDraftInput) {
    if (working) return;
    const token = selection.current;
    setFailure(NO_FAILURE);
    setLoadingProgress(0);
    setWorking(true);
    clearResults();
    let saved = false;
    try {
      const unchanged =
        initialArea &&
        !initialArea.providerContentExpired &&
        initialArea.centroidLat === input.latitude &&
        initialArea.centroidLon === input.longitude &&
        initialArea.name === input.name &&
        initialArea.radiusMeters === input.radiusMeters;
      const area = unchanged ? initialArea : await confirm(input);
      saved = true;
      if (token !== selection.current) return;
      setLoadingProgress(0.5);
      onConfirmed(area);
      if (sessionId) {
        const response = await queryClient.fetchQuery({
          queryKey: queryKeys.baseline.area(area.id, sessionId),
          queryFn: ({ signal }) =>
            graphqlRequest(AreaBaselineDocument, { areaId: area.id, sessionId }, { signal }),
          staleTime: 0,
          retry: false,
        });
        if (!response.area) throw new Error('The area returned no water conditions.');
        if (token !== selection.current) return;
        setLoadingProgress(1);
        setResult({ ...response.area });
        onResultsChange?.(true);
      }
    } catch (error) {
      if (token !== selection.current) return;
      setFailure(
        error instanceof MutationFailure
          ? {
              message: error.error.fieldErrors.length === 0 ? error.message : null,
              fields: error.error.fieldErrors,
            }
          : {
              message: saved
                ? 'Could not load water conditions. Click “Understand this area” to try again.'
                : 'Could not save the location. Check your connection and try again.',
              fields: [],
            },
      );
    } finally {
      if (token === selection.current) setWorking(false);
    }
  }

  const updateExtent = useCallback(
    (radius: number | null) => {
      setPreviewRadius(radius);
      clearResults();
    },
    [clearResults],
  );

  const mapPoint = useMemo(() => {
    const place = previewPlace ?? draft?.place;
    return place
      ? { latitude: place.latitude, longitude: place.longitude, radiusMeters: previewRadius }
      : null;
  }, [draft, previewPlace, previewRadius]);

  return (
    <div className={styles.step}>
      <div className={styles.main} inert={working}>
        {!canSave && (
          <Notice kind="info">Start planning first; your location is saved to the session.</Notice>
        )}
        {resolving && (
          <p role="status" className={styles.hint}>
            Finding your location…
          </p>
        )}

        <section aria-label="Choose your location" className={styles.card}>
          <div className={styles.searchHeading}>
            <h2 className={styles.title}>Search location</h2>
            <p className={styles.hint}>Search for a neighbourhood or pick a point on the map.</p>
          </div>
          <LocationSearch
            adapter={adapter}
            showHint={false}
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
          {!draft && failure.message && (
            <p role="alert" className={styles.error}>
              {failure.message}
            </p>
          )}
        </section>
        {draft && (
          <CandidateReview
            key={`${draft.origin}:${draft.place.latitude}:${draft.place.longitude}`}
            onExtentPreview={updateExtent}
            initialRadiusKm={(initialArea?.radiusMeters ?? 1000) / 1000}
            draft={draft}
            pending={pending || working}
            canSave={canSave && !resolving}
            failure={failure.message}
            fieldErrors={failure.fields}
            onConfirm={(input) => void submit(input)}
            onBack={back}
            onRetryName={() => review(draft)}
          />
        )}
      </div>
      <aside className={styles.aside} aria-label="Area map" inert={working}>
        <div className={styles.mapStage}>
          <MapPanel adapter={adapter} point={mapPoint} onPick={pickOnMap} showInstruction={false} />
          <p className={styles.mapLegend}>
            <span /> Your planning area (1–10 km radius)
            <span className={styles.legendNote}>Change the point, then adjust the area</span>
          </p>
        </div>
      </aside>
      {result && (
        <div
          ref={resultsElement}
          className={styles.results}
          tabIndex={-1}
          role="region"
          aria-label="Water conditions results"
        >
          <AreaConditions selected baseline={result.baseline} unitSystem={result.unitSystem} />
        </div>
      )}
      {working &&
        createPortal(
          <div className={styles.loadingOverlay} role="status" aria-live="polite">
            <div className={styles.loadingIndicator}>
              <WaterDropletLoader
                progress={loadingProgress}
                statusText="Understanding your area…"
              />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
