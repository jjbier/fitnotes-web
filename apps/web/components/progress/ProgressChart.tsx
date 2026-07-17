/**
 * Gráfica de progreso de un ejercicio a lo largo del tiempo (Recharts
 * `LineChart`). Soporta múltiples métricas seleccionables (peso máx.,
 * volumen, 1RM estimado, etc.), dos modos "especiales" derivados
 * (peso a X reps, progresión de rep-max estimado), línea de tendencia por
 * regresión lineal y exportación de la gráfica como PNG.
 */
"use client";

import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import type { ChartPoint } from "@fitnotes/database";
import { ExerciseType, getExerciseFields, estimateRepMax, formatChartDuration, ALL_EXERCISE_FIELDS } from "@fitnotes/core";

/** Métrica simple (un campo de {@link ChartPoint}) que se puede graficar directamente. */
type ChartMetric =
  | "maxWeight" | "totalVolume" | "maxReps" | "totalReps" | "est1RM"
  | "maxDistance" | "totalDistance" | "maxTime" | "totalTime" | "maxSpeed" | "bestPace";
/** Modo de la gráfica: una métrica simple, o uno de los dos modos derivados que requieren un `repTarget`. */
type ChartMode = ChartMetric | "weightByReps" | "repMaxProgression";

/** Color de línea asignado a cada métrica, consistente entre botón de selección y trazo de la gráfica. */
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

/** Todas las métricas conocidas, en el orden en que se ofrecen cuando no hay `exerciseType`. */
const ALL_CHART_METRICS: ChartMetric[] = [
  "maxWeight", "totalVolume", "maxReps", "totalReps", "est1RM",
  "maxDistance", "totalDistance", "maxTime", "totalTime", "maxSpeed", "bestPace",
];

/**
 * Calcula qué métricas son aplicables a un tipo de ejercicio dado, en base a
 * los campos que registra (`getExerciseFields`). Sin `exerciseType`, devuelve
 * todas las métricas conocidas.
 */
function metricsForExercise(exerciseType?: ExerciseType): ChartMetric[] {
  if (!exerciseType) return ALL_CHART_METRICS;
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

/** Formatea el valor de una métrica para el tooltip: duración legible para métricas de tiempo/ritmo, un decimal para el resto. */
function formatMetricValue(metric: ChartMetric, v: number): string {
  if (metric === "maxTime" || metric === "totalTime" || metric === "bestPace") return formatChartDuration(v);
  return v.toFixed(1);
}

/**
 * Ajusta una recta de mínimos cuadrados sobre `values` (tratando el índice
 * de cada punto como variable independiente) y devuelve la serie de valores
 * ajustados, usada para dibujar la línea de tendencia. Con menos de 2 puntos
 * o varianza nula en X devuelve los valores originales/la media, respectivamente.
 */
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

/** Props de {@link ProgressChart}. */
interface ProgressChartProps {
  /** Puntos de progreso (uno por sesión) a graficar; el componente no hace fetching propio. */
  data: ChartPoint[];
  /** Nombre del ejercicio, usado en el título del PNG exportado y en el mensaje de "sin datos". */
  exerciseName?: string;
  /** Determina qué métricas se ofrecen como seleccionables; sin valor se ofrecen todas. */
  exerciseType?: ExerciseType;
  /** Alto en píxeles de la gráfica (y del placeholder cuando no hay datos). */
  height?: number;
}

/**
 * Renderiza la gráfica de línea con selector de métrica/modo y controles de
 * visualización (puntos, escala desde cero, tendencia, exportar PNG).
 */
export default function ProgressChart({ data, exerciseName, exerciseType, height = 220 }: ProgressChartProps) {
  const { t } = useTranslation();
  const metricLabel: Record<ChartMetric, string> = {
    maxWeight: t("progress:metric.maxWeight"),
    totalVolume: t("progress:metric.totalVolume"),
    maxReps: t("progress:metric.maxReps"),
    totalReps: t("progress:metric.totalReps"),
    est1RM: t("progress:metric.est1RM"),
    maxDistance: t("progress:metric.maxDistance"),
    totalDistance: t("progress:metric.totalDistance"),
    maxTime: t("progress:metric.maxTime"),
    totalTime: t("progress:metric.totalTime"),
    maxSpeed: t("progress:metric.maxSpeed"),
    bestPace: t("progress:metric.bestPace"),
  };
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
        <p className="text-sm text-muted-foreground">{t("progress:noChartDataTitle")}</p>
        {exerciseName && (
          <p className="text-xs text-muted-foreground">
            {t("progress:noChartDataSubtitle", { exercise: exerciseName })}
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
    ? t("progress:weightAtRepsLabel", { reps: repTarget })
    : mode === "repMaxProgression"
    ? t("progress:estimatedRMLabel", { reps: repTarget })
    : metricLabel[metric!];

  /**
   * Exporta la gráfica actualmente renderizada como PNG: clona el `<svg>`
   * generado por Recharts, le añade un fondo blanco y un título, lo serializa
   * y lo dibuja en un `<canvas>` (a 2x de resolución) para finalmente
   * descargarlo como imagen. Todo el trabajo ocurre en el cliente, sin
   * dependencias externas de renderizado.
   */
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
    titleEl.textContent = t("progress:exportedChartTitle", { exercise: exerciseName ?? "", label });
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
        a.download = `${(exerciseName ?? t("progress:progressFallbackFilename")).replace(/\s+/g, "_")}-${mode}.png`;
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
              {t("progress:weightByRepsButton")}
            </button>
            <button
              onClick={() => setMode("repMaxProgression")}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                mode === "repMaxProgression" ? "bg-indigo-500 text-white border-indigo-500" : "hover:bg-secondary"
              }`}
            >
              {t("progress:repMaxProgressionButton")}
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
            {showDots ? t("progress:hideDotsButton") : t("progress:showDotsButton")}
          </button>
          <button
            onClick={() => setYDomain((v) => (v === "auto" ? "zero" : "auto"))}
            className="rounded-full border px-3 py-1 text-xs font-medium hover:bg-secondary text-muted-foreground"
          >
            {yDomain === "auto" ? t("progress:scaleFromZeroButton") : t("progress:scaleAutoButton")}
          </button>
          <button
            onClick={() => setShowTrend((v) => !v)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              showTrend ? "bg-orange-500 text-white border-orange-500" : "hover:bg-secondary text-muted-foreground"
            }`}
          >
            {t("progress:trendLabel")}
          </button>
          <button
            onClick={exportChart}
            disabled={exporting}
            className="rounded-full border px-3 py-1 text-xs font-medium hover:bg-secondary text-muted-foreground disabled:opacity-40"
            aria-label={t("progress:exportPngLabel")}
          >
            {exporting ? "…" : t("progress:exportButton")}
          </button>
        </div>
      </div>

      {isSpecialMode && (
        <div className="flex items-center gap-2">
          <label htmlFor="rep-target" className="text-xs font-medium text-muted-foreground">{t("progress:repsColonLabel")}</label>
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
            {t("progress:noSessionsAtRepsMessage", { reps: repTarget })}
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
                  name === "trend" ? t("progress:trendLabel") : label,
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
