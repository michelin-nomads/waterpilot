import { createContext, useContext } from 'react';

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface ToastOptions {
  message: string;
  tone?: ToastTone;
  action?: { label: string; onAction: () => void };
  /**
   * Auto-dismiss delay. Defaults to 6 s; errors and toasts with an action stay until
   * dismissed (`null`) so nobody loses a message or an action to a timer.
   */
  durationMs?: number | null;
}

export interface ToastApi {
  show: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used inside ToastProvider');
  return value;
}
