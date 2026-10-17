import { useEffect, type RefObject } from 'react';

/**
 * While `open`, calls `onDismiss` for Escape (reporting it, so the caller can return focus)
 * and for a pointer press outside `rootRef`. Shared by the disclosure menus.
 */
export function useDismissable(
  open: boolean,
  rootRef: RefObject<HTMLElement | null>,
  onDismiss: (reason: 'escape' | 'outside') => void,
): void {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss('escape');
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        onDismiss('outside');
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, rootRef, onDismiss]);
}
