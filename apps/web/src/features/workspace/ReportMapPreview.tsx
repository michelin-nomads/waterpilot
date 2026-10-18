import { useEffect, useRef, useState } from 'react';
import { env } from '../../config/env';
import { loadGoogleMaps, onAuthFailure } from '../location/googleMapsLoader';
import { AreaExtentTile } from './AreaExtentTile';
import type { BoundingBox } from './extentGeometry';
import styles from './ReportMapPreview.module.scss';

interface MapInstance {
  fitBounds(bounds: object, padding: number): void;
}
interface MapsLibrary {
  Map: new (host: HTMLElement, options: Record<string, unknown>) => MapInstance;
  Circle: new (options: Record<string, unknown>) => {
    getBounds(): object | null;
    setMap(map: null): void;
  };
}
interface MarkerLibrary {
  AdvancedMarkerElement: new (options: Record<string, unknown>) => { map: MapInstance | null };
  Marker: new (options: Record<string, unknown>) => { setMap(map: null): void };
}

/** Load only visible report maps; the saved location/extent remains authoritative. */
export function ReportMapPreview({
  name,
  latitude,
  longitude,
  box,
  radiusMeters,
}: {
  name: string;
  latitude: number;
  longitude: number;
  box: BoundingBox | null;
  radiusMeters: number | null;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);
  const south = box?.minLatitude,
    north = box?.maxLatitude;
  const west = box?.minLongitude,
    east = box?.maxLongitude;

  useEffect(() => {
    if (!host.current) return;
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' },
    );
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const config = env.maps;
    if (!visible || config.provider !== 'google' || !host.current) return;
    let disposed = false;
    const canvas = document.createElement('div');
    canvas.className = styles.canvas;
    host.current.append(canvas);
    const cleanups: (() => void)[] = [];
    const unsubscribe = onAuthFailure(() => {
      if (!disposed) setFailed(true);
    });
    void (async () => {
      const api = await loadGoogleMaps(config.apiKey);
      const [maps, markers] = await Promise.all([
        api.importLibrary('maps') as Promise<MapsLibrary>,
        api.importLibrary('marker') as Promise<MarkerLibrary>,
      ]);
      if (disposed) return;
      const center = { lat: latitude, lng: longitude };
      const map = new maps.Map(canvas, {
        center,
        zoom: 14,
        mapId: config.mapId ?? undefined,
        disableDefaultUI: true,
        gestureHandling: 'none',
        keyboardShortcuts: false,
        clickableIcons: false,
      });
      if (config.mapId) {
        const marker = new markers.AdvancedMarkerElement({ map, position: center, title: name });
        cleanups.push(() => {
          marker.map = null;
        });
      } else {
        const marker = new markers.Marker({ map, position: center, title: name });
        cleanups.push(() => marker.setMap(null));
      }
      if (radiusMeters != null && radiusMeters > 0) {
        const circle = new maps.Circle({
          map,
          center,
          radius: radiusMeters,
          strokeColor: '#008c95',
          strokeWeight: 1,
          fillColor: '#008c95',
          fillOpacity: 0.12,
        });
        const bounds = circle.getBounds();
        if (bounds) map.fitBounds(bounds, 20);
        cleanups.push(() => circle.setMap(null));
      } else if (south != null && north != null && west != null && east != null) {
        map.fitBounds({ south, north, west, east }, 20);
      }
    })().catch(() => {
      if (!disposed) setFailed(true);
    });
    return () => {
      disposed = true;
      unsubscribe();
      cleanups.forEach((cleanup) => cleanup());
      canvas.remove();
    };
  }, [visible, latitude, longitude, name, radiusMeters, south, north, west, east]);

  return (
    <div className={styles.preview}>
      <AreaExtentTile
        name={name}
        centroidLatitude={latitude}
        centroidLongitude={longitude}
        box={box}
        radiusChosen={radiusMeters != null}
      />
      <div
        ref={host}
        className={styles.host}
        aria-label={`Map preview of ${name}`}
        hidden={failed}
      />
      {(failed || env.maps.provider !== 'google') && (
        <span className={styles.fallback}>Map unavailable · saved location</span>
      )}
    </div>
  );
}
