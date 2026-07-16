/**
 * Cronómetro del entrenamiento en curso: muestra el tiempo transcurrido
 * desde `startTime`, en formato reloj, con un botón de pausa/reanudar. Es
 * puramente de presentación/estado local (no persiste la pausa en el
 * backend); pausar solo detiene el conteo visual y deja de notificar avances
 * a través de `onElapsedChange`.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import { formatClockDuration } from "@fitnotes/core";

/**
 * Props de `WorkoutTimer`.
 * @property startTime - Timestamp ISO de inicio del entrenamiento; al cambiar, reinicia el cronómetro recalculando el tiempo transcurrido desde ese origen. `undefined` equivale a "empieza ahora".
 * @property onElapsedChange - Se invoca cada segundo (y al pausar) con el total de segundos transcurridos.
 */
interface Props {
  startTime: string | undefined;
  onElapsedChange?: (elapsed: number) => void;
}

/**
 * Comportamiento no obvio: el tiempo transcurrido se acumula en dos partes
 * para sobrevivir a pausas — `elapsedBaseRef` (segundos ya acumulados de
 * segmentos anteriores) + el segmento en curso (`segmentStartRef` hasta
 * ahora). Al pausar, el segmento en curso se suma a la base y
 * `segmentStartRef` se pone a `null`; al reanudar, se abre un nuevo segmento.
 * Esto evita depender de un único `setInterval` continuo que se desincronice
 * tras pausas repetidas.
 */
export default function WorkoutTimer({ startTime, onElapsedChange }: Props) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(true);
  const elapsedBaseRef = useRef(0);
  const segmentStartRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Re-initialize whenever the underlying workout (start_time) changes
  useEffect(() => {
    const origin = startTime ? new Date(startTime).getTime() : Date.now();
    elapsedBaseRef.current = Math.max(0, Math.floor((Date.now() - origin) / 1000));
    segmentStartRef.current = Date.now();
    setElapsed(elapsedBaseRef.current);
    setRunning(true);
  }, [startTime]);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    segmentStartRef.current = Date.now();
    function tick() {
      const segMs = segmentStartRef.current !== null ? Date.now() - segmentStartRef.current : 0;
      const total = elapsedBaseRef.current + Math.floor(segMs / 1000);
      setElapsed(total);
      onElapsedChange?.(total);
    }
    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  function handleToggle() {
    if (running) {
      if (segmentStartRef.current !== null) {
        elapsedBaseRef.current += Math.floor((Date.now() - segmentStartRef.current) / 1000);
      }
      segmentStartRef.current = null;
      setRunning(false);
      onElapsedChange?.(elapsedBaseRef.current);
    } else {
      segmentStartRef.current = Date.now();
      setRunning(true);
    }
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-xl bg-secondary px-3 py-1.5">
      <button
        type="button"
        onClick={handleToggle}
        aria-label={running ? "Pausar temporizador" : "Reanudar temporizador"}
        className="text-primary hover:text-primary/80"
      >
        {running ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
      </button>
      <span
        aria-label={`Duración del entrenamiento: ${formatClockDuration(elapsed)}`}
        className="font-mono text-sm font-semibold tabular-nums text-primary"
      >
        {formatClockDuration(elapsed)}
      </span>
      {!running && <span className="text-xs text-muted-foreground">pausado</span>}
    </span>
  );
}
