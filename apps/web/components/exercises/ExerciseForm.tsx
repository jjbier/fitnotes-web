"use client";

import { useState } from "react";
import { ExerciseType } from "@fitnotes/core";
import type { Category, Exercise } from "@fitnotes/core";

const TYPE_LABELS: Record<ExerciseType, string> = {
  [ExerciseType.WEIGHT_REPS]: "Weight × Reps",
  [ExerciseType.DISTANCE_TIME]: "Distance / Time",
  [ExerciseType.REPS_ONLY]: "Reps only",
  [ExerciseType.WEIGHT_ONLY]: "Weight only",
  [ExerciseType.TIME_ONLY]: "Time only",
};

interface FormData {
  name: string;
  category_id: string;
  type: ExerciseType;
  weight_unit: "kg" | "lb";
  notes: string;
}

interface Props {
  categories: Category[];
  initial?: Partial<Exercise>;
  onSubmit: (data: FormData) => Promise<void>;
  onCancel: () => void;
}

export default function ExerciseForm({ categories, initial, onSubmit, onCancel }: Props) {
  const [form, setForm] = useState<FormData>({
    name: initial?.name ?? "",
    category_id: initial?.category_id ?? (categories[0]?.id ?? ""),
    type: initial?.type ?? ExerciseType.WEIGHT_REPS,
    weight_unit: initial?.weight_unit ?? "kg",
    notes: initial?.notes ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function patch<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Name is required"); return; }
    setLoading(true);
    try {
      await onSubmit({ ...form, name: form.name.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="ex-name">Name</label>
        <input
          id="ex-name"
          value={form.name}
          onChange={(e) => patch("name", e.target.value)}
          placeholder="e.g. Bench Press"
          className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          autoFocus
        />
      </div>

      {/* Category */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="ex-category">Category</label>
        <select
          id="ex-category"
          value={form.category_id}
          onChange={(e) => patch("category_id", e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
        >
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>

      {/* Type */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Type</label>
        <div className="grid grid-cols-2 gap-2">
          {(Object.values(ExerciseType) as ExerciseType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => patch("type", t)}
              className={`rounded-md border px-3 py-2 text-xs font-medium text-left transition-colors ${
                form.type === t
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-secondary"
              }`}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Weight unit — only relevant for weight-based types */}
      {(form.type === ExerciseType.WEIGHT_REPS || form.type === ExerciseType.WEIGHT_ONLY) && (
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Weight unit</label>
          <div className="flex gap-2">
            {(["kg", "lb"] as const).map((unit) => (
              <button
                key={unit}
                type="button"
                onClick={() => patch("weight_unit", unit)}
                className={`flex-1 rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                  form.weight_unit === unit
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:bg-secondary"
                }`}
              >
                {unit}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="ex-notes">Notes <span className="text-muted-foreground font-normal">(optional)</span></label>
        <textarea
          id="ex-notes"
          value={form.notes}
          onChange={(e) => patch("notes", e.target.value)}
          placeholder="Cues, rest time, default plate setup…"
          rows={2}
          className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-md border px-4 py-2 text-sm font-medium hover:bg-secondary"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? "Saving…" : initial?.id ? "Update" : "Create"}
        </button>
      </div>
    </form>
  );
}
