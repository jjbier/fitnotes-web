/**
 * Lista de récords personales (PRs). Tiene dos modos según se le pase
 * `selectedExercise`: vista de un único ejercicio con sub-pestañas "Real"
 * (PRs realmente registrados por nº de reps) y "Estimado" (tabla de 1RM a
 * 15RM extrapolada con Epley/Brzycki vía `estimateRepMax`); o, sin ejercicio
 * seleccionado, una tabla resumen con el mejor PR (por 1RM estimado) de cada
 * ejercicio.
 */
"use client";

import { useState } from "react";
import { Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { PersonalRecord, Exercise } from "@fitnotes/core";
import { calculate1RM, estimateRepMax } from "@fitnotes/core";

/** Props de {@link PersonalRecords}. */
interface PersonalRecordsProps {
  /** Todos los PRs a considerar (de uno o varios ejercicios). */
  records: PersonalRecord[];
  /** Catálogo completo de ejercicios, usado para resolver nombres y unidad de peso en la vista tabla. */
  exercises: Exercise[];
  /** Si se indica, filtra la vista a los PRs de este ejercicio y habilita las sub-pestañas Real/Estimado. */
  selectedExercise?: Exercise;
  /**
   * Límite de reps (inclusive) a partir del cual un PR se considera poco
   * fiable para estimar el 1RM (series muy largas distorsionan la fórmula).
   * Si se indica, la pestaña "Estimado" excluye esos PRs del cálculo del
   * mejor 1RM, salvo que excluirlos deje la lista vacía.
   */
  estimatedRepLimit?: number;
}

/** Renderiza la lista/tabla de récords personales según el modo (ejercicio único o resumen global). */
export default function PersonalRecords({ records, exercises, selectedExercise, estimatedRepLimit }: PersonalRecordsProps) {
  const { t } = useTranslation();
  const [subTab, setSubTab] = useState<"real" | "estimado">("real");

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
        <Trophy className="text-muted-foreground" size={32} aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{t("progress:noRecordsTitleWeb")}</p>
        <p className="text-xs text-muted-foreground">
          {t("progress:noRecordsSubtitleWeb")}
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
          {t("progress:noRecordsForExerciseWeb")}
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
        <div className="flex rounded-2xl border bg-secondary/20 p-0.5 w-fit">
          {(["real", "estimado"] as const).map((sub) => (
            <button
              key={sub}
              onClick={() => setSubTab(sub)}
              className={`rounded-xl px-4 py-1.5 text-xs font-medium transition-colors ${
                subTab === sub
                  ? "bg-white shadow-sm dark:bg-secondary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {sub === "real" ? t("progress:realTab") : t("progress:estimatedTab")}
            </button>
          ))}
        </div>

        {subTab === "real" ? (
          <div className="space-y-2">
            {exPRs.map((pr) => (
              <div key={pr.id} className="flex items-center justify-between rounded-xl border px-4 py-3 text-sm">
                <div>
                  <span className="font-medium">{t("progress:repsCount", { count: pr.reps })}</span>
                  <span className="ml-2 font-semibold text-muted-foreground">{pr.weight} kg</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>
                    {new Date(pr.achieved_at).toLocaleDateString("es-ES", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </span>
                  <span>
                    {t("progress:est1RMLabel")}{" "}
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
              {t("progress:basedOnEstimated1RM", { value: best1RM.toFixed(1) })}
              {estimatedRepLimit && (
                <>{t("progress:excludesHighRepSets", { limit: estimatedRepLimit })}</>
              )}
            </p>
            {Array.from({ length: 15 }, (_, i) => i + 1).map((reps) => {
              const est = estimateRepMax(best1RM, reps);
              const actualPR = exPRs.find((pr) => pr.reps === reps);
              return (
                <div
                  key={reps}
                  className={`flex items-center justify-between rounded-xl border px-4 py-2.5 text-sm ${
                    actualPR ? "border-primary/30 bg-primary/5" : ""
                  }`}
                >
                  <span className="font-medium flex items-center gap-2">
                    {t("progress:repsCount", { count: reps })}
                    {actualPR && (
                      <span className="text-[10px] font-semibold text-primary uppercase tracking-wide">
                        {t("progress:prBadge")}
                      </span>
                    )}
                  </span>
                  <div className="text-right">
                    <span className="font-semibold">{est.toFixed(1)} kg</span>
                    {actualPR && (
                      <span className="ml-2 text-xs text-green-600">{t("progress:actualPRNote", { weight: actualPR.weight })}</span>
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
    <div className="rounded-xl border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-secondary/50">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t("progress:exerciseTableHeader")}</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t("progress:repsFieldLabel")}</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t("progress:weightFieldLabel")}</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t("progress:est1RMLabel")}</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t("progress:dateTableHeader")}</th>
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
                <td className="px-4 py-3 font-medium">{exercise?.name ?? t("progress:unknownExercise")}</td>
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
