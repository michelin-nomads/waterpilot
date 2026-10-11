/**
 * Controllable `window.matchMedia` for jsdom (which has none). Exact-string matching on
 * the query; tests flip queries with `setMediaQuery` and listeners are notified.
 */
const state = new Map<string, boolean>();
const listeners = new Map<string, Set<(event: MediaQueryListEvent) => void>>();

export function installMediaQueryMock(): void {
  window.matchMedia = (query: string): MediaQueryList => {
    const set = listeners.get(query) ?? new Set();
    listeners.set(query, set);
    return {
      get matches() {
        return state.get(query) ?? false;
      },
      media: query,
      onchange: null,
      addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) =>
        set.add(listener),
      removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) =>
        set.delete(listener),
      addListener: (listener: (event: MediaQueryListEvent) => void) => set.add(listener),
      removeListener: (listener: (event: MediaQueryListEvent) => void) => set.delete(listener),
      dispatchEvent: () => true,
    } as unknown as MediaQueryList;
  };
}

export function setMediaQuery(query: string, matches: boolean): void {
  state.set(query, matches);
  for (const listener of listeners.get(query) ?? []) {
    listener({ matches, media: query } as MediaQueryListEvent);
  }
}

export function resetMediaQueries(): void {
  state.clear();
}
