/**
 * Formulario de creación/edición de ejercicios: nombre, categoría (con
 * creación inline de categoría nueva), tipo de ejercicio y unidad de peso
 * cuando aplica, más notas y URL de imagen/vídeo de demostración opcionales.
 *
 * Al editar, si el usuario cambia el tipo o la unidad de peso, se apoya en
 * `useConfirm()` para advertir del impacto sobre el historial ya registrado
 * (pérdida de campos al cambiar de tipo; oferta de conversión numérica al
 * cambiar de unidad) antes de guardar.
 */
"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ExerciseType } from "@fitnotes/core";
import { useConfirm } from "@/components/ConfirmDialog";
import type { Category, Exercise } from "@fitnotes/core";

/** Paleta de colores sugeridos para la creación inline de categoría. */
const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#64748b",
];

/** Datos del formulario que se envían a `onSubmit`. */
interface FormData {
  name: string;
  category_id: string;
  type: ExerciseType;
  weight_unit: "kg" | "lb";
  notes: string;
  demo_url: string;
}

/** Props de {@link ExerciseForm}. */
interface Props {
  /** Categorías disponibles para el selector (puede crecer localmente si se crea una nueva). */
  categories: Category[];
  /** Ejercicio existente a editar; si se omite, el formulario actúa en modo creación. */
  initial?: Partial<Exercise>;
  onSubmit: (data: FormData) => Promise<void>;
  onCancel: () => void;
  /** Si se provee, habilita el flujo de "+ Nueva categoría" inline dentro del propio formulario. */
  onCreateCategory?: (data: { name: string; color: string }) => Promise<Category>;
  /**
   * Convierte retroactivamente los pesos del historial de este ejercicio al
   * cambiar de unidad. Solo se invoca si el usuario confirma la conversión
   * (ver `performSave`); `factor` es el multiplicador kg↔lb aplicado.
   */
  onConvertWeights?: (factor: number) => Promise<void>;
}

/**
 * Renderiza el formulario de ejercicio. Gestiona tanto el estado del propio
 * ejercicio como el sub-formulario de creación de categoría inline, y
 * antepone confirmaciones destructivas (`useConfirm`) antes de aplicar
 * cambios de tipo o unidad de peso que afecten al historial.
 */
export default function ExerciseForm({ categories, initial, onSubmit, onCancel, onCreateCategory, onConvertWeights }: Props) {
  const { t } = useTranslation();
  const confirm = useConfirm();

  /** Etiquetas para cada {@link ExerciseType}, usadas en el selector de tipo. */
  const TYPE_LABELS: Record<ExerciseType, string> = {
    [ExerciseType.WEIGHT_REPS]: t("exercises:types.WEIGHT_REPS"),
    [ExerciseType.DISTANCE_TIME]: t("exercises:types.DISTANCE_TIME"),
    [ExerciseType.REPS_ONLY]: t("exercises:types.REPS_ONLY"),
    [ExerciseType.WEIGHT_ONLY]: t("exercises:types.WEIGHT_ONLY"),
    [ExerciseType.TIME_ONLY]: t("exercises:types.TIME_ONLY"),
    [ExerciseType.WEIGHT_DISTANCE]: t("exercises:types.WEIGHT_DISTANCE"),
    [ExerciseType.WEIGHT_TIME]: t("exercises:types.WEIGHT_TIME"),
    [ExerciseType.REPS_DISTANCE]: t("exercises:types.REPS_DISTANCE"),
    [ExerciseType.REPS_TIME]: t("exercises:types.REPS_TIME"),
    [ExerciseType.DISTANCE_ONLY]: t("exercises:types.DISTANCE_ONLY"),
  };

  const [form, setForm] = useState<FormData>({
    name: initial?.name ?? "",
    category_id: initial?.category_id ?? (categories[0]?.id ?? ""),
    type: initial?.type ?? ExerciseType.WEIGHT_REPS,
    weight_unit: initial?.weight_unit ?? "kg",
    notes: initial?.notes ?? "",
    demo_url: initial?.demo_url ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Inline category creation
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState(PRESET_COLORS[0]!);
  const [catLoading, setCatLoading] = useState(false);
  const [localCategories, setLocalCategories] = useState<Category[]>(categories);

  /** Actualiza un único campo del formulario preservando el resto. */
  function patch<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  /** Crea la categoría inline vía `onCreateCategory`, la añade a la lista local y la selecciona. */
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

  /**
   * Valida y guarda el ejercicio. Si se está editando y el tipo o la unidad
   * de peso cambian respecto al valor original, pide confirmación explícita
   * antes de continuar (el cambio de tipo puede eliminar campos del
   * historial; el cambio de unidad ofrece convertir los valores numéricos
   * o solo la etiqueta). La conversión (`onConvertWeights`) se ejecuta
   * después de que `onSubmit` haya guardado el ejercicio.
   */
  async function performSave() {
    if (!form.name.trim()) { setError(t("exercises:nameRequired")); return; }
    if (!form.category_id) { setError(t("exercises:categoryRequired")); return; }
    if (form.demo_url.trim()) {
      try {
        new URL(form.demo_url.trim());
      } catch {
        setError(t("exercises:demoUrlInvalid"));
        return;
      }
    }

    // Warn if type changed when editing
    if (initial?.id && form.type !== initial.type) {
      const ok = await confirm({
        title: t("exercises:changeTypeTitleWeb"),
        message: t("exercises:changeTypeMessageWeb"),
        confirmLabel: t("exercises:changeTypeConfirmWeb"),
      });
      if (!ok) return;
    }

    // Warn if weight unit changed when editing — offer convert vs. substitute
    const isWeightType = [ExerciseType.WEIGHT_REPS, ExerciseType.WEIGHT_ONLY, ExerciseType.WEIGHT_DISTANCE, ExerciseType.WEIGHT_TIME].includes(form.type);
    const unitChanged = initial?.id && isWeightType && initial.weight_unit && form.weight_unit !== initial.weight_unit;
    let shouldConvert = false;
    if (unitChanged) {
      const ok = await confirm({
        title: t("exercises:changeWeightUnitTitleWeb"),
        message: t("exercises:changeWeightUnitMessageWeb", { unit: form.weight_unit }),
        confirmLabel: t("exercises:changeWeightUnitConfirmWeb"),
        destructive: false,
      });
      if (!ok) return;
      shouldConvert = await confirm({
        title: t("exercises:convertHistoryTitleWeb"),
        message: t("exercises:convertHistoryMessageWeb", {
          fromUnit: initial.weight_unit,
          toValue: Math.round(100 * (initial.weight_unit === "kg" ? 2.20462 : 0.453592) * 10) / 10,
          toUnit: form.weight_unit,
        }),
        confirmLabel: t("exercises:convertHistoryConfirmWeb"),
        cancelLabel: t("exercises:convertHistoryCancelWeb"),
        destructive: false,
      });
    }

    setLoading(true);
    setError("");
    try {
      await onSubmit({ ...form, name: form.name.trim(), demo_url: form.demo_url.trim() });
      if (shouldConvert && onConvertWeights && initial?.weight_unit) {
        const factor = initial.weight_unit === "kg" ? 2.20462 : 0.453592;
        await onConvertWeights(factor);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("exercises:genericErrorWeb"));
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
        <label className="text-sm font-medium" htmlFor="ex-name">{t("exercises:nameLabel")}</label>
        <input
          id="ex-name"
          value={form.name}
          onChange={(e) => patch("name", e.target.value)}
          placeholder={t("exercises:namePlaceholderExercise")}
          className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          autoFocus
        />
      </div>

      {/* Category */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="ex-category">{t("exercises:categoryLabel")}</label>
        <div className="flex gap-2">
          <select
            id="ex-category"
            value={form.category_id}
            onChange={(e) => patch("category_id", e.target.value)}
            className="flex-1 rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
          >
            {localCategories.length === 0 && (
              <option value="" disabled>{t("exercises:noCategoriesYetOption")}</option>
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
              title={t("exercises:createNewCategoryTitle")}
            >
              {showNewCat ? t("exercises:closeNewCategoryToggle") : t("exercises:newCategoryToggleShort")}
            </button>
          )}
        </div>

        {/* Inline new-category form */}
        {showNewCat && onCreateCategory && (
          <div className="rounded-xl border bg-secondary/20 p-3 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("exercises:newCategoryHeading")}</p>
            <label htmlFor="new-cat-name" className="sr-only">{t("exercises:newCategoryNameSrLabel")}</label>
            <input
              id="new-cat-name"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder={t("exercises:newCategoryNamePlaceholder")}
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
                  aria-label={t("exercises:colorSwatchLabel", { color: c })}
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
              {catLoading ? t("exercises:creatingButton") : t("exercises:createCategoryButton")}
            </button>
          </div>
        )}
      </div>

      {/* Type */}
      <div className="space-y-1.5">
        <p id="ex-type-label" className="text-sm font-medium">{t("exercises:typeLabel")}</p>
        <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="ex-type-label">
          {(Object.values(ExerciseType) as ExerciseType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => patch("type", type)}
              className={`rounded-xl border px-3 py-2 text-xs font-medium text-left transition-colors ${
                form.type === type
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-secondary"
              }`}
            >
              {TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      {/* Weight unit */}
      {[ExerciseType.WEIGHT_REPS, ExerciseType.WEIGHT_ONLY, ExerciseType.WEIGHT_DISTANCE, ExerciseType.WEIGHT_TIME].includes(form.type) && (
        <div className="space-y-1.5">
          <p id="ex-unit-label" className="text-sm font-medium">{t("exercises:weightUnitFieldLabel")}</p>
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
          {t("exercises:notesLabel")} <span className="text-muted-foreground font-normal">{t("exercises:notesOptionalSuffix")}</span>
        </label>
        <textarea
          id="ex-notes"
          value={form.notes}
          onChange={(e) => patch("notes", e.target.value)}
          placeholder={t("exercises:notesPlaceholderWeb")}
          rows={2}
          className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </div>

      {/* Demo URL */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="ex-demo-url">
          {t("exercises:demoUrlLabel")} <span className="text-muted-foreground font-normal">{t("exercises:demoUrlOptionalSuffix")}</span>
        </label>
        <input
          id="ex-demo-url"
          type="url"
          value={form.demo_url}
          onChange={(e) => patch("demo_url", e.target.value)}
          placeholder={t("exercises:demoUrlPlaceholder")}
          className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2 pt-2 flex-wrap">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl border px-4 py-2 text-sm font-medium hover:bg-secondary"
        >
          {t("common:cancel")}
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? t("exercises:savingButton") : initial?.id ? t("exercises:updateButton") : t("exercises:createButton")}
        </button>
      </div>
    </form>
  );
}
