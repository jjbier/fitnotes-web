/**
 * Formulario de creación/edición de categorías de ejercicios.
 *
 * Recoge un nombre y un color (elegido de una paleta de presets o introducido
 * como hex a mano) y delega el guardado real en `onSubmit`. Se usa tanto en
 * modo "crear" como "editar" según se le pase o no `initial`.
 */
"use client";

import { useState } from "react";
import type { Category } from "@fitnotes/core";

/** Paleta de colores sugeridos para las categorías, mostrados como swatches. */
const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#64748b",
];

/** Props de {@link CategoryForm}. */
interface Props {
  /** Categoría existente a editar; si se omite, el formulario actúa en modo creación. */
  initial?: Partial<Category>;
  /** Callback de guardado; puede lanzar (se captura y se muestra como error en el formulario). */
  onSubmit: (data: { name: string; color: string }) => Promise<void>;
  /** Callback al cancelar la edición/creación. */
  onCancel: () => void;
}

/**
 * Renderiza el formulario de nombre + selector de color para una categoría.
 * Valida que el nombre no esté vacío antes de invocar `onSubmit` y muestra
 * un estado de carga/error local mientras la promesa está en curso.
 */
export default function CategoryForm({ initial, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? PRESET_COLORS[0]!);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("El nombre es obligatorio"); return; }
    setLoading(true);
    try {
      await onSubmit({ name: name.trim(), color });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo ha salido mal");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="cat-name">Nombre</label>
        <input
          id="cat-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="p.ej. Pecho"
          className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Color</label>
        <div className="flex gap-2 flex-wrap">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
              style={{
                backgroundColor: c,
                borderColor: color === c ? "#0f172a" : "transparent",
              }}
              aria-label={`Color ${c}`}
              aria-pressed={color === c}
            />
          ))}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="w-6 h-6 rounded-full border" style={{ backgroundColor: color }} />
          <input
            value={color}
            onChange={(e) => setColor(e.target.value)}
            placeholder="#6366f1"
            aria-label="Color personalizado (hex)"
            className="w-28 rounded-xl border px-2 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2 pt-2">
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
