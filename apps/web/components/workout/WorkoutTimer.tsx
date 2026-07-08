"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import { formatClockDuration } from "@fitnotes/core";

interface Props {
  startTime: string | undefined;
  onElapsedChange?: (elapsed: number) => void;
}

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
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={handleToggle}
        aria-label={running ? "Pausar temporizador" : "Reanudar temporizador"}
        className="text-muted-foreground hover:text-foreground"
      >
        {running ? <Pause size={14} /> : <Play size={14} />}
      </button>
      <span
        aria-label={`Duración del entrenamiento: ${formatClockDuration(elapsed)}`}
        className="font-mono text-sm tabular-nums text-muted-foreground"
      >
        {formatClockDuration(elapsed)}
      </span>
      {!running && <span className="text-xs text-muted-foreground">pausado</span>}
    </span>
  );
}
