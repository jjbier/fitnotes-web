/**
 * Panel de estadísticas agregadas de un ejercicio para un periodo
 * seleccionable (última sesión, semana, mes, año, todo el histórico o rango
 * personalizado). Deriva las tarjetas de estadísticas a mostrar según los
 * campos que aplican al tipo de ejercicio (peso, reps, distancia, tiempo).
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import type { ChartPoint } from "@fitnotes/database";
import { ExerciseType, getExerciseFields, formatChartDuration, ALL_EXERCISE_FIELDS } from "@fitnotes/core";

/** Ventana temporal sobre la que se agregan las estadísticas. */
type Period = "workout" | "week" | "month" | "year" | "all" | "custom";

/** Orden en que se ofrecen los periodos en los botones de selección. */
const ALL_PERIODS: Period[] = ["workout", "week", "month", "year", "all", "custom"];

/** Devuelve la fecha (YYYY-MM-DD) correspondiente a `n` días antes de hoy. */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Props de {@link PeriodStats}. */
interface PeriodStatsProps {
  /** Puntos de progreso (uno por sesión) ya cargados para el ejercicio; el componente no hace fetching propio. */
  data: ChartPoint[];
  /** Determina qué estadísticas son relevantes (peso/reps/distancia/tiempo); si se omite se muestran todas. */
  exerciseType?: ExerciseType;
  /** Unidad de peso a mostrar junto a los valores de peso/volumen/1RM. */
  unit?: string;
}

/**
 * Filtra `data` según el periodo seleccionado y calcula las tarjetas de
 * estadísticas agregadas (sesiones, volumen, 1RM estimado, máximos, totales…)
 * correspondientes a los campos aplicables al tipo de ejercicio.
 */
export default function PeriodStats({ data, exerciseType, unit = "kg" }: PeriodStatsProps) {
  const { t } = useTranslation();
  const periodLabel: Record<Period, string> = {
    workout: t("progress:period.lastSession"),
    week: t("progress:period.lastWeek"),
    month: t("progress:period.lastMonth"),
    year: t("progress:period.lastYear"),
    all: t("progress:period.all"),
    custom: t("progress:period.custom"),
  };
  const [period, setPeriod] = useState<Period>("all");
  const [customFrom, setCustomFrom] = useState(daysAgo(30));
  const [customTo, setCustomTo] = useState(new Date().toISOString().slice(0, 10));

  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        {t("progress:noStatsDataMessage")}
      </p>
    );
  }

  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));

  let filtered: ChartPoint[];
  if (period === "workout") {
    filtered = sorted.slice(-1);
  } else if (period === "all") {
    filtered = sorted;
  } else if (period === "custom") {
    filtered = sorted.filter((p) => p.date >= customFrom && p.date <= customTo);
  } else {
    const cutoff = period === "week" ? daysAgo(7) : period === "month" ? daysAgo(30) : daysAgo(365);
    filtered = sorted.filter((p) => p.date >= cutoff);
  }

  const fields = exerciseType ? getExerciseFields(exerciseType) : ALL_EXERCISE_FIELDS;

  const sessions = filtered.length;
  const totalVolume = filtered.reduce((s, p) => s + p.totalVolume, 0);
  const totalReps = filtered.reduce((s, p) => s + p.totalReps, 0);
  const totalDistance = filtered.reduce((s, p) => s + p.totalDistance, 0);
  const totalTime = filtered.reduce((s, p) => s + p.totalTime, 0);
  const maxWeight = filtered.length ? Math.max(...filtered.map((p) => p.maxWeight)) : 0;
  const maxReps = filtered.length ? Math.max(...filtered.map((p) => p.maxReps)) : 0;
  const bestE1RM = filtered.length ? Math.max(...filtered.map((p) => p.est1RM)) : 0;
  const maxDistance = filtered.length ? Math.max(...filtered.map((p) => p.maxDistance)) : 0;
  const maxTime = filtered.length ? Math.max(...filtered.map((p) => p.maxTime)) : 0;

  const stats: { label: string; value: string }[] = [
    { label: t("progress:sessionsLabel"), value: String(sessions) },
  ];
  if (fields.weight && fields.reps) {
    stats.push({ label: t("progress:metric.totalVolume"), value: totalVolume > 0 ? `${totalVolume.toFixed(0)} ${unit}` : "—" });
    stats.push({ label: t("progress:metric.est1RM"), value: bestE1RM > 0 ? `${bestE1RM.toFixed(1)} ${unit}` : "—" });
  }
  if (fields.weight) stats.push({ label: t("progress:metric.maxWeight"), value: maxWeight > 0 ? `${maxWeight} ${unit}` : "—" });
  if (fields.reps) {
    stats.push({ label: t("progress:metric.totalReps"), value: totalReps > 0 ? String(totalReps) : "—" });
    stats.push({ label: t("progress:metric.maxReps"), value: maxReps > 0 ? String(maxReps) : "—" });
  }
  if (fields.distance) {
    stats.push({ label: t("progress:metric.totalDistance"), value: totalDistance > 0 ? `${totalDistance.toFixed(1)} km` : "—" });
    stats.push({ label: t("progress:metric.maxDistance"), value: maxDistance > 0 ? `${maxDistance.toFixed(1)} km` : "—" });
  }
  if (fields.time) {
    stats.push({ label: t("progress:metric.totalTime"), value: totalTime > 0 ? formatChartDuration(totalTime) : "—" });
    stats.push({ label: t("progress:metric.maxTime"), value: maxTime > 0 ? formatChartDuration(maxTime) : "—" });
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap items-center">
        {ALL_PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              period === p ? "bg-primary text-primary-foreground border-primary" : "hover:bg-secondary"
            }`}
          >
            {periodLabel[p]}
          </button>
        ))}
      </div>

      {period === "custom" && (
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor="stats-from" className="text-xs text-muted-foreground">{t("progress:fromLabel")}</label>
          <input
            id="stats-from"
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="rounded-xl border px-2 py-1 text-sm"
          />
          <label htmlFor="stats-to" className="text-xs text-muted-foreground">{t("progress:toLabel")}</label>
          <input
            id="stats-to"
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="rounded-xl border px-2 py-1 text-sm"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">{t("progress:noSessionsInPeriodMessage")}</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl border bg-card p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{s.label}</p>
              <p className="text-xl font-bold mt-1">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {period === "workout" && filtered[0] && (
        <Link
          href={`/workout/${filtered[0].date}`}
          className="inline-block text-sm text-primary hover:underline"
        >
          {t("progress:viewWorkoutLink", { date: filtered[0].date })}
        </Link>
      )}
    </div>
  );
}
