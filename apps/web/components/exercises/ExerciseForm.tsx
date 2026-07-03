"use client";

import { useState } from "react";
import { ExerciseType } from "@fitnotes/core";
import { useConfirm } from "@/components/ConfirmDialog";
import type { Category, Exercise } from "@fitnotes/core";

const TYPE_LABELS: Record<ExerciseType, string> = {
  [ExerciseType.WEIGHT_REPS]: "Peso × Repeticiones",
  [ExerciseType.DISTANCE_TIME]: "Distancia / Tiempo",
  [ExerciseType.REPS_ONLY]: "Solo repeticiones",
  [ExerciseType.WEIGHT_ONLY]: "Solo peso",
  [ExerciseType.TIME_ONLY]: "Solo tiempo",
  [ExerciseType.WEIGHT_DISTANCE]: "Peso + Distancia",
  [ExerciseType.WEIGHT_TIME]: "Peso + Tiempo",
  [ExerciseType.REPS_DISTANCE]: "Reps + Distancia",
  [ExerciseType.REPS_TIME]: "Reps + Tiempo",
  [ExerciseType.DISTANCE_ONLY]: "Solo distancia",
};

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#64748b",
];

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
  onCreateCategory?: (data: { name: string; color: string }) => Promise<Category>;
  onConvertWeights?: (factor: number) => Promise<void>;
}

export default function ExerciseForm({ categories, initial, onSubmit, onCancel, onCreateCategory, onConvertWeights }: Props) {
  const confirm = useConfirm();
  const [form, setForm] = useState<FormData>({
    name: initial?.name ?? "",
    category_id: initial?.category_id ?? (categories[0]?.id ?? ""),
    type: initial?.type ?? ExerciseType.WEIGHT_REPS,
    weight_unit: initial?.weight_unit ?? "kg",
    notes: initial?.notes ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Inline category creation
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState(PRESET_COLORS[0]!);
  const [catLoading, setCatLoading] = useState(false);
  const [localCategories, setLocalCategories] = useState<Category[]>(categories);

  function patch<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newCatName.trim() || !onCreateCategory) return;
    setCatLoading(true);
    try {
      const created = await onCreateCategory({ name: newCatName.trim(), color: newCatColor });
      setLocalCategories((prev) => [...prev, created]);
      patch("category_id", created.id);
      setShowNewCat(false);
      setNewCatName("");
      setNewCatColor(PRESET_COLORS[0]!);
    } finally {
      setCatLoading(false);
    }
  }

  async function performSave() {
    if (!form.name.trim()) { setError("El nombre es obligatorio"); return; }
    if (!form.category_id) { setError("Selecciona o crea una categoría"); return; }

    // Warn if type changed when editing
    if (initial?.id && form.type !== initial.type) {
      const ok = await confirm({
        title: "Cambiar tipo de ejercicio",
        message: "Cambiar el tipo eliminará los campos que no existen en el nuevo tipo del historial de este ejercicio. ¿Continuar?",
        confirmLabel: "Continuar",
      });
      if (!ok) return;
    }

    // Warn if weight unit changed when editing — offer convert vs. substitute
    const isWeightType = [ExerciseType.WEIGHT_REPS, ExerciseType.WEIGHT_ONLY, ExerciseType.WEIGHT_DISTANCE, ExerciseType.WEIGHT_TIME].includes(form.type);
    const unitChanged = initial?.id && isWeightType && initial.weight_unit && form.weight_unit !== initial.weight_unit;
    let shouldConvert = false;
    if (unitChanged) {
      const ok = await confirm({
        title: "Cambiar unidad de peso",
        message: `¿Cambiar la unidad de peso a ${form.weight_unit}?`,
        confirmLabel: "Cambiar",
        destructive: false,
      });
      if (!ok) return;
      shouldConvert = await confirm({
        title: "Convertir historial",
        message:
          `¿Convertir los valores históricos automáticamente?\n\n` +
          `Ejemplo: 100 ${initial.weight_unit} → ${Math.round(100 * (initial.weight_unit === "kg" ? 2.20462 : 0.453592) * 10) / 10} ${form.weight_unit}\n\n` +
          `Acepta para convertir. Cancela para solo cambiar la etiqueta.`,
        confirmLabel: "Convertir",
        cancelLabel: "Solo cambiar etiqueta",
        destructive: false,
      });
    }

    setLoading(true);
    setError("");
    try {
      await onSubmit({ ...form, name: form.name.trim() });
      if (shouldConvert && onConvertWeights && initial?.weight_unit) {
        const factor = initial.weight_unit === "kg" ? 2.20462 : 0.453592;
        await onConvertWeights(factor);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    performSave();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="ex-name">Nombre</label>
        <input
          id="ex-name"
          value={form.name}
          onChange={(e) => patch("name", e.target.value)}
          placeholder="p.ej. Press de banca"
          className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          autoFocus
        />
      </div>

      {/* Category */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="ex-category">Categoría</label>
        <div className="flex gap-2">
          <select
            id="ex-category"
            value={form.category_id}
            onChange={(e) => patch("category_id", e.target.value)}
            className="flex-1 rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
          >
            {localCategories.length === 0 && (
              <option value="" disabled>— sin categorías todavía —</option>
            )}
            {localCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
          {onCreateCategory && (
            <button
              type="button"
              onClick={() => setShowNewCat((v) => !v)}
              className="rounded-xl border px-3 py-2 text-sm font-medium hover:bg-secondary"
              title="Crear nueva categoría"
            >
              {showNewCat ? "✕" : "+ Nueva"}
            </button>
          )}
        </div>

        {/* Inline new-category form */}
        {showNewCat && onCreateCategory && (
          <div className="rounded-xl border bg-secondary/20 p-3 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nueva categoría</p>
            <label htmlFor="new-cat-name" className="sr-only">Nombre de la nueva categoría</label>
            <input
              id="new-cat-name"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="Nombre de categoría"
              className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
            <div className="flex gap-1.5 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewCatColor(c)}
                  className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                  style={{ backgroundColor: c, borderColor: newCatColor === c ? "#0f172a" : "transparent" }}
                  aria-label={`Color ${c}`}
                  aria-pressed={newCatColor === c}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={handleCreateCategory}
              disabled={catLoading || !newCatName.trim()}
              className="w-full rounded-xl bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {catLoading ? "Creando…" : "Crear categoría"}
            </button>
          </div>
        )}
      </div>

      {/* Type */}
      <div className="space-y-1.5">
        <p id="ex-type-label" className="text-sm font-medium">Tipo</p>
        <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="ex-type-label">
          {(Object.values(ExerciseType) as ExerciseType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => patch("type", t)}
              className={`rounded-xl border px-3 py-2 text-xs font-medium text-left transition-colors ${
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

      {/* Weight unit */}
      {[ExerciseType.WEIGHT_REPS, ExerciseType.WEIGHT_ONLY, ExerciseType.WEIGHT_DISTANCE, ExerciseType.WEIGHT_TIME].includes(form.type) && (
        <div className="space-y-1.5">
          <p id="ex-unit-label" className="text-sm font-medium">Unidad de peso</p>
          <div className="flex gap-2" role="group" aria-labelledby="ex-unit-label">
            {(["kg", "lb"] as const).map((unit) => (
              <button
                key={unit}
                type="button"
                onClick={() => patch("weight_unit", unit)}
                className={`flex-1 rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
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
        <label className="text-sm font-medium" htmlFor="ex-notes">
          Notas <span className="text-muted-foreground font-normal">(opcional)</span>
        </label>
        <textarea
          id="ex-notes"
          value={form.notes}
          onChange={(e) => patch("notes", e.target.value)}
          placeholder="Indicaciones, tiempo de descanso, configuración de discos…"
          rows={2}
          className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2 pt-2 flex-wrap">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl border px-4 py-2 text-sm font-medium hover:bg-secondary"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? "Guardando…" : initial?.id ? "Actualizar" : "Crear"}
        </button>
      </div>
    </form>
  );
}
