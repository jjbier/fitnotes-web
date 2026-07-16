/**
 * Modal simple para añadir/editar/borrar el comentario de texto libre de una
 * serie (`Set.comment`).
 */

"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Props de `SetCommentModal`.
 * @property initialComment - Comentario actual de la serie (vacío si no tiene).
 * @property onSave - Se invoca con el comentario final (recortado con `trim()`, o `""` al borrar) al guardar/borrar.
 * @property onClose - Cierra el modal (clic fuera, Escape, Cancelar o tras guardar/borrar).
 */
interface Props {
  initialComment: string;
  onSave: (comment: string) => void;
  onClose: () => void;
}

/**
 * Textarea controlado con foco automático al abrir y cierre con Escape. El
 * botón "Borrar" solo aparece si ya hay texto y guarda un comentario vacío
 * directamente (sin pasar por el textarea).
 */
export default function SetCommentModal({ initialComment, onSave, onClose }: Props) {
  const [value, setValue] = useState(initialComment);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="comment-modal-title"
        className="w-full max-w-sm mx-4 rounded-xl border bg-card p-5 shadow-lg space-y-4"
      >
        <h2 id="comment-modal-title" className="font-semibold text-sm">Comentario de serie</h2>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={3}
          placeholder="Añade una nota sobre esta serie…"
          className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
        />

        <div className="flex gap-2 justify-end">
          {value && (
            <button
              onClick={() => { onSave(""); onClose(); }}
              className="rounded-xl border px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary"
            >
              Borrar
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-xl border px-3 py-1.5 text-sm hover:bg-secondary"
          >
            Cancelar
          </button>
          <button
            onClick={() => { onSave(value.trim()); onClose(); }}
            className="rounded-xl bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
