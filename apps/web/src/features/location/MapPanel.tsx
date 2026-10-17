import { useEffect, useRef, useState } from 'react';

import { Notice } from '../../components';
import type { MapView, PlacesAdapter } from './types';
import styles from './Location.module.scss';

interface MapPanelProps {
  adapter: PlacesAdapter;
  point: { latitude: string; longitude: string; radiusMeters?: number | null } | null;
  onPick: (latitude: string, longitude: string) => void;
}

const NO_MAP: Record<PlacesAdapter['provider'], string> = {
  fixture:
    'Local mode shows no map, so no map service is called. Search, use your device location.',
  server: 'No map is configured for this deployment. Search, use your device location.',
  google: '',
};

/**
 * Optional map. Loaded only when this step is shown; an outage, rejected key or timeout
 * leaves search, device location and device location fully usable.
 */
export function MapPanel({ adapter, point, onPick }: MapPanelProps) {
  const element = useRef<HTMLDivElement>(null);
  const view = useRef<MapView | null>(null);
  const pick = useRef(onPick);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');

  useEffect(() => {
    pick.current = onPick;
  }, [onPick]);

  useEffect(() => {
    if (!adapter.hasMap || !element.current) return;
    let cancelled = false;
    let owned: MapView | null = null;
    const host = document.createElement('div');
    host.className = styles.mapCanvas;
    element.current.append(host);
    adapter
      .mountMap(host, {
        onPick: (lat, lon) => pick.current(lat, lon),
        onFailure: () => setStatus('failed'),
      })
      .then(
        (mounted) => {
          if (cancelled) mounted.destroy();
          else {
            owned = mounted;
            view.current = mounted;
            setStatus('ready');
          }
        },
        () => {
          if (!cancelled) setStatus('failed');
        },
      );
    return () => {
      cancelled = true;
      owned?.destroy();
      if (view.current === owned) view.current = null;
      host.remove();
    };
  }, [adapter]);

  useEffect(() => {
    if (status === 'ready' && point) view.current?.show(point);
  }, [status, point]);

  if (!adapter.hasMap) {
    return (
      <Notice kind="info" title="No map" announce={false}>
        {NO_MAP[adapter.provider]}
      </Notice>
    );
  }
  return (
    <div className={styles.mapWrap}>
      {status === 'failed' ? (
        <Notice kind="offline" title="The map is unavailable">
          The map could not load. Search for a place or use your device location instead; nothing
          else is affected.
        </Notice>
      ) : (
        <>
          <div
            ref={element}
            className={styles.map}
            role="region"
            aria-label="Map. Click to pick a point, which you then review before saving."
            aria-busy={status === 'loading'}
          />
          <p className={styles.hint}>Click the map to pick a point. You review it before saving.</p>
        </>
      )}
    </div>
  );
}
