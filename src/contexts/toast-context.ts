import { createContext } from 'react';

export type ToastTone = 'success' | 'error' | 'info';

export type ToastInput = {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Defaults to 4s (6s for errors). */
  durationMs?: number;
};

export type ToastContextValue = {
  toast: (input: ToastInput) => void;
};

export const ToastContext = createContext<ToastContextValue | null>(null);
