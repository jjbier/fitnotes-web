"use client";

import { useState } from "react";
import Link from "next/link";
import type { ChartPoint } from "@fitnotes/database";
import { ExerciseType, getExerciseFields } from "@fitnotes/core";

type Period = "workout" | "week" | "month" | "year" | "all" | "custom";

const periodLabel: Record<Period, string> = {
  workout: "Última sesión",
  week: "Última semana",
  month: "Último mes",
  year: "Último año",
  all: "Todo",
  custom: "Personalizado",
};

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function formatSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

interface PeriodStatsProps {
  data: ChartPoint[];
  exerciseType?: ExerciseType;
  unit?: string;
}

export default function PeriodStats({ data, exerciseType, unit = "kg" }: PeriodStatsProps) {
  const [period, setPeriod] = useState<Period>("all");
  const [customFrom, setCustomFrom] = useState(daysAgo(30));
  const [customTo, setCustomTo] = useState(new Date().toISOString().slice(0, 10));

  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Sin datos para calcular estadísticas.
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

  const fields = exerciseType ? getExerciseFields(exerciseType) : { weight: true, reps: true, distance: true, time: true };

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
    { label: "Sesiones", value: String(sessions) },
  ];
  if (fields.weight && fields.reps) {
    stats.push({ label: "Volumen total", value: totalVolume > 0 ? `${totalVolume.toFixed(0)} ${unit}` : "—" });
    stats.push({ label: "1RM estimado", value: bestE1RM > 0 ? `${bestE1RM.toFixed(1)} ${unit}` : "—" });
  }
  if (fields.weight) stats.push({ label: "Peso máx.", value: maxWeight > 0 ? `${maxWeight} ${unit}` : "—" });
  if (fields.reps) {
    stats.push({ label: "Reps totales", value: totalReps > 0 ? String(totalReps) : "—" });
    stats.push({ label: "Reps máx.", value: maxReps > 0 ? String(maxReps) : "—" });
  }
  if (fields.distance) {
    stats.push({ label: "Distancia total", value: totalDistance > 0 ? `${totalDistance.toFixed(1)} km` : "—" });
    stats.push({ label: "Distancia máx.", value: maxDistance > 0 ? `${maxDistance.toFixed(1)} km` : "—" });
  }
  if (fields.time) {
    stats.push({ label: "Tiempo total", value: totalTime > 0 ? formatSeconds(totalTime) : "—" });
    stats.push({ label: "Tiempo máx.", value: maxTime > 0 ? formatSeconds(maxTime) : "—" });
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap items-center">
        {(Object.keys(periodLabel) as Period[]).map((p) => (
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
          <label htmlFor="stats-from" className="text-xs text-muted-foreground">Desde</label>
          <input
            id="stats-from"
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="rounded-md border px-2 py-1 text-sm"
          />
          <label htmlFor="stats-to" className="text-xs text-muted-foreground">Hasta</label>
          <input
            id="stats-to"
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="rounded-md border px-2 py-1 text-sm"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Sin sesiones en este periodo.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg border bg-card p-4">
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
          Ver entrenamiento del {filtered[0].date} →
        </Link>
      )}
    </div>
  );
}
