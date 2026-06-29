"use client";

import { useEffect, useState } from "react";

interface Props {
  startTime: string | undefined;
}

function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getElapsed(startTime: string | undefined, mountMs: number): number {
  const origin = startTime ? new Date(startTime).getTime() : mountMs;
  return Math.max(0, Math.floor((Date.now() - origin) / 1000));
}

export default function WorkoutTimer({ startTime }: Props) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const mountMs = Date.now();

    function tick() {
      setElapsed(getElapsed(startTime, mountMs));
    }

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  // startTime is stable for the lifetime of this component instance
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startTime]);

  return (
    <span
      aria-label={`Duración del entrenamiento: ${formatElapsed(elapsed)}`}
      className="font-mono text-sm tabular-nums text-muted-foreground"
    >
      {formatElapsed(elapsed)}
    </span>
  );
}
