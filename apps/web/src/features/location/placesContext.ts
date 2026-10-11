import { createContext, useContext } from 'react';

import { env, type MapsConfig } from '../../config/env';
import { loadGoogleMaps, onAuthFailure } from './googleMapsLoader';
import { googlePlaces } from './googlePlaces';
import { serverPlaces } from './serverPlaces';
import type { PlacesAdapter } from './types';

/** Google only in a pilot with a browser key; otherwise the API (fixture locally). */
export function createPlacesAdapter(maps: MapsConfig): PlacesAdapter {
  if (maps.provider === 'google') {
    return googlePlaces(() => loadGoogleMaps(maps.apiKey), {
      mapId: maps.mapId,
      onAuthFailure,
    });
  }
  return serverPlaces(maps.provider === 'fixture' ? 'fixture' : 'server');
}

let shared: PlacesAdapter | null = null;

/** Tests wrap the location step in this provider with a fake adapter. */
export const PlacesContext = createContext<PlacesAdapter | null>(null);

export function usePlaces(): PlacesAdapter {
  const injected = useContext(PlacesContext);
  if (injected) return injected;
  shared ??= createPlacesAdapter(env.maps);
  return shared;
}
