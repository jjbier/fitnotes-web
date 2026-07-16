/**
 * Sustituto accesible y estilizado de `window.confirm()`.
 *
 * `window.confirm()` bloquea el hilo principal, no se puede estilizar, no
 * respeta el tema de la app y Playwright/tests no pueden interactuar con él
 * de forma consistente entre navegadores. Este módulo expone en su lugar:
 *
 * - {@link ConfirmProvider}: monta una única instancia del diálogo
 *   (`role="alertdialog"`) en el árbol de la app y su estado de "petición
 *   pendiente" en contexto de React.
 * - {@link useConfirm}: hook que devuelve una función `confirm(options)` con
 *   la misma forma de uso que `window.confirm` pero async y basada en
 *   Promise — se resuelve a `true`/`false` según el botón pulsado.
 *
 * Uso típico desde cualquier componente hijo de `ConfirmProvider`:
 * ```tsx
 * const confirm = useConfirm();
 * async function handleDelete() {
 *   const ok = await confirm({ message: "¿Eliminar este ejercicio?" });
 *   if (!ok) return;
 *   await onDelete(id);
 * }
 * ```
 * Solo puede haber una confirmación pendiente a la vez (estado `pending`
 * único a nivel de provider); una segunda llamada a `confirm()` antes de que
 * el usuario resuelva la primera sustituye el diálogo mostrado.
 */
"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

/** Opciones de personalización de un diálogo de confirmación. */
interface ConfirmOptions {
  /** Título del diálogo; por defecto "Confirmar". */
  title?: string;
  /** Mensaje principal (admite saltos de línea, se renderiza con `whitespace-pre-line`). */
  message: string;
  /** Texto del botón de confirmación; por defecto "Eliminar". */
  confirmLabel?: string;
  /** Texto del botón de cancelación; por defecto "Cancelar". */
  cancelLabel?: string;
  /** Si es `true` (por defecto), el botón de confirmación se pinta como acción destructiva (rojo) en vez de primaria. */
  destructive?: boolean;
}

/**
 * Firma de la función devuelta por {@link useConfirm}. Acepta bien un string
 * (usado como `message` con el resto de opciones por defecto) o un objeto
 * {@link ConfirmOptions} completo. Se resuelve a `true` si el usuario confirma,
 * `false` si cancela o cierra el diálogo (clic fuera).
 */
type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * Hook para solicitar una confirmación al usuario. Debe usarse dentro de un
 * árbol envuelto en {@link ConfirmProvider}; lanza si no lo está, para
 * detectar pronto un provider olvidado en vez de fallar en silencio.
 */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm debe usarse dentro de ConfirmProvider");
  return ctx;
}

/** Rellena los valores por defecto de {@link ConfirmOptions}, aceptando también la forma abreviada `string`. */
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

/**
 * Provider que monta el diálogo de confirmación y expone `confirm()` vía
 * contexto a todos sus descendientes (a través de {@link useConfirm}).
 *
 * Internamente mantiene la petición pendiente en `pending` (o `null` si no
 * hay ninguna) y el resolver de la Promise en curso en un ref; `confirm()`
 * crea una nueva Promise, guarda su `resolve` y actualiza `pending` para
 * mostrar el diálogo. Pulsar un botón (o hacer clic en el overlay, que
 * cuenta como cancelar) invoca `resolve(value)`, que resuelve la Promise
 * pendiente y limpia el estado.
 */
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
