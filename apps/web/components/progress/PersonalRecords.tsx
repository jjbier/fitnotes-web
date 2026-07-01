"use client";

import { useState } from "react";
import type { PersonalRecord, Exercise } from "@fitnotes/core";
import { calculate1RM, estimateRepMax } from "@fitnotes/core";

interface PersonalRecordsProps {
  records: PersonalRecord[];
  exercises: Exercise[];
  selectedExercise?: Exercise;
  estimatedRepLimit?: number;
}

export default function PersonalRecords({ records, exercises, selectedExercise, estimatedRepLimit }: PersonalRecordsProps) {
  const [subTab, setSubTab] = useState<"real" | "estimado">("real");

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

  if (selectedExercise) {
    const exPRs = records
      .filter((r) => r.exercise_id === selectedExercise.id)
      .sort((a, b) => a.reps - b.reps);

    if (exPRs.length === 0) {
      return (
        <p className="text-sm text-muted-foreground text-center py-8">
          Sin récords para este ejercicio aún.
        </p>
      );
    }

    const estimationSource = estimatedRepLimit
      ? exPRs.filter((pr) => pr.reps <= estimatedRepLimit)
      : exPRs;
    const best1RM = estimationSource.length > 0
      ? Math.max(...estimationSource.map((pr) => calculate1RM(pr.weight, pr.reps)))
      : Math.max(...exPRs.map((pr) => calculate1RM(pr.weight, pr.reps)));

    return (
      <div className="space-y-3">
        <div className="flex rounded-lg border bg-secondary/20 p-0.5 w-fit">
          {(["real", "estimado"] as const).map((sub) => (
            <button
              key={sub}
              onClick={() => setSubTab(sub)}
              className={`rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${
                subTab === sub
                  ? "bg-white shadow-sm dark:bg-secondary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {sub === "real" ? "Real" : "Estimado"}
            </button>
          ))}
        </div>

        {subTab === "real" ? (
          <div className="space-y-2">
            {exPRs.map((pr) => (
              <div key={pr.id} className="flex items-center justify-between rounded-md border px-4 py-3 text-sm">
                <div>
                  <span className="font-medium">{pr.reps} rep{pr.reps !== 1 ? "s" : ""}</span>
                  <span className="ml-2 font-semibold text-muted-foreground">{pr.weight} kg</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>
                    {new Date(pr.achieved_at).toLocaleDateString("es-ES", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </span>
                  <span>
                    1RM est.{" "}
                    <span className="font-semibold text-primary">
                      {calculate1RM(pr.weight, pr.reps).toFixed(1)} kg
                    </span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground mb-2">
              Basado en 1RM estimado de{" "}
              <span className="font-semibold text-foreground">{best1RM.toFixed(1)} kg</span>
              {estimatedRepLimit && (
                <> · excluye series de más de {estimatedRepLimit} reps</>
              )}
            </p>
            {Array.from({ length: 15 }, (_, i) => i + 1).map((reps) => {
              const est = estimateRepMax(best1RM, reps);
              const actualPR = exPRs.find((pr) => pr.reps === reps);
              return (
                <div
                  key={reps}
                  className={`flex items-center justify-between rounded-md border px-4 py-2.5 text-sm ${
                    actualPR ? "border-primary/30 bg-primary/5" : ""
                  }`}
                >
                  <span className="font-medium flex items-center gap-2">
                    {reps} rep{reps !== 1 ? "s" : ""}
                    {actualPR && (
                      <span className="text-[10px] font-semibold text-primary uppercase tracking-wide">
                        PR
                      </span>
                    )}
                  </span>
                  <div className="text-right">
                    <span className="font-semibold">{est.toFixed(1)} kg</span>
                    {actualPR && (
                      <span className="ml-2 text-xs text-green-600">real {actualPR.weight} kg</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // All-exercises grouped table
  const grouped = records.reduce<Record<string, PersonalRecord[]>>((acc, r) => {
    acc[r.exercise_id] ??= [];
    acc[r.exercise_id]!.push(r);
    return acc;
  }, {});

  return (
    <div className="rounded-md border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-secondary/50">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Ejercicio</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Reps</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Peso</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">1RM est.</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Fecha</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {Object.entries(grouped).map(([exId, prs]) => {
            const exercise = exercises.find((e) => e.id === exId);
            const best = prs.reduce(
              (top, r) => calculate1RM(r.weight, r.reps) > calculate1RM(top.weight, top.reps) ? r : top,
              prs[0]!
            );
            return (
              <tr key={exId} className="hover:bg-secondary/30">
                <td className="px-4 py-3 font-medium">{exercise?.name ?? "Desconocido"}</td>
                <td className="px-4 py-3 text-right">{best.reps}</td>
                <td className="px-4 py-3 text-right">
                  {best.weight} {exercise?.weight_unit ?? "kg"}
                </td>
                <td className="px-4 py-3 text-right text-primary font-medium">
                  {calculate1RM(best.weight, best.reps).toFixed(1)} {exercise?.weight_unit ?? "kg"}
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground text-xs">
                  {new Date(best.achieved_at).toLocaleDateString("es-ES", {
                    day: "numeric", month: "short", year: "numeric",
                  })}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
