"use client";

import { useEffect, useRef, useState } from "react";
import {
  calculate1RM,
  estimateRepMax,
  calculateSetWeight,
  calculatePlates,
} from "@fitnotes/core";
import { createBrowserClient, createExerciseRepository, createProgressRepository } from "@fitnotes/database";

const DEFAULT_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
const PERCENTAGES = [50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100];

type Tab = "1rm" | "set" | "plates" | "timer";

interface ExerciseOption { id: string; name: string; }

function useExerciseList() {
  const [exercises, setExercises] = useState<ExerciseOption[]>([]);
  const [loaded, setLoaded] = useState(false);
  function ensureLoaded() {
    if (loaded) return;
    setLoaded(true);
    const client = createBrowserClient();
    const repo = createExerciseRepository(client);
    repo.getExercises().then(({ data }) => {
      if (data) setExercises(data.map((e) => ({ id: e.id, name: e.name })).sort((a, b) => a.name.localeCompare(b.name)));
    });
  }
  return { exercises, ensureLoaded };
}

export default function ToolsPage() {
  const [tab, setTab] = useState<Tab>("1rm");

  return (
    <div className="space-y-5 max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight">Herramientas de entrenamiento</h1>

      <div className="flex flex-wrap gap-1 rounded-lg border p-1 w-fit">
        {([["1rm", "Calculadora 1RM"], ["set", "Calculadora de series"], ["plates", "Calculadora de discos"], ["timer", "Temporizador"]] as [Tab, string][]).map(
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
      {tab === "timer" && <RestTimerSection />}
    </div>
  );
}

function PRSelector({ onSelect }: { onSelect: (weight: number, reps: number) => void }) {
  const { exercises, ensureLoaded } = useExerciseList();
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);

  function handleOpen() {
    ensureLoaded();
    setOpen((v) => !v);
  }

  async function handleLoad() {
    if (!selectedId) return;
    setLoading(true);
    const client = createBrowserClient();
    const repo = createProgressRepository(client);
    const { data } = await repo.getPersonalRecords(selectedId);
    if (data && data.length > 0) {
      const best = data.reduce((b, pr) => pr.weight > b.weight ? pr : b, data[0]!);
      onSelect(best.weight, best.reps);
    }
    setLoading(false);
    setOpen(false);
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleOpen}
        className="text-xs text-primary underline-offset-2 hover:underline"
      >
        {open ? "Ocultar" : "Cargar desde ejercicio…"}
      </button>
      {open && (
        <div className="flex gap-2 items-center">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="flex-1 rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-background"
          >
            <option value="">Seleccionar ejercicio…</option>
            {exercises.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleLoad}
            disabled={!selectedId || loading}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "…" : "Cargar PR"}
          </button>
        </div>
      )}
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

      <PRSelector onSelect={(pw, pr) => { setWeight(String(pw)); setReps(String(pr)); }} />

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

      <PRSelector onSelect={(pw) => setBaseWeight(String(pw))} />

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

const PRESET_DURATIONS = [30, 60, 90, 120, 180, 300];

function formatTimerDisplay(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function playBeep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);
    ctx.close();
  } catch { /* AudioContext not available */ }
}

function RestTimerSection() {
  const [duration, setDuration] = useState(90);
  const [remaining, setRemaining] = useState(90);
  const [running, setRunning] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          setRunning(false);
          playBeep();
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            new Notification("¡Descanso terminado!", { body: "Es hora de tu siguiente serie 💪", tag: "rest-timer" });
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  function handleSetDuration(secs: number) {
    setDuration(secs);
    if (!running) setRemaining(secs);
    setCustomInput("");
  }

  function handleCustomDuration() {
    const val = parseInt(customInput, 10);
    if (val > 0) handleSetDuration(val);
  }

  function handleToggle() {
    if (remaining === 0) {
      setRemaining(duration);
      setRunning(true);
    } else {
      setRunning((r) => !r);
    }
  }

  function handleReset() {
    setRunning(false);
    setRemaining(duration);
  }

  function handleAdjust(delta: number) {
    const next = Math.max(5, duration + delta);
    setDuration(next);
    if (!running) setRemaining(next);
  }

  function requestNotifPermission() {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }

  const progress = remaining / duration;
  const finished = remaining === 0;
  const circumference = 2 * Math.PI * 54;

  return (
    <div className="rounded-lg border bg-card p-6 space-y-6">
      <div>
        <h2 className="font-semibold mb-1">Temporizador de descanso</h2>
        <p className="text-xs text-muted-foreground">Contador regresivo para el descanso entre series.</p>
      </div>

      {/* Circular timer display */}
      <div className="flex flex-col items-center gap-4">
        <div className="relative" style={{ width: 136, height: 136 }}>
          <svg width="136" height="136" className="rotate-[-90deg]">
            <circle cx="68" cy="68" r="54" strokeWidth="8" fill="none" className="stroke-secondary" />
            <circle
              cx="68" cy="68" r="54" strokeWidth="8" fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
              strokeLinecap="round"
              className={`transition-all duration-1000 ${finished ? "stroke-green-500" : "stroke-primary"}`}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-3xl font-mono font-bold tabular-nums ${finished ? "text-green-600" : running ? "text-primary" : "text-foreground"}`}>
              {formatTimerDisplay(remaining)}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleAdjust(-15)}
            disabled={running}
            aria-label="Restar 15 segundos"
            className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-secondary disabled:opacity-40"
          >
            −15s
          </button>
          <button
            onClick={handleToggle}
            className={`rounded-lg px-6 py-2 text-sm font-medium text-white transition-colors ${
              finished ? "bg-green-500 hover:bg-green-600" : "bg-primary hover:bg-primary/90"
            }`}
          >
            {running ? "Pausar" : finished ? "Reiniciar" : "Iniciar"}
          </button>
          <button
            onClick={() => handleAdjust(15)}
            disabled={running}
            aria-label="Añadir 15 segundos"
            className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-secondary disabled:opacity-40"
          >
            +15s
          </button>
          <button
            onClick={handleReset}
            aria-label="Reiniciar"
            className="rounded-lg border p-2 hover:bg-secondary text-muted-foreground"
          >
            ↺
          </button>
        </div>
      </div>

      {/* Preset durations */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Duración</p>
        <div className="flex flex-wrap gap-2">
          {PRESET_DURATIONS.map((s) => (
            <button
              key={s}
              onClick={() => handleSetDuration(s)}
              className={`rounded-md border px-3 py-1 text-sm ${duration === s && !customInput ? "bg-primary text-primary-foreground border-primary" : "hover:bg-secondary"}`}
            >
              {s < 60 ? `${s}s` : `${s / 60}min`}
            </button>
          ))}
          <div className="flex gap-1">
            <input
              type="number"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCustomDuration()}
              placeholder="seg"
              min="5"
              className="w-16 rounded-md border px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              onClick={handleCustomDuration}
              disabled={!customInput}
              className="rounded-md border px-2 py-1 text-sm hover:bg-secondary disabled:opacity-40"
            >
              OK
            </button>
          </div>
        </div>
      </div>

      {/* Notification permission */}
      {typeof window !== "undefined" && "Notification" in window && Notification.permission === "default" && (
        <button
          onClick={requestNotifPermission}
          className="text-xs text-primary underline-offset-2 hover:underline"
        >
          Activar notificaciones para recibir alerta cuando termine
        </button>
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

              <div className="overflow-x-auto">
                <div className="flex items-center gap-1 min-w-max px-2 py-4 justify-center">
                  <div className="w-2 h-10 bg-slate-400 rounded-l-sm" />
                  {[...perSide].reverse().map((p, i) => (
                    <PlateBlock key={`l${i}`} weight={p} />
                  ))}
                  <div className="w-24 h-4 bg-slate-300 rounded-sm flex items-center justify-center">
                    <span className="text-xs text-slate-600 font-medium">{bar}kg</span>
                  </div>
                  {perSide.map((p, i) => (
                    <PlateBlock key={`r${i}`} weight={p} />
                  ))}
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

