"use client";

import { useState } from "react";
import {
  calculate1RM,
  estimateRepMax,
  calculateSetWeight,
  calculatePlates,
  roundToNearest,
} from "@fitnotes/core";

const DEFAULT_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
const PERCENTAGES = [50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100];

type Tab = "1rm" | "set" | "plates";

export default function ToolsPage() {
  const [tab, setTab] = useState<Tab>("1rm");

  return (
    <div className="space-y-5 max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight">Herramientas de entrenamiento</h1>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg border p-1 w-fit">
        {([["1rm", "Calculadora 1RM"], ["set", "Calculadora de series"], ["plates", "Calculadora de discos"]] as [Tab, string][]).map(
          ([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === key ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
              }`}
            >
              {label}
            </button>
          )
        )}
      </div>

      {tab === "1rm" && <OneRMCalculator />}
      {tab === "set" && <SetCalculator />}
      {tab === "plates" && <PlateCalculatorPanel />}
    </div>
  );
}

function OneRMCalculator() {
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");

  const w = parseFloat(weight);
  const r = parseInt(reps, 10);
  const oneRM = w > 0 && r > 0 ? calculate1RM(w, r) : null;

  return (
    <div className="rounded-lg border bg-card p-6 space-y-5">
      <div>
        <h2 className="font-semibold mb-1">Calculadora 1RM</h2>
        <p className="text-xs text-muted-foreground">Usa la fórmula de Brzycki. Más precisa para 1–10 repeticiones.</p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Peso (kg)</label>
          <input
            type="number"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="ej. 100"
            min="0"
            step="0.5"
            className="w-36 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Repeticiones</label>
          <input
            type="number"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            placeholder="ej. 5"
            min="1"
            max="36"
            step="1"
            className="w-28 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {oneRM !== null && (
        <>
          <div className="rounded-lg bg-primary/10 px-5 py-4">
            <p className="text-xs text-muted-foreground mb-0.5">1RM estimado</p>
            <p className="text-4xl font-bold text-primary">{oneRM.toFixed(1)} <span className="text-lg font-normal">kg</span></p>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Tabla de máximos por repeticiones</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Array.from({ length: 15 }, (_, i) => i + 1).map((n) => {
                const est = n === 1 ? oneRM : estimateRepMax(oneRM, n);
                return (
                  <div
                    key={n}
                    className={`rounded-md border px-3 py-2 flex justify-between items-center text-sm ${n === r ? "border-primary bg-primary/5" : ""}`}
                  >
                    <span className="text-muted-foreground font-medium">{n}RM</span>
                    <span className="font-semibold">{est.toFixed(1)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SetCalculator() {
  const [baseWeight, setBaseWeight] = useState("");
  const [increment, setIncrement] = useState("2.5");

  const base = parseFloat(baseWeight);
  const inc = parseFloat(increment) || 2.5;

  return (
    <div className="rounded-lg border bg-card p-6 space-y-5">
      <div>
        <h2 className="font-semibold mb-1">Calculadora de series</h2>
        <p className="text-xs text-muted-foreground">Calcula los pesos de entrenamiento como porcentajes de tu peso de trabajo.</p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Peso base (kg)</label>
          <input
            type="number"
            value={baseWeight}
            onChange={(e) => setBaseWeight(e.target.value)}
            placeholder="ej. 100"
            min="0"
            step="0.5"
            className="w-36 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Redondear a (kg)</label>
          <select
            value={increment}
            onChange={(e) => setIncrement(e.target.value)}
            className="w-28 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
          >
            {[0.5, 1, 1.25, 2.5, 5].map((v) => (
              <option key={v} value={v}>{v} kg</option>
            ))}
          </select>
        </div>
      </div>

      {base > 0 && (
        <div className="space-y-2">
          {PERCENTAGES.map((pct) => {
            const setW = calculateSetWeight(base, pct, inc);
            const exact = base * (pct / 100);
            const diff = setW - exact;
            return (
              <div key={pct} className="flex items-center gap-3 rounded-md border px-4 py-2">
                <span className="w-10 text-sm text-muted-foreground font-medium">{pct}%</span>
                <span className="flex-1 text-sm font-semibold">{setW.toFixed(1)} kg</span>
                {Math.abs(diff) > 0.01 && (
                  <span className="text-xs text-muted-foreground">
                    exacto: {exact.toFixed(1)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PlateCalculatorPanel() {
  const [targetWeight, setTargetWeight] = useState("");
  const [barWeight, setBarWeight] = useState("20");
  const [customPlates, setCustomPlates] = useState(DEFAULT_PLATES.join(", "));

  const target = parseFloat(targetWeight);
  const bar = parseFloat(barWeight) || 20;
  const plates = customPlates
    .split(",")
    .map((s) => parseFloat(s.trim()))
    .filter((n) => !isNaN(n) && n > 0);

  const perSide = target > 0 ? calculatePlates(target, bar, plates) : [];
  const achieved = bar + perSide.reduce((s, p) => s + p * 2, 0);

  return (
    <div className="rounded-lg border bg-card p-6 space-y-5">
      <div>
        <h2 className="font-semibold mb-1">Calculadora de discos</h2>
        <p className="text-xs text-muted-foreground">Muestra qué discos cargar por lado para alcanzar el peso objetivo.</p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Peso objetivo (kg)</label>
          <input
            type="number"
            value={targetWeight}
            onChange={(e) => setTargetWeight(e.target.value)}
            placeholder="ej. 140"
            min="0"
            step="0.5"
            className="w-36 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Peso de la barra (kg)</label>
          <select
            value={barWeight}
            onChange={(e) => setBarWeight(e.target.value)}
            className="w-28 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
          >
            {[10, 15, 20, 25].map((v) => (
              <option key={v} value={v}>{v} kg</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Discos disponibles (kg, separados por coma)</label>
        <input
          type="text"
          value={customPlates}
          onChange={(e) => setCustomPlates(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {target > 0 && (
        <div className="space-y-3">
          {perSide.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {target <= bar ? "El peso objetivo es igual o inferior al peso de la barra." : "No se puede alcanzar el objetivo con los discos disponibles."}
            </p>
          ) : (
            <>
              <div className="rounded-lg bg-primary/10 px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Discos por lado</p>
                  <p className="text-sm font-semibold mt-0.5">{perSide.join(" + ")} kg</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Total cargado</p>
                  <p className="text-2xl font-bold text-primary">{achieved.toFixed(1)} <span className="text-sm font-normal">kg</span></p>
                </div>
              </div>

              {/* Bar visualization */}
              <div className="overflow-x-auto">
                <div className="flex items-center gap-1 min-w-max px-2 py-4 justify-center">
                  {/* Left collar */}
                  <div className="w-2 h-10 bg-slate-400 rounded-l-sm" />
                  {/* Left plates (reversed) */}
                  {[...perSide].reverse().map((p, i) => (
                    <PlateBlock key={`l${i}`} weight={p} />
                  ))}
                  {/* Bar */}
                  <div className="w-24 h-4 bg-slate-300 rounded-sm flex items-center justify-center">
                    <span className="text-xs text-slate-600 font-medium">{bar}kg</span>
                  </div>
                  {/* Right plates */}
                  {perSide.map((p, i) => (
                    <PlateBlock key={`r${i}`} weight={p} />
                  ))}
                  {/* Right collar */}
                  <div className="w-2 h-10 bg-slate-400 rounded-r-sm" />
                </div>
              </div>

              {Math.abs(achieved - target) > 0.01 && (
                <p className="text-xs text-amber-600">
                  Más cercano alcanzable: {achieved.toFixed(1)} kg (diferencia de {Math.abs(achieved - target).toFixed(2)} kg)
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

const PLATE_COLORS: Record<number, string> = {
  25: "bg-red-500",
  20: "bg-blue-500",
  15: "bg-yellow-400",
  10: "bg-green-500",
  5: "bg-white border border-slate-300",
  2.5: "bg-red-300",
  1.25: "bg-slate-200 border border-slate-300",
  1: "bg-slate-200 border border-slate-300",
  0.5: "bg-slate-100 border border-slate-300",
};

function PlateBlock({ weight }: { weight: number }) {
  const color = PLATE_COLORS[weight] ?? "bg-slate-400";
  const height = Math.min(80, Math.max(32, weight * 2.5));
  return (
    <div
      className={`${color} rounded-sm flex items-center justify-center`}
      style={{ width: 24, height }}
    >
      <span className="text-xs font-bold text-white drop-shadow" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
        {weight}
      </span>
    </div>
  );
}
