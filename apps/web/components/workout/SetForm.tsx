/**
 * SetForm
 *
 * TODO:
 *  - Render only relevant fields based on exerciseType (ExerciseType enum)
 *  - Validate with setSchema from @fitnotes/core
 *  - Auto-populate fields from previous set (last set values as defaults)
 *  - Keyboard-friendly: Tab between fields, Enter to submit
 */

"use client";

import { useState } from "react";
import type { Set, ExerciseType } from "@fitnotes/core";
import { ExerciseType as ET } from "@fitnotes/core";

interface SetFormProps {
  exerciseType: ExerciseType;
  defaultValues?: Partial<Set>;
  onSubmit: (partial: Partial<Set>) => void;
  onCancel?: () => void;
}

export default function SetForm({
  exerciseType,
  defaultValues = {},
  onSubmit,
  onCancel,
}: SetFormProps) {
  const [weight, setWeight] = useState(defaultValues.weight?.toString() ?? "");
  const [reps, setReps] = useState(defaultValues.reps?.toString() ?? "");
  const [distance, setDistance] = useState(defaultValues.distance?.toString() ?? "");
  const [timeSeconds, setTimeSeconds] = useState(
    defaultValues.time_seconds?.toString() ?? ""
  );

  const showWeight = [ET.WEIGHT_REPS, ET.WEIGHT_ONLY].includes(exerciseType as ET);
  const showReps = [ET.WEIGHT_REPS, ET.REPS_ONLY].includes(exerciseType as ET);
  const showDistance = [ET.DISTANCE_TIME].includes(exerciseType as ET);
  const showTime = [ET.DISTANCE_TIME, ET.TIME_ONLY].includes(exerciseType as ET);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      weight: weight ? parseFloat(weight) : undefined,
      reps: reps ? parseInt(reps, 10) : undefined,
      distance: distance ? parseFloat(distance) : undefined,
      time_seconds: timeSeconds ? parseInt(timeSeconds, 10) : undefined,
    });
    setWeight("");
    setReps("");
    setDistance("");
    setTimeSeconds("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-3 rounded-md border bg-secondary/30 px-4 py-3">
      {showWeight && (
        <div className="flex flex-col gap-1">
          <label htmlFor="sf-weight" className="text-xs text-muted-foreground">Peso (kg)</label>
          <input
            id="sf-weight"
            type="number"
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="0"
            className="w-24 rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )}

      {showReps && (
        <div className="flex flex-col gap-1">
          <label htmlFor="sf-reps" className="text-xs text-muted-foreground">Repeticiones</label>
          <input
            id="sf-reps"
            type="number"
            inputMode="numeric"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            placeholder="0"
            className="w-20 rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )}

      {showDistance && (
        <div className="flex flex-col gap-1">
          <label htmlFor="sf-distance" className="text-xs text-muted-foreground">Distancia (km)</label>
          <input
            id="sf-distance"
            type="number"
            inputMode="decimal"
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
            placeholder="0"
            className="w-28 rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )}

      {showTime && (
        <div className="flex flex-col gap-1">
          <label htmlFor="sf-time" className="text-xs text-muted-foreground">Tiempo (s)</label>
          <input
            id="sf-time"
            type="number"
            inputMode="numeric"
            value={timeSeconds}
            onChange={(e) => setTimeSeconds(e.target.value)}
            placeholder="0"
            className="w-24 rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )}

      <div className="flex gap-2 ml-auto">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-secondary"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Registrar serie
        </button>
      </div>
    </form>
  );
}
