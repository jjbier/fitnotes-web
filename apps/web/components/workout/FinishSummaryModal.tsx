/**
 * Modal de resumen mostrado justo al finalizar un entrenamiento: presenta en
 * una cuadrícula de tarjetas la duración, el número de ejercicios, el número
 * de series y el volumen total levantado. Puramente presentacional (no hace
 * llamadas a red ni a stores).
 */

"use client";

import { formatClockDuration } from "@fitnotes/core";

/** Estadísticas ya calculadas del entrenamiento recién finalizado, a mostrar en las tarjetas del resumen. */
interface FinishStats {
  duration: number;
  exercises: number;
  sets: number;
  volume: number;
}

/**
 * Props de `FinishSummaryModal`.
 * @property stats - Estadísticas del entrenamiento finalizado.
 * @property onClose - Cierra el modal (clic en el fondo o en el botón "Cerrar").
 */
interface FinishSummaryModalProps {
  stats: FinishStats;
  onClose: () => void;
}

/**
 * Renderiza las 4 tarjetas de estadísticas (duración, ejercicios, series,
 * volumen) del entrenamiento recién finalizado. El volumen se redondea y se
 * formatea con separadores de miles en español (`es-ES`). El botón "Cerrar"
 * tiene `autoFocus` para permitir cerrar con teclado inmediatamente.
 */
export default function FinishSummaryModal({ stats, onClose }: FinishSummaryModalProps) {
  const tiles = [
    { label: "Duración", value: formatClockDuration(stats.duration) },
    { label: "Ejercicios", value: String(stats.exercises) },
    { label: "Series", value: String(stats.sets) },
    { label: "Volumen", value: `${Math.round(stats.volume).toLocaleString("es-ES")} kg` },
  ];

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="finish-summary-title"
        className="w-full max-w-sm space-y-5 rounded-2xl border bg-card p-6 text-center shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="finish-summary-title" className="text-lg font-semibold">
          ¡Entrenamiento finalizado!
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-xl bg-secondary p-4">
              <p className="text-xl font-bold">{t.value}</p>
              <p className="text-xs text-muted-foreground">{t.label}</p>
            </div>
          ))}
        </div>
        <button
          autoFocus
          onClick={onClose}
          className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
