import { Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { env } from '../../config/env';
import { loadGoogleMaps, onAuthFailure } from '../location/googleMapsLoader';
import { Button } from '../../components/Button/Button';
import { Icon } from '../../components/Icon/Icon';
import { Notice } from '../../components/Notice/Notice';
import type { CommunityItem, NearbyCentre } from './useCommunityDirectory';
import styles from './CommunityDirectory.module.scss';

interface MapInstance {
  fitBounds(bounds: object, padding: number): void;
}
interface MapPopup {
  open(options: { map: MapInstance; anchor: object; shouldFocus: boolean }): void;
  close(): void;
}
interface MapsLibrary {
  InfoWindow: new (options: Record<string, unknown>) => MapPopup;
  Map: new (host: HTMLElement, options: Record<string, unknown>) => MapInstance;
  Circle: new (options: Record<string, unknown>) => {
    setMap(map: null): void;
    getBounds(): object | null;
  };
}
interface MarkerLibrary {
  AdvancedMarkerElement: new (options: Record<string, unknown>) => {
    map: MapInstance | null;
    addListener(event: 'click', callback: () => void): { remove(): void };
  };
  Marker: new (options: Record<string, unknown>) => {
    setMap(map: null): void;
    addListener(event: 'click', callback: () => void): { remove(): void };
  };
}

/** Pins use rounded, public area references; never private addresses or exact stored points. */
export function CommunityMap({
  rows,
  centre,
  radius,
  isJoined,
  distanceMeters,
  joining,
  actionError,
  onJoin,
  onLeave,
  selectedCommunityId,
  onSelectCommunity,
}: {
  selectedCommunityId?: string | null;
  onSelectCommunity?: (id: string | null) => void;
  rows: CommunityItem[];
  centre: NearbyCentre | null;
  radius: number;
  isJoined: (community: CommunityItem) => boolean;
  distanceMeters: (id: string) => number | null;
  joining: boolean;
  actionError: { id: string; message: string } | null;
  onJoin: (id: string) => void;
  onLeave: (community: CommunityItem) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [popupHost] = useState(() => document.createElement('div'));
  const anchors = useRef(new Map<string, object>());
  const runtime = useRef<{
    map: MapInstance;
    maps: MapsLibrary;
    markers: MarkerLibrary;
    advanced: boolean;
    popup: MapPopup;
  } | null>(null);
  const [localSelectedId, setLocalSelectedId] = useState<string | null>(null);
  const selectedId = selectedCommunityId === undefined ? localSelectedId : selectedCommunityId;
  const setSelectedId = useCallback(
    (id: string | null) => {
      if (onSelectCommunity) onSelectCommunity(id);
      else setLocalSelectedId(id);
    },
    [onSelectCommunity],
  );
  const pinElements = useRef(new Map<string, HTMLElement>());
  const selected = rows.find((row) => row.id === selectedId && row.status === 'ACTIVE') ?? null;
  const distance = selected ? distanceMeters(selected.id) : null;
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const points = useMemo(
    () =>
      rows.flatMap((row) => {
        if (row.status !== 'ACTIVE' || !row.area?.mapLatitude || !row.area.mapLongitude) return [];
        const lat = Number(row.area.mapLatitude),
          lng = Number(row.area.mapLongitude);
        return Number.isFinite(lat) && Number.isFinite(lng)
          ? [{ id: row.id, name: row.name, lat, lng }]
          : [];
      }),
    [rows],
  );

  useEffect(() => {
    const config = env.maps;
    if (config.provider !== 'google' || !host.current) return;
    const { apiKey, mapId } = config;
    let disposed = false;
    const canvas = document.createElement('div');
    canvas.className = styles.mapCanvas;
    host.current.append(canvas);
    const unsubscribe = onAuthFailure(() => {
      if (!disposed) setStatus('failed');
    });
    async function mount() {
      const api = await loadGoogleMaps(apiKey);
      const maps = (await api.importLibrary('maps')) as MapsLibrary;
      const markers = (await api.importLibrary('marker')) as MarkerLibrary;
      if (disposed) return;
      const map = new maps.Map(canvas, {
        center: { lat: 20, lng: 0 },
        zoom: 2,
        maxZoom: 15,
        mapId: mapId ?? undefined,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
      });
      const popup = new maps.InfoWindow({
        content: popupHost,
        headerDisabled: true,
        maxWidth: 240,
      });
      runtime.current = { map, maps, markers, advanced: Boolean(mapId), popup };
      setStatus('ready');
    }
    void mount().catch(() => {
      if (!disposed) setStatus('failed');
    });
    return () => {
      disposed = true;
      unsubscribe();
      runtime.current?.popup.close();
      runtime.current = null;
      canvas.remove();
    };
  }, [popupHost]);

  // Reuse the same map while filters/radius change; only replace its overlays.
  useEffect(() => {
    if (status !== 'ready' || !runtime.current) return;
    const { map, maps, markers, advanced } = runtime.current;
    const cleanups: Array<() => void> = [];
    const markerAnchors = anchors.current;
    const elements = pinElements.current;
    elements.clear();
    markerAnchors.clear();
    const bounds = { north: -90, south: 90, east: -180, west: 180 };
    points.forEach((point) => {
      const position = { lat: point.lat, lng: point.lng };
      bounds.north = Math.max(bounds.north, position.lat);
      bounds.south = Math.min(bounds.south, position.lat);
      bounds.east = Math.max(bounds.east, position.lng);
      bounds.west = Math.min(bounds.west, position.lng);
      if (advanced) {
        const link = document.createElement('button');
        link.type = 'button';
        elements.set(point.id, link);
        link.onclick = () => setSelectedId(point.id);
        link.className = styles.mapPin;

        link.setAttribute('aria-label', `${point.name} — show community on map`);
        const marker = new markers.AdvancedMarkerElement({
          map,
          position,
          title: point.name,
          gmpClickable: true,
          content: link,
        });
        markerAnchors.set(point.id, marker);
        const listener = marker.addListener('click', () => setSelectedId(point.id));
        cleanups.push(() => {
          listener.remove();
          marker.map = null;
        });
      } else {
        const marker = new markers.Marker({
          map,
          position,
          title: point.name,
        });
        markerAnchors.set(point.id, marker);
        const listener = marker.addListener('click', () => setSelectedId(point.id));
        cleanups.push(() => {
          listener.remove();
          marker.setMap(null);
        });
      }
    });
    if (centre) {
      const circle = new maps.Circle({
        map,
        center: { lat: Number(centre.latitude), lng: Number(centre.longitude) },
        radius,
        strokeColor: '#008f95',
        fillColor: '#008f95',
        fillOpacity: 0.12,
        strokeWeight: 2,
        clickable: false,
      });
      const circleBounds = circle.getBounds();
      if (circleBounds) map.fitBounds(circleBounds, 32);
      cleanups.push(() => circle.setMap(null));
    } else if (points.length) map.fitBounds(bounds, 48);
    return () => {
      runtime.current?.popup.close();
      cleanups.forEach((cleanup) => cleanup());
      markerAnchors.clear();
      elements.clear();
    };
  }, [centre, radius, points, status, setSelectedId]);

  useEffect(() => {
    pinElements.current.forEach((element, id) =>
      element.setAttribute('aria-pressed', String(id === selectedId)),
    );
    const view = runtime.current;
    const anchor = selected ? anchors.current.get(selected.id) : null;
    if (view && anchor) view.popup.open({ map: view.map, anchor, shouldFocus: false });
    else view?.popup.close();
  }, [selected, selectedId, points, status]);

  return (
    <aside className={styles.mapAside} aria-label="Community map">
      {env.maps.provider !== 'google' || status === 'failed' ? (
        <Notice kind="info" title="Map unavailable">
          You can still browse community details and join from the list.
        </Notice>
      ) : (
        <div className={styles.mapFrame}>
          <div
            ref={host}
            className={styles.map}
            role="region"
            aria-label="Map of public community areas"
          />
          {selected &&
            createPortal(
              <section
                className={styles.mapPopup}
                aria-label={`Community preview: ${selected.name}`}
              >
                <button
                  type="button"
                  className={styles.popupClose}
                  aria-label="Close community preview"
                  onClick={() => setSelectedId(null)}
                >
                  <Icon name="close" size="sm" />
                </button>
                <div className={styles.popupHeading}>
                  <span className={styles.popupIcon} aria-hidden="true">
                    <Icon name="droplet" size="sm" />
                  </span>
                  <h3>{selected.name}</h3>
                </div>
                <p>
                  {distance !== null ? `${(distance / 1000).toLocaleString()} km · ` : ''}
                  {selected.memberCount} {selected.memberCount === 1 ? 'member' : 'members'}
                </p>
                <div className={styles.popupActions}>
                  {isJoined(selected) ? (
                    <Button
                      size="sm"
                      variant="danger"
                      fullWidth
                      loading={joining}
                      onClick={() => onLeave(selected)}
                    >
                      Leave community
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      fullWidth
                      loading={joining}
                      onClick={() => onJoin(selected.id)}
                    >
                      Join community
                    </Button>
                  )}
                  {actionError?.id === selected.id && (
                    <p role="alert" className={styles.error}>
                      {actionError.message}
                    </p>
                  )}
                  <Link className={styles.viewLink} to={`/communities/${selected.id}`}>
                    View community
                  </Link>
                </div>
              </section>,
              popupHost,
            )}
        </div>
      )}
      <p className={styles.mapNote}>
        {points.length} approximate community {points.length === 1 ? 'location' : 'locations'}{' '}
        shown. Pins are rounded neighbourhood references, not building addresses or boundaries.{' '}
        {centre ? `${centre.label} · search radius: ${radius / 1000} km. ` : ''}Proximity does not
        establish hydrological connectivity.
      </p>
    </aside>
  );
}
