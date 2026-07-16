/**
 * Modal para cambiar la fecha de un entrenamiento ya existente. Comprueba en
 * cada cambio de fecha si ya existe otro entrenamiento en ese día (un
 * entrenamiento por fecha) y bloquea el botón "Mover" si hay conflicto.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { createBrowserClient, createWorkoutRepository } from "@fitnotes/database";

/**
 * Props de `MoveWorkoutModal`.
 * @property workoutId - Id del entrenamiento a mover.
 * @property currentDate - Fecha actual del entrenamiento (fecha inicial del selector; mover a la misma fecha desactiva el botón).
 * @property onMoved - Se invoca con la nueva fecha tras confirmar el movimiento en el backend.
 * @property onClose - Cierra el modal (clic fuera, Escape, Cancelar o tras mover).
 */
interface Props {
  workoutId: string;
  currentDate: string;
  onMoved: (newDate: string) => void;
  onClose: () => void;
}

/**
 * Selector de fecha con comprobación de conflicto en vivo: cada vez que
 * cambia `targetDate` (y difiere de `currentDate`) consulta
 * `getWorkoutByDate` para saber si esa fecha ya tiene entrenamiento y, de ser
 * así, deshabilita "Mover" y muestra un aviso. La fecha máxima seleccionable
 * es hoy (no se permite mover entrenamientos a fechas futuras).
 */
export default function MoveWorkoutModal({ workoutId, currentDate, onMoved, onClose }: Props) {
  const [targetDate, setTargetDate] = useState(currentDate);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  const client = createBrowserClient();
  const repo = createWorkoutRepository(client);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (targetDate === currentDate) { setConflict(false); return; }
    async function checkConflict() {
      const { data } = await repo.getWorkoutByDate(targetDate);
      setConflict(!!data);
    }
    checkConflict();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetDate, currentDate]);

  async function handleMove() {
    if (targetDate === currentDate || conflict) return;
    setSaving(true);
    await repo.moveWorkout(workoutId, targetDate);
    setSaving(false);
    onMoved(targetDate);
    onClose();
  }

  const today = new Date().toISOString().split("T")[0]!;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="move-modal-title"
        className="w-full max-w-sm rounded-xl border bg-card shadow-lg"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b">
          <h2 id="move-modal-title" className="font-semibold">Mover entrenamiento</h2>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Cerrar"
            className="text-muted-foreground hover:text-foreground text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="target-date" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Nueva fecha
            </label>
            <input
              id="target-date"
              type="date"
              value={targetDate}
              max={today}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {conflict && (
            <p className="text-xs text-destructive">
              Ya existe un entrenamiento en esa fecha. Elige otra.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end px-5 pb-5">
          <button
            onClick={onClose}
            className="rounded-xl border px-4 py-2 text-sm hover:bg-secondary"
          >
            Cancelar
          </button>
          <button
            onClick={handleMove}
            disabled={saving || targetDate === currentDate || conflict || !targetDate}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "Moviendo…" : "Mover"}
          </button>
        </div>
      </div>
    </div>
  );
}
