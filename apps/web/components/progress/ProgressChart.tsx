/**
 * ProgressChart — Recharts line chart for exercise progress over time
 *
 * TODO:
 *  - Accept time-series data points (date + value)
 *  - Support multiple metrics: 1RM estimate, best weight, total volume
 *  - Metric selector (tabs or dropdown)
 *  - Responsive container + tooltips
 *  - Use calculate1RM from @fitnotes/core for 1RM data points
 */

"use client";

interface DataPoint {
  date: string;
  value: number;
}

interface ProgressChartProps {
  data: DataPoint[];
  metric?: "1rm" | "volume" | "best_weight";
  exerciseName?: string;
  height?: number;
}

export default function ProgressChart({
  data,
  metric = "1rm",
  exerciseName,
  height = 220,
}: ProgressChartProps) {
  const metricLabels = {
    "1rm": "Estimated 1RM",
    volume: "Total Volume",
    best_weight: "Best Weight",
  };

  if (data.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex flex-col items-center justify-center rounded-md border border-dashed gap-2"
      >
        <p className="text-sm text-muted-foreground">No data yet</p>
        {exerciseName && (
          <p className="text-xs text-muted-foreground">
            Log sets for {exerciseName} to see progress
          </p>
        )}
      </div>
    );
  }

  // TODO: replace this placeholder with actual Recharts <LineChart>
  return (
    <div style={{ height }} className="rounded-md border bg-secondary/20 flex flex-col p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium">{metricLabels[metric]}</span>
        {exerciseName && (
          <span className="text-xs text-muted-foreground">{exerciseName}</span>
        )}
      </div>
      <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
        Recharts LineChart — {data.length} data points
        {/*
          TODO: implement with:
          import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              ...
            </LineChart>
          </ResponsiveContainer>
        */}
      </div>
    </div>
  );
}
