/**
 * Modal para editar las series predefinidas de un ejercicio dentro de un día
 * de rutina: al "Registrar todo" en {@link DaySection}, estas series se usan
 * como plantilla para las series que se crean automáticamente. Una fila
 * vacía significa "copiar del historial anterior" en lugar de un valor fijo.
 * El formulario muestra columnas distintas (peso/reps vs. distancia/tiempo)
 * según el tipo de ejercicio.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { useFocusTrap } from "@/lib/useFocusTrap";
import type { PredefinedSet, RoutineDayExercise, Exercise } from "@fitnotes/core";

/** Fila de edición local del formulario; todos los valores se mantienen como texto hasta el guardado. */
interface SetRow {
  /** Clave estable para `key` de React, no persistida (ver {@link makeKey}). */
  _key: string;
  weight: string;
  reps: string;
  distance: string;
  time_seconds: string;
}

/** Props de {@link PredefinedSetsModal}. */
interface Props {
  /** Entrada de rutina (día × ejercicio) cuyas series predefinidas se editan. */
  rde: RoutineDayExercise;
  /** Ejercicio asociado; determina si se muestran campos de peso/reps o de distancia/tiempo. */
  exercise?: Exercise;
  /** Series predefinidas ya guardadas, usadas para precargar las filas del formulario. */
  initialSets: PredefinedSet[];
  /** Persiste el conjunto completo de series (sustituye, no fusiona, las anteriores). */
  onSave: (
    rdeId: string,
    sets: Array<{ weight?: number; reps?: number; distance?: number; time_seconds?: number; order_index: number }>
  ) => Promise<void>;
  onClose: () => void;
}

/** Genera una clave local única y estable para una fila nueva del formulario (no tiene relación con el id persistido). */
function makeKey(i: number) {
  return `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Renderiza el modal (`role="dialog"`) con la tabla editable de series
 * predefinidas. Atrapa el foco, se cierra con Escape o clic en el overlay,
 * y al guardar convierte los campos de texto a número (cadena vacía → `undefined`,
 * es decir "sin valor fijo / copiar del historial").
 */
export default function PredefinedSetsModal({ rde, exercise, initialSets, onSave, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, true);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    return () => { prev?.focus(); };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isDistanceTime =
    exercise?.type === "DISTANCE_TIME" ||
    exercise?.type === "DISTANCE_ONLY" ||
    exercise?.type === "REPS_DISTANCE" ||
    exercise?.type === "WEIGHT_DISTANCE";

  const [rows, setRows] = useState<SetRow[]>(() =>
    initialSets.length > 0
      ? initialSets.map((s, i) => ({
          _key: makeKey(i),
          weight: s.weight != null ? String(s.weight) : "",
          reps: s.reps != null ? String(s.reps) : "",
          distance: s.distance != null ? String(s.distance) : "",
          time_seconds: s.time_seconds != null ? String(s.time_seconds) : "",
        }))
      : [{ _key: makeKey(0), weight: "", reps: "", distance: "", time_seconds: "" }]
  );

  const [saving, setSaving] = useState(false);

  /** Añade una fila de serie vacía al final del formulario. */
  function addRow() {
    setRows((r) => [...r, { _key: makeKey(r.length), weight: "", reps: "", distance: "", time_seconds: "" }]);
  }

  /** Elimina la fila identificada por `key`. */
  function removeRow(key: string) {
    setRows((r) => r.filter((row) => row._key !== key));
  }

  /** Actualiza un único campo de una fila, preservando el resto. */
  function updateRow(key: string, field: keyof Omit<SetRow, "_key">, value: string) {
    setRows((r) => r.map((row) => (row._key === key ? { ...row, [field]: value } : row)));
  }

  /**
   * Convierte las filas de texto a números (cadena vacía → `undefined`) y
   * persiste el conjunto completo vía `onSave`; cierra el modal al terminar.
   */
  async function handleSave() {
    setSaving(true);
    const sets = rows.map((row, i) => ({
      order_index: i,
      weight: row.weight !== "" ? parseFloat(row.weight) : undefined,
      reps: row.reps !== "" ? parseInt(row.reps, 10) : undefined,
      distance: row.distance !== "" ? parseFloat(row.distance) : undefined,
      time_seconds: row.time_seconds !== "" ? parseInt(row.time_seconds, 10) : undefined,
    }));
    await onSave(rde.id, sets);
    setSaving(false);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="predefined-sets-title"
        className="bg-background rounded-2xl border shadow-lg w-full max-w-sm mx-4 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="predefined-sets-title" className="font-semibold text-base mb-0.5">Series predefinidas</h2>
        <p className="text-xs text-muted-foreground mb-4">
          {exercise?.name ?? "Ejercicio"} · Vacío = copiar del historial anterior
        </p>

        {/* Column headers */}
        <div
          className={`grid gap-2 text-xs text-muted-foreground px-1 mb-1 ${isDistanceTime ? "grid-cols-[1.5rem_1fr_1fr_1.5rem]" : "grid-cols-[1.5rem_1fr_1fr_1.5rem]"}`}
        >
          <span>#</span>
          <span>{isDistanceTime ? "Distancia (m)" : `Peso (${exercise?.weight_unit ?? "kg"})`}</span>
          <span>{isDistanceTime ? "Tiempo (s)" : "Reps"}</span>
          <span />
        </div>

        <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
          {rows.map((row, i) => (
            <div
              key={row._key}
              className="grid grid-cols-[1.5rem_1fr_1fr_1.5rem] gap-2 items-center"
            >
              <span className="text-xs text-muted-foreground">{i + 1}</span>
              {isDistanceTime ? (
                <>
                  <input
                    type="number"
                    min="0"
                    placeholder="—"
                    aria-label={`Serie ${i + 1} — distancia (m)`}
                    value={row.distance}
                    onChange={(e) => updateRow(row._key, "distance", e.target.value)}
                    className="rounded border px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="—"
                    aria-label={`Serie ${i + 1} — tiempo (s)`}
                    value={row.time_seconds}
                    onChange={(e) => updateRow(row._key, "time_seconds", e.target.value)}
                    className="rounded border px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </>
              ) : (
                <>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="—"
                    aria-label={`Serie ${i + 1} — peso (${exercise?.weight_unit ?? "kg"})`}
                    value={row.weight}
                    onChange={(e) => updateRow(row._key, "weight", e.target.value)}
                    className="rounded border px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="—"
                    aria-label={`Serie ${i + 1} — reps`}
                    value={row.reps}
                    onChange={(e) => updateRow(row._key, "reps", e.target.value)}
                    className="rounded border px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </>
              )}
              <button
                onClick={() => removeRow(row._key)}
                aria-label="Eliminar serie"
                className="text-destructive hover:text-destructive/70 text-xs"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={addRow}
          className="w-full rounded border border-dashed py-1.5 text-xs text-muted-foreground hover:bg-secondary/50 mb-4"
        >
          + Añadir serie
        </button>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="rounded border px-4 py-2 text-sm hover:bg-secondary"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
