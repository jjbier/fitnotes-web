"use client";

import { useRef, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import type { ChartPoint } from "@fitnotes/database";
import { ExerciseType, getExerciseFields, estimateRepMax, formatChartDuration, ALL_EXERCISE_FIELDS } from "@fitnotes/core";

type ChartMetric =
  | "maxWeight" | "totalVolume" | "maxReps" | "totalReps" | "est1RM"
  | "maxDistance" | "totalDistance" | "maxTime" | "totalTime" | "maxSpeed" | "bestPace";
type ChartMode = ChartMetric | "weightByReps" | "repMaxProgression";

const metricLabel: Record<ChartMetric, string> = {
  maxWeight: "Peso máx.",
  totalVolume: "Volumen total",
  maxReps: "Reps máx.",
  totalReps: "Reps totales",
  est1RM: "1RM estimado",
  maxDistance: "Distancia máx.",
  totalDistance: "Distancia total",
  maxTime: "Tiempo máx.",
  totalTime: "Tiempo total",
  maxSpeed: "Velocidad máx.",
  bestPace: "Mejor ritmo",
};

const metricColor: Record<ChartMetric, string> = {
  maxWeight: "#6366f1",
  totalVolume: "#10b981",
  maxReps: "#f59e0b",
  totalReps: "#eab308",
  est1RM: "#ec4899",
  maxDistance: "#0ea5e9",
  totalDistance: "#0284c7",
  maxTime: "#8b5cf6",
  totalTime: "#7c3aed",
  maxSpeed: "#14b8a6",
  bestPace: "#f43f5e",
};

function metricsForExercise(exerciseType?: ExerciseType): ChartMetric[] {
  if (!exerciseType) return Object.keys(metricLabel) as ChartMetric[];
  const fields = getExerciseFields(exerciseType);
  const metrics: ChartMetric[] = [];
  if (fields.weight) metrics.push("maxWeight");
  if (fields.weight && fields.reps) metrics.push("totalVolume", "est1RM");
  if (fields.reps) metrics.push("maxReps", "totalReps");
  if (fields.distance) metrics.push("maxDistance", "totalDistance");
  if (fields.time) metrics.push("maxTime", "totalTime");
  if (fields.distance && fields.time) metrics.push("maxSpeed", "bestPace");
  return metrics;
}

function formatMetricValue(metric: ChartMetric, v: number): string {
  if (metric === "maxTime" || metric === "totalTime" || metric === "bestPace") return formatChartDuration(v);
  return v.toFixed(1);
}

function linearRegression(values: number[]): number[] {
  const n = values.length;
  if (n < 2) return [...values];
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((s, v) => s + v, 0) / n;
  const num = values.reduce((s, v, i) => s + (i - xMean) * (v - yMean), 0);
  const den = values.reduce((s, _, i) => s + (i - xMean) ** 2, 0);
  if (den === 0) return values.map(() => parseFloat(yMean.toFixed(2)));
  const slope = num / den;
  const intercept = yMean - slope * xMean;
  return values.map((_, i) => parseFloat((slope * i + intercept).toFixed(2)));
}

interface ProgressChartProps {
  data: ChartPoint[];
  exerciseName?: string;
  exerciseType?: ExerciseType;
  height?: number;
}

export default function ProgressChart({ data, exerciseName, exerciseType, height = 220 }: ProgressChartProps) {
  const availableMetrics = metricsForExercise(exerciseType);
  const fields = exerciseType ? getExerciseFields(exerciseType) : ALL_EXERCISE_FIELDS;
  const [mode, setMode] = useState<ChartMode>(availableMetrics[0] ?? "maxWeight");
  const [repTarget, setRepTarget] = useState(5);
  const [showTrend, setShowTrend] = useState(false);
  const [showDots, setShowDots] = useState(true);
  const [yDomain, setYDomain] = useState<"auto" | "zero">("auto");
  const [exporting, setExporting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  if (data.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex flex-col items-center justify-center rounded-xl border border-dashed gap-2"
      >
        <p className="text-sm text-muted-foreground">Sin datos aún</p>
        {exerciseName && (
          <p className="text-xs text-muted-foreground">
            Registra series de {exerciseName} para ver el progreso
          </p>
        )}
      </div>
    );
  }

  const isSpecialMode = mode === "weightByReps" || mode === "repMaxProgression";
  const metric = isSpecialMode ? null : (mode as ChartMetric);

  const specialData = isSpecialMode
    ? data
        .map((p) => ({
          date: p.date,
          value: mode === "weightByReps"
            ? p.weightByReps[repTarget]
            : (p.est1RM > 0 ? estimateRepMax(p.est1RM, repTarget) : undefined),
        }))
        .filter((p): p is { date: string; value: number } => p.value != null && p.value > 0)
    : [];

  const rawSeries = isSpecialMode
    ? specialData.map((p) => p.value)
    : data.map((p) => p[metric!] as number);

  const trendValues = showTrend && rawSeries.length >= 2 ? linearRegression(rawSeries) : null;

  const plotData = isSpecialMode
    ? specialData.map((p, i) => ({ date: p.date, value: p.value, ...(trendValues ? { trend: trendValues[i] } : {}) }))
    : data.map((p, i) => ({ ...p, ...(trendValues ? { trend: trendValues[i] } : {}) }));

  const dataKey = isSpecialMode ? "value" : metric!;
  const lineColor = isSpecialMode ? "#6366f1" : metricColor[metric!];
  const label = mode === "weightByReps"
    ? `Peso a ${repTarget} reps`
    : mode === "repMaxProgression"
    ? `${repTarget}RM estimado`
    : metricLabel[metric!];

  async function exportChart() {
    const container = containerRef.current;
    if (!container) return;
    const svg = container.querySelector("svg");
    if (!svg) return;
    setExporting(true);

    const { width, height: svgH } = svg.getBoundingClientRect();
    const svgClone = svg.cloneNode(true) as SVGSVGElement;
    svgClone.setAttribute("width", String(width));
    svgClone.setAttribute("height", String(svgH + 28));
    svgClone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

    const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bg.setAttribute("width", "100%"); bg.setAttribute("height", "100%"); bg.setAttribute("fill", "white");
    svgClone.insertBefore(bg, svgClone.firstChild);

    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("transform", "translate(0, 24)");
    while (svgClone.children.length > 1) g.appendChild(svgClone.children[1]!);
    svgClone.appendChild(g);

    const titleEl = document.createElementNS("http://www.w3.org/2000/svg", "text");
    titleEl.setAttribute("x", "10"); titleEl.setAttribute("y", "16");
    titleEl.setAttribute("font-size", "12"); titleEl.setAttribute("font-family", "system-ui, sans-serif");
    titleEl.setAttribute("font-weight", "600"); titleEl.setAttribute("fill", "#111");
    titleEl.textContent = `${exerciseName ?? ""} — ${label}`;
    svgClone.insertBefore(titleEl, g);

    const svgString = new XMLSerializer().serializeToString(svgClone);
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const img = new window.Image();
    img.onload = () => {
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = width * scale; canvas.height = (svgH + 28) * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(scale, scale);
      ctx.fillStyle = "white"; ctx.fillRect(0, 0, width, svgH + 28);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((png) => {
        if (!png) { setExporting(false); return; }
        const pngUrl = URL.createObjectURL(png);
        const a = document.createElement("a");
        a.href = pngUrl;
        a.download = `${(exerciseName ?? "progreso").replace(/\s+/g, "_")}-${mode}.png`;
        a.click();
        URL.revokeObjectURL(pngUrl);
        setExporting(false);
      }, "image/png");
    };
    img.onerror = () => { URL.revokeObjectURL(url); setExporting(false); };
    img.src = url;
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap items-center">
        {availableMetrics.map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              mode === m ? "text-primary-foreground border-primary" : "hover:bg-secondary"
            }`}
            style={mode === m ? { backgroundColor: metricColor[m], borderColor: metricColor[m] } : {}}
          >
            {metricLabel[m]}
          </button>
        ))}
        {fields.weight && fields.reps && (
          <>
            <button
              onClick={() => setMode("weightByReps")}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                mode === "weightByReps" ? "bg-indigo-500 text-white border-indigo-500" : "hover:bg-secondary"
              }`}
            >
              Peso por reps
            </button>
            <button
              onClick={() => setMode("repMaxProgression")}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                mode === "repMaxProgression" ? "bg-indigo-500 text-white border-indigo-500" : "hover:bg-secondary"
              }`}
            >
              Progresión rep max
            </button>
          </>
        )}
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setShowDots((v) => !v)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              !showDots ? "bg-secondary" : "hover:bg-secondary text-muted-foreground"
            }`}
          >
            {showDots ? "Ocultar puntos" : "Mostrar puntos"}
          </button>
          <button
            onClick={() => setYDomain((v) => (v === "auto" ? "zero" : "auto"))}
            className="rounded-full border px-3 py-1 text-xs font-medium hover:bg-secondary text-muted-foreground"
          >
            {yDomain === "auto" ? "Escala desde 0" : "Escala auto"}
          </button>
          <button
            onClick={() => setShowTrend((v) => !v)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              showTrend ? "bg-orange-500 text-white border-orange-500" : "hover:bg-secondary text-muted-foreground"
            }`}
          >
            Tendencia
          </button>
          <button
            onClick={exportChart}
            disabled={exporting}
            className="rounded-full border px-3 py-1 text-xs font-medium hover:bg-secondary text-muted-foreground disabled:opacity-40"
            aria-label="Exportar gráfica como PNG"
          >
            {exporting ? "…" : "Exportar"}
          </button>
        </div>
      </div>

      {isSpecialMode && (
        <div className="flex items-center gap-2">
          <label htmlFor="rep-target" className="text-xs font-medium text-muted-foreground">Repeticiones:</label>
          <input
            id="rep-target"
            type="number"
            min={1}
            max={15}
            value={repTarget}
            onChange={(e) => setRepTarget(Math.min(15, Math.max(1, parseInt(e.target.value) || 1)))}
            className="w-16 rounded-xl border px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      )}

      <div ref={containerRef} className="rounded-2xl border bg-card p-4">
        {plotData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">
            Sin sesiones a {repTarget} reps aún.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={plotData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d: string) => d.slice(5)} />
              <YAxis
                tick={{ fontSize: 10 }}
                width={42}
                domain={yDomain === "zero" ? [0, "auto"] : ["auto", "auto"]}
                tickFormatter={(v: number) => (metric === "maxTime" || metric === "totalTime" || metric === "bestPace") ? formatChartDuration(v) : String(v)}
              />
              <Tooltip
                labelFormatter={(l) => String(l)}
                formatter={(v, name) => [
                  typeof v === "number" ? (metric ? formatMetricValue(metric, v) : v.toFixed(1)) : String(v),
                  name === "trend" ? "Tendencia" : label,
                ]}
              />
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke={lineColor}
                strokeWidth={2}
                dot={showDots ? { r: 3, fill: lineColor } : false}
                activeDot={{ r: 5 }}
              />
              {trendValues && (
                <Line
                  type="linear"
                  dataKey="trend"
                  stroke="#f97316"
                  strokeWidth={1.5}
                  strokeDasharray="5 3"
                  dot={false}
                  activeDot={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
