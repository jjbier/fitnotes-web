"use client";

/**
 * Página de herramientas de entrenamiento ("/tools"): calculadora de 1RM, calculadora de series
 * (porcentajes del peso base), calculadora de discos de barra y temporizador de descanso.
 * Presentadas como pestañas dentro de una única página; cada calculadora usa las funciones puras
 * de `@fitnotes/core` y algunas permiten cargar un PR existente o añadir el resultado directamente
 * al entrenamiento de hoy vía los repositorios de `@fitnotes/database`.
 */
import { useEffect, useRef, useState } from "react";
import {
  calculate1RM,
  estimateRepMax,
  calculateSetWeight,
  calculatePlates,
  formatMinutesSeconds,
  DEFAULT_PLATES,
} from "@fitnotes/core";
import { createBrowserClient, createExerciseRepository, createProgressRepository, createWorkoutRepository } from "@fitnotes/database";
import { useWorkoutForDate } from "@/hooks/useWorkoutForDate";

const PERCENTAGES = [50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100];

type Tab = "1rm" | "set" | "plates" | "timer";

interface ExerciseOption { id: string; name: string; }

/**
 * Hook que carga perezosamente (`ensureLoaded`) la lista de ejercicios del usuario desde
 * Supabase, ordenada alfabéticamente. Evita hacer la consulta hasta que algún selector de
 * ejercicio la necesita (se abre el desplegable de "Cargar desde ejercicio…" o similar).
 */
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

/**
 * Componente de página: gestiona la pestaña activa (1RM, series, discos, temporizador) y
 * renderiza el panel de calculadora correspondiente.
 */
export default function ToolsPage() {
  const [tab, setTab] = useState<Tab>("1rm");

  return (
    <div className="space-y-5 max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight">Herramientas de entrenamiento</h1>

      <div role="tablist" aria-label="Herramientas de entrenamiento" className="flex flex-wrap gap-1 rounded-2xl border p-1 w-fit">
        {([["1rm", "Calculadora 1RM"], ["set", "Calculadora de series"], ["plates", "Calculadora de discos"], ["timer", "Temporizador"]] as [Tab, string][]).map(
          ([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`rounded-xl px-4 py-1.5 text-sm font-medium transition-colors ${
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

/**
 * Selector desplegable opcional que, dado un ejercicio elegido por el usuario, busca su récord
 * personal más pesado (`getPersonalRecords`) y lo entrega vía `onSelect(weight, reps)` para
 * precargar los campos de la calculadora que lo use.
 */
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
            className="flex-1 rounded-xl border px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-background"
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
            className="rounded-xl bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "…" : "Cargar PR"}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Añade una serie con `weight`/`reps` al entrenamiento `workoutId` ya resuelto (ver
 * `useWorkoutForDate` — se encarga de decidir a cuál de los entrenamientos del día, si hay
 * varios): reutiliza o crea el `workout_exercise` para `exerciseId` y añade la serie al final.
 * No hace nada (devuelve `false`) si no hay usuario, si el entrenamiento ya está finalizado
 * (`end_time` presente), o si falla la creación del set. Devuelve `true` si la serie se creó.
 */
async function addSetToWorkout(workoutId: string, exerciseId: string, weight: number, reps: number | undefined): Promise<boolean> {
  const client = createBrowserClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return false;
  const workoutRepo = createWorkoutRepository(client);

  const { data: workout } = await workoutRepo.getWorkout(workoutId);
  if (!workout || workout.end_time) return false;

  const { data: wes } = await workoutRepo.getWorkoutExercises(workout.id);
  let we = wes?.find((w) => w.exercise_id === exerciseId);
  if (!we) {
    const { data } = await workoutRepo.addExercise(
      { workout_id: workout.id, exercise_id: exerciseId, order_index: wes?.length ?? 0 },
      user.id
    );
    we = data ?? undefined;
  }
  if (!we) return false;

  const { data: existingSets } = await workoutRepo.getSets(we.id);
  const { error } = await workoutRepo.createSet(
    { workout_exercise_id: we.id, weight, reps, order_index: existingSets?.length ?? 0 },
    user.id
  );
  return !error;
}

/**
 * Selector de ejercicio + campo de repeticiones usado por la calculadora de series para elegir a
 * qué ejercicio del entrenamiento de hoy añadir cada peso calculado. Es controlado: el estado vive
 * en el componente padre (`SetCalculator`).
 */
function AddToWorkoutPicker({ exerciseId, reps, onChangeExercise, onChangeReps }: {
  exerciseId: string;
  reps: string;
  onChangeExercise: (id: string) => void;
  onChangeReps: (r: string) => void;
}) {
  const { exercises, ensureLoaded } = useExerciseList();
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed p-3">
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Añadir a entrenamiento de hoy</label>
        <select
          value={exerciseId}
          onFocus={ensureLoaded}
          onChange={(e) => onChangeExercise(e.target.value)}
          className="w-48 rounded-xl border px-2 py-1.5 text-sm bg-background"
        >
          <option value="">Seleccionar ejercicio…</option>
          {exercises.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Reps</label>
        <input
          type="number"
          value={reps}
          onChange={(e) => onChangeReps(e.target.value)}
          min="1"
          className="w-20 rounded-xl border px-2 py-1.5 text-sm bg-background"
        />
      </div>
    </div>
  );
}

/**
 * Calculadora de 1RM (una repetición máxima) con la fórmula de Brzycki: a partir de un peso y
 * unas repeticiones levantadas, estima el 1RM y muestra además una tabla de máximos estimados
 * para 1–15 repeticiones (`estimateRepMax`). Permite precargar peso/reps desde un PR existente
 * vía `PRSelector`.
 */
function OneRMCalculator() {
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");

  const w = parseFloat(weight);
  const r = parseInt(reps, 10);
  const oneRM = w > 0 && r > 0 ? calculate1RM(w, r) : null;

  return (
    <div className="rounded-2xl border bg-card p-6 space-y-5">
      <div>
        <h2 className="font-semibold mb-1">Calculadora 1RM</h2>
        <p className="text-xs text-muted-foreground">Usa la fórmula de Brzycki. Más precisa para 1–10 repeticiones.</p>
      </div>

      <PRSelector onSelect={(pw, pr) => { setWeight(String(pw)); setReps(String(pr)); }} />

      <div className="flex gap-3 flex-wrap">
        <div className="space-y-1">
          <label htmlFor="onerm-weight" className="text-xs font-medium text-muted-foreground">Peso (kg)</label>
          <input
            id="onerm-weight"
            type="number"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="ej. 100"
            min="0"
            step="0.5"
            className="w-36 rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="onerm-reps" className="text-xs font-medium text-muted-foreground">Repeticiones</label>
          <input
            id="onerm-reps"
            type="number"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            placeholder="ej. 5"
            min="1"
            max="36"
            step="1"
            className="w-28 rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {oneRM !== null && (
        <>
          <div className="rounded-2xl bg-primary/10 px-5 py-4">
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
                    className={`rounded-xl border px-3 py-2 flex justify-between items-center text-sm ${n === r ? "border-primary bg-primary/5" : ""}`}
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

/**
 * Calculadora de series: dado un peso base (habitualmente un 1RM o PR) y un incremento de
 * redondeo, calcula el peso de trabajo para cada porcentaje de `PERCENTAGES` (`calculateSetWeight`)
 * y permite añadir cualquiera de esos pesos como serie al entrenamiento de hoy (o al que elija el
 * usuario si hay varios, ver `useWorkoutForDate`) mediante `addSetToWorkout`.
 */
function SetCalculator() {
  const [baseWeight, setBaseWeight] = useState("");
  const [increment, setIncrement] = useState("2.5");
  const [addExerciseId, setAddExerciseId] = useState("");
  const [addReps, setAddReps] = useState("5");
  const [addedPct, setAddedPct] = useState<number | null>(null);

  const client = createBrowserClient();
  const workoutRepo = createWorkoutRepository(client);
  const { resolveWorkoutForDate, pickerModal } = useWorkoutForDate(workoutRepo);

  const base = parseFloat(baseWeight);
  const inc = parseFloat(increment) || 2.5;

  /**
   * Añade el peso calculado para el porcentaje `pct` como serie del ejercicio seleccionado en
   * `AddToWorkoutPicker`. Resuelve primero a qué entrenamiento de hoy añadirla (directo si hay 0 o
   * 1, preguntando si hay varios) y, si tiene éxito, marca brevemente (1.5s) ese porcentaje como
   * "Añadido" en la UI.
   */
  async function handleAdd(pct: number, weight: number) {
    if (!addExerciseId) return;
    const { data: { user } } = await client.auth.getUser();
    if (!user) return;
    const today = new Date().toISOString().split("T")[0]!;
    const workoutId = await resolveWorkoutForDate(today, user.id);
    if (!workoutId) return;
    const reps = parseInt(addReps, 10) || undefined;
    const ok = await addSetToWorkout(workoutId, addExerciseId, weight, reps);
    if (ok) {
      setAddedPct(pct);
      setTimeout(() => setAddedPct((p) => (p === pct ? null : p)), 1500);
    }
  }

  return (
    <div className="rounded-2xl border bg-card p-6 space-y-5">
      <div>
        <h2 className="font-semibold mb-1">Calculadora de series</h2>
        <p className="text-xs text-muted-foreground">Calcula los pesos de entrenamiento como porcentajes de tu peso de trabajo.</p>
      </div>

      <PRSelector onSelect={(pw) => setBaseWeight(String(pw))} />

      <div className="flex gap-3 flex-wrap">
        <div className="space-y-1">
          <label htmlFor="set-base-weight" className="text-xs font-medium text-muted-foreground">Peso base (kg)</label>
          <input
            id="set-base-weight"
            type="number"
            value={baseWeight}
            onChange={(e) => setBaseWeight(e.target.value)}
            placeholder="ej. 100"
            min="0"
            step="0.5"
            className="w-36 rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="set-increment" className="text-xs font-medium text-muted-foreground">Redondear a (kg)</label>
          <select
            id="set-increment"
            value={increment}
            onChange={(e) => setIncrement(e.target.value)}
            className="w-28 rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
          >
            {[0.5, 1, 1.25, 2.5, 5].map((v) => (
              <option key={v} value={v}>{v} kg</option>
            ))}
          </select>
        </div>
      </div>

      {base > 0 && (
        <>
          <AddToWorkoutPicker
            exerciseId={addExerciseId}
            reps={addReps}
            onChangeExercise={setAddExerciseId}
            onChangeReps={setAddReps}
          />
          <div className="space-y-2">
            {PERCENTAGES.map((pct) => {
              const setW = calculateSetWeight(base, pct, inc);
              const exact = base * (pct / 100);
              const diff = setW - exact;
              return (
                <div key={pct} className="flex items-center gap-3 rounded-xl border px-4 py-2">
                  <span className="w-10 text-sm text-muted-foreground font-medium">{pct}%</span>
                  <span className="flex-1 text-sm font-semibold">{setW.toFixed(1)} kg</span>
                  {Math.abs(diff) > 0.01 && (
                    <span className="text-xs text-muted-foreground">
                      exacto: {exact.toFixed(1)}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleAdd(pct, setW)}
                    disabled={!addExerciseId}
                    className="rounded-xl border px-3 py-1 text-xs font-medium hover:bg-secondary disabled:opacity-40"
                  >
                    {addedPct === pct ? "Añadido ✓" : "+ Añadir"}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
      {pickerModal}
    </div>
  );
}

const PRESET_DURATIONS = [30, 60, 90, 120, 180, 300];

/** Reproduce un pitido corto (880Hz, envolvente exponencial) vía Web Audio API al terminar el descanso. Silencioso si `AudioContext` no está disponible. */
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

/**
 * Temporizador de descanso entre series: cuenta regresiva configurable con presets, ajuste
 * ±15s, duración personalizada y aviso sonoro + notificación del navegador al llegar a 0.
 * Se renderiza como un anillo circular de progreso (SVG) alrededor del tiempo restante.
 */
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

  /** Fija la duración a `secs` (preset o valor custom) y reinicia el restante si no está corriendo. */
  function handleSetDuration(secs: number) {
    setDuration(secs);
    if (!running) setRemaining(secs);
    setCustomInput("");
  }

  /** Aplica la duración escrita en el input personalizado, si es un número positivo válido. */
  function handleCustomDuration() {
    const val = parseInt(customInput, 10);
    if (val > 0) handleSetDuration(val);
  }

  /** Inicia/pausa el temporizador; si llegó a 0, reinicia desde `duration` y arranca. */
  function handleToggle() {
    if (remaining === 0) {
      setRemaining(duration);
      setRunning(true);
    } else {
      setRunning((r) => !r);
    }
  }

  /** Detiene el conteo y restaura el tiempo restante a la duración configurada. */
  function handleReset() {
    setRunning(false);
    setRemaining(duration);
  }

  /** Suma/resta `delta` segundos a la duración (mínimo 5s), sin bajar de ahí. */
  function handleAdjust(delta: number) {
    const next = Math.max(5, duration + delta);
    setDuration(next);
    if (!running) setRemaining(next);
  }

  /** Solicita permiso de notificaciones del navegador si aún no se ha decidido ("default"). */
  function requestNotifPermission() {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }

  const progress = remaining / duration;
  const finished = remaining === 0;
  const circumference = 2 * Math.PI * 54;

  return (
    <div className="rounded-2xl border bg-card p-6 space-y-6">
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
              {formatMinutesSeconds(remaining)}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleAdjust(-15)}
            disabled={running}
            aria-label="Restar 15 segundos"
            className="rounded-2xl border px-3 py-1.5 text-sm font-medium hover:bg-secondary disabled:opacity-40"
          >
            −15s
          </button>
          <button
            onClick={handleToggle}
            className={`rounded-2xl px-6 py-2 text-sm font-medium text-white transition-colors ${
              finished ? "bg-green-500 hover:bg-green-600" : "bg-primary hover:bg-primary/90"
            }`}
          >
            {running ? "Pausar" : finished ? "Reiniciar" : "Iniciar"}
          </button>
          <button
            onClick={() => handleAdjust(15)}
            disabled={running}
            aria-label="Añadir 15 segundos"
            className="rounded-2xl border px-3 py-1.5 text-sm font-medium hover:bg-secondary disabled:opacity-40"
          >
            +15s
          </button>
          <button
            onClick={handleReset}
            aria-label="Reiniciar"
            className="rounded-2xl border p-2 hover:bg-secondary text-muted-foreground"
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
              className={`rounded-xl border px-3 py-1 text-sm ${duration === s && !customInput ? "bg-primary text-primary-foreground border-primary" : "hover:bg-secondary"}`}
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
              className="w-16 rounded-xl border px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              onClick={handleCustomDuration}
              disabled={!customInput}
              className="rounded-xl border px-2 py-1 text-sm hover:bg-secondary disabled:opacity-40"
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

/**
 * Calculadora de discos de barra: dado un peso objetivo, el peso de la barra y la lista de discos
 * disponibles, calcula la combinación de discos por lado (`calculatePlates`) y muestra una
 * representación visual de la barra cargada.
 */
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
    <div className="rounded-2xl border bg-card p-6 space-y-5">
      <div>
        <h2 className="font-semibold mb-1">Calculadora de discos</h2>
        <p className="text-xs text-muted-foreground">Muestra qué discos cargar por lado para alcanzar el peso objetivo.</p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="space-y-1">
          <label htmlFor="plates-target" className="text-xs font-medium text-muted-foreground">Peso objetivo (kg)</label>
          <input
            id="plates-target"
            type="number"
            value={targetWeight}
            onChange={(e) => setTargetWeight(e.target.value)}
            placeholder="ej. 140"
            min="0"
            step="0.5"
            className="w-36 rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="plates-bar" className="text-xs font-medium text-muted-foreground">Peso de la barra (kg)</label>
          <select
            id="plates-bar"
            value={barWeight}
            onChange={(e) => setBarWeight(e.target.value)}
            className="w-28 rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
          >
            {[10, 15, 20, 25].map((v) => (
              <option key={v} value={v}>{v} kg</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="plates-custom" className="text-xs font-medium text-muted-foreground">Discos disponibles (kg, separados por coma)</label>
        <input
          id="plates-custom"
          type="text"
          value={customPlates}
          onChange={(e) => setCustomPlates(e.target.value)}
          className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
              <div className="rounded-2xl bg-primary/10 px-5 py-3 flex items-center justify-between">
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
                  <div className="w-2 h-10 bg-slate-400 rounded-l-md" />
                  {[...perSide].reverse().map((p, i) => (
                    <PlateBlock key={`l${i}`} weight={p} />
                  ))}
                  <div className="w-24 h-4 bg-slate-300 rounded-md flex items-center justify-center">
                    <span className="text-xs text-slate-600 font-medium">{bar}kg</span>
                  </div>
                  {perSide.map((p, i) => (
                    <PlateBlock key={`r${i}`} weight={p} />
                  ))}
                  <div className="w-2 h-10 bg-slate-400 rounded-r-md" />
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

/** Bloque visual de un disco individual: color por peso estándar (`PLATE_COLORS`) y altura proporcional al peso. */
function PlateBlock({ weight }: { weight: number }) {
  const color = PLATE_COLORS[weight] ?? "bg-slate-400";
  const height = Math.min(80, Math.max(32, weight * 2.5));
  return (
    <div
      className={`${color} rounded-md flex items-center justify-center`}
      style={{ width: 24, height }}
    >
      <span className="text-xs font-bold text-white drop-shadow" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
        {weight}
      </span>
    </div>
  );
}

