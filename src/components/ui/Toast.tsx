'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from './cn';

// Minimal toast system for confirmations (link copied, saved, claim submitted).
// Mount <ToastProvider> once high in the tree; call useToast() anywhere.

type ToastTone = 'success' | 'error' | 'info';
type ToastItem = { id: number; message: string; tone: ToastTone };

type ToastContextValue = { toast: (message: string, tone?: ToastTone) => void };
const ToastContext = createContext<ToastContextValue | null>(null);

const toneClasses: Record<ToastTone, string> = {
  success: 'bg-teal-700 text-white',
  error: 'bg-red-600 text-white',
  info: 'bg-ink text-white',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const toast = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = ++idRef.current;
    setItems((prev) => [...prev, { id, message, tone }]);
    window.setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 3200);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[80] flex flex-col items-center gap-2 px-4 sm:bottom-6">
            {items.map((t) => (
              <div
                key={t.id}
                role="status"
                className={cn(
                  'pointer-events-auto max-w-sm rounded-full px-4 py-2 text-sm font-medium shadow-lg animate-fade-up',
                  toneClasses[t.tone],
                )}
              >
                {t.message}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  // No-op fallback so callers never crash if the provider isn't mounted yet.
  return ctx ?? { toast: () => {} };
}
