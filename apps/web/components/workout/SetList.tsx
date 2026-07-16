/**
 * SetList
 *
 * TODO:
 *  - Render each set row with weight, reps, distance, time fields based on exercise type
 *  - Inline edit on click (toggle edit mode per row)
 *  - Swipe-to-delete or delete icon per row
 *  - Checkmark to mark set complete (calls useWorkoutStore.markSetComplete)
 *  - Drag handles for reordering
 */

import type { Set, ExerciseType } from "@fitnotes/core";

/**
 * Props de `SetList`.
 * @property sets - Series a renderizar, en el orden recibido (se numeran por índice de array, no por `order_index`).
 * @property exerciseType - Recibido pero no usado actualmente para filtrar campos (cada fila muestra los campos presentes en el propio `Set`); ver `SetRow`/`getExerciseFields` para el filtrado real por tipo de ejercicio.
 * @property onUpdate - Recibido pero no usado por este componente (no hay edición inline aquí; ver `onUpdate` en `SetRow`).
 * @property onDelete - Se invoca con el id de la serie al pulsar el botón de eliminar de una fila.
 * @property onToggleComplete - Se invoca con el id de la serie y el nuevo estado (`!is_complete`) al pulsar el círculo de completado.
 */
interface SetListProps {
  sets: Set[];
  exerciseType: ExerciseType;
  onUpdate: (setId: string, patch: Partial<Set>) => void;
  onDelete: (setId: string) => void;
  onToggleComplete: (setId: string, complete: boolean) => void;
}

/**
 * Listado de solo lectura de series de un ejercicio: muestra los campos
 * presentes (peso/reps/distancia/tiempo) de cada `Set`, un botón para marcar
 * completada y otro para eliminar. Muestra un mensaje vacío si `sets` está
 * vacío. Nota: es una versión más simple que `SetRow` (sin edición inline de
 * valores ni comentario); comprobar en el punto de uso cuál de los dos
 * componentes es el vigente antes de extenderlo.
 */
export default function SetList({
  sets,
  onDelete,
  onToggleComplete,
}: SetListProps) {
  if (sets.length === 0) {
    return (
      <p className="py-4 text-sm text-center text-muted-foreground">
        Sin series registradas todavía.
      </p>
    );
  }

  return (
    <div className="rounded-xl border divide-y">
      {sets.map((set, idx) => (
        <div key={set.id} className="flex items-center gap-3 px-4 py-3 text-sm">
          <span className="w-6 text-center text-muted-foreground text-xs">
            {idx + 1}
          </span>

          <div className="flex-1 flex gap-4">
            {set.weight !== undefined && (
              <span>
                <span className="font-medium">{set.weight}</span>
                <span className="text-muted-foreground ml-1">kg</span>
              </span>
            )}
            {set.reps !== undefined && (
              <span>
                <span className="font-medium">{set.reps}</span>
                <span className="text-muted-foreground ml-1">reps</span>
              </span>
            )}
            {set.distance !== undefined && (
              <span>
                <span className="font-medium">{set.distance}</span>
                <span className="text-muted-foreground ml-1">km</span>
              </span>
            )}
            {set.time_seconds !== undefined && (
              <span>
                <span className="font-medium">{set.time_seconds}</span>
                <span className="text-muted-foreground ml-1">s</span>
              </span>
            )}
          </div>

          <button
            onClick={() => onToggleComplete(set.id, !set.is_complete)}
            className={`h-6 w-6 rounded-full border-2 flex items-center justify-center text-xs ${
              set.is_complete
                ? "border-green-500 bg-green-500 text-white"
                : "border-muted-foreground"
            }`}
          >
            {set.is_complete ? "✓" : ""}
          </button>

          <button
            onClick={() => onDelete(set.id)}
            className="text-muted-foreground hover:text-destructive text-xs"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
