import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { usePageVisible } from '../../lib/pageVisibility';
import { Icon, type IconName } from '../Icon/Icon';
import { ToastContext, type ToastApi, type ToastOptions, type ToastTone } from './toastContext';
import styles from './Toast.module.scss';

const DEFAULT_DURATION_MS = 6000;
const MAX_TOASTS = 3;

interface ToastRecord {
  id: string;
  message: string;
  tone: ToastTone;
  action?: ToastOptions['action'];
  durationMs: number | null;
}

const ICONS: Record<ToastTone, IconName> = {
  info: 'info',
  success: 'check',
  warning: 'alert',
  error: 'alert-circle',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback((options: ToastOptions) => {
    counter.current += 1;
    const tone = options.tone ?? 'info';
    const persistent = tone === 'error' || options.action !== undefined;
    const record: ToastRecord = {
      id: `toast-${counter.current}`,
      message: options.message,
      tone,
      action: options.action,
      durationMs:
        options.durationMs !== undefined
          ? options.durationMs
          : persistent
            ? null
            : DEFAULT_DURATION_MS,
    };
    setToasts((current) => [...current, record].slice(-MAX_TOASTS));
    return record.id;
  }, []);

  const api = useMemo<ToastApi>(() => ({ show, dismiss }), [show, dismiss]);
  const polite = toasts.filter((toast) => toast.tone !== 'error');
  const assertive = toasts.filter((toast) => toast.tone === 'error');

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className={styles.viewport} data-live-region="">
          <div role="status" className={styles.stack}>
            {polite.map((toast) => (
              <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
            ))}
          </div>
          <div role="alert" className={styles.stack}>
            {assertive.map((toast) => (
              <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
            ))}
          </div>
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastRecord; onDismiss: (id: string) => void }) {
  const [held, setHeld] = useState(false);
  const pageVisible = usePageVisible();
  const remaining = useRef(toast.durationMs);
  const paused = held || !pageVisible;

  // The timer only runs while the toast is visible and not hovered/focused.
  useEffect(() => {
    if (remaining.current === null || paused) return;
    const startedAt = Date.now();
    const timer = window.setTimeout(() => onDismiss(toast.id), remaining.current);
    return () => {
      window.clearTimeout(timer);
      if (remaining.current !== null) {
        remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt));
      }
    };
  }, [paused, toast.id, onDismiss]);

  return (
    <div
      className={`${styles.toast} ${styles[toast.tone]}`}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      <Icon name={ICONS[toast.tone]} />
      <p className={styles.message}>{toast.message}</p>
      {toast.action && (
        <button
          type="button"
          className={styles.action}
          onClick={() => {
            toast.action?.onAction();
            onDismiss(toast.id);
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        className={styles.dismiss}
        aria-label="Dismiss notification"
        onClick={() => onDismiss(toast.id)}
      >
        <Icon name="close" size="sm" />
      </button>
    </div>
  );
}
