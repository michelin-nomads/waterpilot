import { useEffect, useState } from 'react';

import { PlacesUnavailable, type PlacesAdapter, type Suggestion } from './types';

export const DEBOUNCE_MS = 300;
export const MIN_CHARS = 3;

export type SuggestionsState =
  | { status: 'idle'; suggestions: [] }
  | { status: 'loading'; suggestions: Suggestion[] }
  | { status: 'ready'; suggestions: Suggestion[] }
  | { status: 'unavailable' | 'error'; suggestions: [] };

/**
 * Debounced provider suggestions: waits {@link DEBOUNCE_MS} after the last keystroke,
 * needs {@link MIN_CHARS} characters and drops any answer a newer keystroke superseded.
 * Results are not put in the shared query cache: provider content is only kept for the
 * search in progress (ADR 0009).
 */
export function useSuggestions(adapter: PlacesAdapter, text: string, attempt = 0) {
  const query = text.trim();
  const [state, setState] = useState<SuggestionsState>({ status: 'idle', suggestions: [] });

  useEffect(() => {
    if (query.length < MIN_CHARS) {
      setState({ status: 'idle', suggestions: [] });
      return;
    }
    const controller = new AbortController();
    setState((s) => ({ status: 'loading', suggestions: s.suggestions }));
    const timer = window.setTimeout(() => {
      adapter.suggest(query, controller.signal).then(
        (suggestions) => {
          if (!controller.signal.aborted) setState({ status: 'ready', suggestions });
        },
        (error: unknown) => {
          if (controller.signal.aborted) return;
          setState({
            status: error instanceof PlacesUnavailable ? 'unavailable' : 'error',
            suggestions: [],
          });
        },
      );
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [adapter, query, attempt]);

  return state;
}
