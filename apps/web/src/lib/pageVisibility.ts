import { useSyncExternalStore } from 'react';

/**
 * Mirrors `document.hidden` onto `<html data-page-hidden>` so CSS can pause ambient
 * animations (see the `ambient-animation` mixin) while the tab is in the background.
 */
export function installPageVisibilityAttribute(doc: Document = document): () => void {
  const sync = () => doc.documentElement.setAttribute('data-page-hidden', String(doc.hidden));
  sync();
  doc.addEventListener('visibilitychange', sync);
  return () => doc.removeEventListener('visibilitychange', sync);
}

function subscribe(onChange: () => void): () => void {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}

export function usePageVisible(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => !document.hidden,
    () => true,
  );
}
