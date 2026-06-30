"use client";

import { useState } from "react";
import type { PredefinedSet, RoutineDayExercise, Exercise } from "@fitnotes/core";

interface SetRow {
  _key: string;
  weight: string;
  reps: string;
  distance: string;
  time_seconds: string;
}

interface Props {
  rde: RoutineDayExercise;
  exercise?: Exercise;
  initialSets: PredefinedSet[];
  onSave: (
    rdeId: string,
    sets: Array<{ weight?: number; reps?: number; distance?: number; time_seconds?: number; order_index: number }>
  ) => Promise<void>;
  onClose: () => void;
}

function makeKey(i: number) {
  return `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`;
}

export default function PredefinedSetsModal({ rde, exercise, initialSets, onSave, onClose }: Props) {
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

  function addRow() {
    setRows((r) => [...r, { _key: makeKey(r.length), weight: "", reps: "", distance: "", time_seconds: "" }]);
  }

  function removeRow(key: string) {
    setRows((r) => r.filter((row) => row._key !== key));
  }

  function updateRow(key: string, field: keyof Omit<SetRow, "_key">, value: string) {
    setRows((r) => r.map((row) => (row._key === key ? { ...row, [field]: value } : row)));
  }

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
        className="bg-background rounded-lg border shadow-lg w-full max-w-sm mx-4 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-semibold text-base mb-0.5">Series predefinidas</h2>
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
                    value={row.distance}
                    onChange={(e) => updateRow(row._key, "distance", e.target.value)}
                    className="rounded border px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="—"
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
                    value={row.weight}
                    onChange={(e) => updateRow(row._key, "weight", e.target.value)}
                    className="rounded border px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="—"
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
