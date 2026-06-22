"use client";

import { useState } from "react";
import type { Category } from "@fitnotes/core";

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#64748b",
];

interface Props {
  initial?: Partial<Category>;
  onSubmit: (data: { name: string; color: string }) => Promise<void>;
  onCancel: () => void;
}

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
          className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
              aria-label={c}
            />
          ))}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="w-6 h-6 rounded-full border" style={{ backgroundColor: color }} />
          <input
            value={color}
            onChange={(e) => setColor(e.target.value)}
            placeholder="#6366f1"
            className="w-28 rounded-md border px-2 py-1 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-md border px-4 py-2 text-sm font-medium hover:bg-secondary"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? "Guardando…" : initial?.id ? "Actualizar" : "Crear"}
        </button>
      </div>
    </form>
  );
}
