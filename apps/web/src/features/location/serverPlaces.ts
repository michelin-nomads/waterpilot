import { graphqlRequest } from '../../graphql/client';
import { ResolveLocationDocument, ReverseLocationDocument } from '../../graphql/generated/graphql';
import { GraphQLRequestError } from '../../graphql/requestError';
import { PlacesUnavailable, type PlacesAdapter, type Suggestion } from './types';

const isAbort = (error: unknown) =>
  error instanceof DOMException
    ? error.name === 'AbortError'
    : (error as { code?: string } | null)?.code === 'ERR_CANCELED';

/**
 * Places through the WaterLens API (`resolveLocation` / `reverseLocation`). In local mode
 * the API answers from its labelled test gazetteer, so nothing billable is called. In a
 * pilot without a browser key it uses the server's provider, or reports unavailable.
 * There is no map here.
 */
export function serverPlaces(provider: 'fixture' | 'server'): PlacesAdapter {
  return {
    provider,
    attribution:
      provider === 'fixture'
        ? 'Local test gazetteer: approximate, not real place data'
        : 'Place search by the WaterLens service',
    hasMap: false,

    async suggest(text, signal) {
      try {
        const data = await graphqlRequest(ResolveLocationDocument, { text }, { signal });
        return data.resolveLocation.candidates.map((place): Suggestion => ({
          id: place.placeId,
          primary: place.name,
          secondary: place.formattedAddress,
          place,
        }));
      } catch (error) {
        if (signal.aborted || isAbort(error)) return [];
        if (error instanceof GraphQLRequestError && error.code === 'SERVICE_UNAVAILABLE') {
          throw new PlacesUnavailable();
        }
        throw error;
      }
    },

    select(suggestion) {
      if (!suggestion.place) return Promise.reject(new PlacesUnavailable());
      return Promise.resolve(suggestion.place);
    },

    async reverse(latitude, longitude) {
      try {
        const data = await graphqlRequest(ReverseLocationDocument, { latitude, longitude });
        return data.reverseLocation.candidates;
      } catch {
        return [];
      }
    },

    mountMap() {
      return Promise.reject(new PlacesUnavailable('No map is configured.'));
    },
  };
}
