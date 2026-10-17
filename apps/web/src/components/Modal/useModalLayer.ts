import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute('hidden') && !el.closest('[hidden],[inert]'),
  );
}

let scrollLocks = 0;

interface Options {
  open: boolean;
  onClose: () => void;
  /** The element carrying role="dialog". */
  panelRef: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * Modal behaviour for Dialog and Drawer: moves focus in, traps Tab, closes on Escape,
 * makes everything else in <body> inert, locks page scroll, and on close returns focus to
 * the element that opened it. Nested layers stack because each one inerts its siblings.
 */
export function useModalLayer({ open, onClose, panelRef, initialFocusRef }: Options): void {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const panel = panelRef.current;
    if (!open || !panel) return;

    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const layer = panel.closest<HTMLElement>('[data-modal-layer]') ?? panel;

    const inerted: Element[] = [];
    for (const el of Array.from(document.body.children)) {
      const exempt = el.hasAttribute('data-live-region') || el.tagName === 'SCRIPT';
      if (el !== layer && !exempt && !el.hasAttribute('inert')) {
        el.setAttribute('inert', '');
        inerted.push(el);
      }
    }

    scrollLocks += 1;
    document.documentElement.classList.add('wp-scroll-locked');

    (initialFocusRef?.current ?? getFocusable(panel)[0] ?? panel).focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = getFocusable(panel);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) {
        event.preventDefault();
        panel.focus();
      } else if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === panel)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    layer.addEventListener('keydown', onKeyDown);

    return () => {
      layer.removeEventListener('keydown', onKeyDown);
      for (const el of inerted) el.removeAttribute('inert');
      scrollLocks -= 1;
      if (scrollLocks === 0) document.documentElement.classList.remove('wp-scroll-locked');
      if (opener?.isConnected) opener.focus();
    };
  }, [open, panelRef, initialFocusRef]);
}
