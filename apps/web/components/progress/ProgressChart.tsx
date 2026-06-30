"use client";

import { useRef, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import type { ChartPoint } from "@fitnotes/database";

type ChartMetric = "maxWeight" | "totalVolume" | "maxReps" | "est1RM";

const metricLabel: Record<ChartMetric, string> = {
  maxWeight: "Peso máx. (kg)",
  totalVolume: "Volumen total (kg)",
  maxReps: "Reps máx.",
  est1RM: "1RM estimado (kg)",
};

const metricColor: Record<ChartMetric, string> = {
  maxWeight: "#6366f1",
  totalVolume: "#10b981",
  maxReps: "#f59e0b",
  est1RM: "#ec4899",
};

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
  height?: number;
}

export default function ProgressChart({ data, exerciseName, height = 220 }: ProgressChartProps) {
  const [metric, setMetric] = useState<ChartMetric>("maxWeight");
  const [showTrend, setShowTrend] = useState(false);
  const [exporting, setExporting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  if (data.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex flex-col items-center justify-center rounded-md border border-dashed gap-2"
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

  const trendValues =
    showTrend && data.length >= 2
      ? linearRegression(data.map((p) => p[metric] as number))
      : null;

  const plotData = trendValues
    ? data.map((p, i) => ({ ...p, trend: trendValues[i] }))
    : data;

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
    titleEl.textContent = `${exerciseName ?? ""} — ${metricLabel[metric]}`;
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
        a.download = `${(exerciseName ?? "progreso").replace(/\s+/g, "_")}-${metric}.png`;
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
        {(["maxWeight", "totalVolume", "maxReps", "est1RM"] as ChartMetric[]).map((m) => (
          <button
            key={m}
            onClick={() => setMetric(m)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              metric === m ? "text-primary-foreground border-primary" : "hover:bg-secondary"
            }`}
            style={metric === m ? { backgroundColor: metricColor[m], borderColor: metricColor[m] } : {}}
          >
            {metricLabel[m]}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
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

      <div ref={containerRef} className="rounded-lg border bg-card p-4">
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={plotData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d: string) => d.slice(5)} />
            <YAxis tick={{ fontSize: 10 }} width={42} />
            <Tooltip
              labelFormatter={(l) => String(l)}
              formatter={(v, name) => [
                typeof v === "number" ? v.toFixed(1) : String(v),
                name === "trend" ? "Tendencia" : metricLabel[metric],
              ]}
            />
            <Line
              type="monotone"
              dataKey={metric}
              stroke={metricColor[metric]}
              strokeWidth={2}
              dot={{ r: 3, fill: metricColor[metric] }}
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
      </div>
    </div>
  );
}
