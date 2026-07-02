"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm debe usarse dentro de ConfirmProvider");
  return ctx;
}

function normalize(options: ConfirmOptions | string): Required<ConfirmOptions> {
  const opts = typeof options === "string" ? { message: options } : options;
  return {
    title: opts.title ?? "Confirmar",
    message: opts.message,
    confirmLabel: opts.confirmLabel ?? "Eliminar",
    cancelLabel: opts.cancelLabel ?? "Cancelar",
    destructive: opts.destructive ?? true,
  };
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Required<ConfirmOptions> | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setPending(normalize(options));
    });
  }, []);

  function resolve(value: boolean) {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setPending(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
          onClick={() => resolve(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-message"
            className="w-full max-w-sm space-y-4 rounded-2xl border bg-card p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="confirm-dialog-title" className="text-lg font-semibold">
              {pending.title}
            </h2>
            <p id="confirm-dialog-message" className="whitespace-pre-line text-sm text-muted-foreground">
              {pending.message}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => resolve(false)}
                className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-secondary"
              >
                {pending.cancelLabel}
              </button>
              <button
                autoFocus
                onClick={() => resolve(true)}
                className={[
                  "rounded-xl px-4 py-2 text-sm font-medium text-white",
                  pending.destructive ? "bg-destructive hover:bg-destructive/90" : "bg-primary hover:bg-primary/90",
                ].join(" ")}
              >
                {pending.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
