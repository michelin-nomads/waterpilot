/**
 * Disposable per-tab hints in sessionStorage. They survive a reload of the same tab and
 * vanish with it; nothing here is needed for correctness.
 */
const TAB_ID_KEY = 'waterlens.tabId.v1';
const RESTORED_DISMISSED_PREFIX = 'waterlens.restoredDismissed.v1:';

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

let fallbackTabId: string | null = null;

/** Stable for the life of this tab, so a reload finds the tab's own unsent edits. */
export function tabId(): string {
  const store = storage();
  try {
    const existing = store?.getItem(TAB_ID_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    store?.setItem(TAB_ID_KEY, created);
    return created;
  } catch {
    fallbackTabId ??= crypto.randomUUID();
    return fallbackTabId;
  }
}

export function restoredNoticeDismissed(at: number): boolean {
  try {
    return storage()?.getItem(`${RESTORED_DISMISSED_PREFIX}${at}`) === '1';
  } catch {
    return false;
  }
}

export function dismissRestoredNotice(at: number): void {
  try {
    storage()?.setItem(`${RESTORED_DISMISSED_PREFIX}${at}`, '1');
  } catch {
    // Storage blocked: the notice simply shows again after a reload.
  }
}
