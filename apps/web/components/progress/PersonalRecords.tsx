/**
 * PersonalRecords — Displays PR table grouped by exercise
 *
 * TODO:
 *  - Group PRs by exercise name (join via useExerciseStore)
 *  - Show best set per rep range (1, 3, 5, 8, 10, 12+)
 *  - Show estimated 1RM using calculate1RM from @fitnotes/core
 *  - Link each row to the exercise detail page
 *  - Highlight newly set PRs (achieved_at within last 7 days)
 */

import type { PersonalRecord, Exercise } from "@fitnotes/core";
import { calculate1RM } from "@fitnotes/core";

interface PersonalRecordsProps {
  records: PersonalRecord[];
  exercises: Exercise[];
}

export default function PersonalRecords({ records, exercises }: PersonalRecordsProps) {
  if (records.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">Sin récords personales aún.</p>
        <p className="text-xs text-muted-foreground mt-1">
          Completa series para registrar tus récords automáticamente.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-secondary/50">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Ejercicio</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Repeticiones</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Peso</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">1RM est.</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Fecha</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {records.map((pr) => {
            const exercise = exercises.find((e) => e.id === pr.exercise_id);
            const estimated1rm = calculate1RM(pr.weight, pr.reps);
            return (
              <tr key={pr.id} className="hover:bg-secondary/30">
                <td className="px-4 py-3 font-medium">
                  {exercise?.name ?? "Desconocido"}
                </td>
                <td className="px-4 py-3 text-right">{pr.reps}</td>
                <td className="px-4 py-3 text-right">
                  {pr.weight} {exercise?.weight_unit ?? "kg"}
                </td>
                <td className="px-4 py-3 text-right text-primary font-medium">
                  {estimated1rm.toFixed(1)} {exercise?.weight_unit ?? "kg"}
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground text-xs">
                  {new Date(pr.achieved_at).toLocaleDateString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
