"use client";

import { Flame } from "lucide-react";

interface WeekStripProps {
  workoutDates: Set<string>;
  currentDate: string;
  today: string;
  onSelectDate: (date: string) => void;
}

const WEEK_LABELS = ["L", "M", "X", "J", "V", "S", "D"];

function getWeekDates(today: string): string[] {
  const todayDate = new Date(today + "T00:00:00");
  const dow = todayDate.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(todayDate);
  monday.setDate(todayDate.getDate() + mondayOffset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().split("T")[0]!;
  });
}

function getStreak(workoutDates: Set<string>, today: string): number {
  let count = 0;
  const d = new Date(today + "T00:00:00");
  if (!workoutDates.has(today)) d.setDate(d.getDate() - 1);
  for (;;) {
    const dateStr = d.toISOString().split("T")[0]!;
    if (!workoutDates.has(dateStr)) break;
    count++;
    d.setDate(d.getDate() - 1);
  }
  return count;
}

export default function WeekStrip({ workoutDates, currentDate, today, onSelectDate }: WeekStripProps) {
  const weekDates = getWeekDates(today);
  const streak = getStreak(workoutDates, today);

  return (
    <div className="flex items-center gap-1">
      {weekDates.map((dateStr, i) => {
        const has = workoutDates.has(dateStr);
        const isToday = dateStr === today;
        const isFuture = dateStr > today;
        const isCurrent = dateStr === currentDate;
        return (
          <button
            key={dateStr}
            onClick={() => onSelectDate(dateStr)}
            className="flex flex-1 flex-col items-center gap-1"
            aria-label={dateStr}
            aria-current={isCurrent ? "date" : undefined}
          >
            <span className={`text-[10px] font-semibold ${isToday ? "text-primary" : "text-muted-foreground"}`}>
              {WEEK_LABELS[i]}
            </span>
            <span
              className={[
                "flex h-6 w-6 items-center justify-center rounded-full",
                isCurrent ? "bg-primary" : has ? "bg-primary/10" : "",
                isToday && !isCurrent ? "ring-[1.5px] ring-primary" : "",
              ].join(" ")}
            >
              {has && !isFuture && (
                <span className={`h-[7px] w-[7px] rounded-full ${isCurrent ? "bg-primary-foreground" : "bg-primary"}`} />
              )}
            </span>
          </button>
        );
      })}
      {streak > 0 && (
        <div className="ml-2 flex shrink-0 items-center gap-1 rounded-xl bg-orange-50 px-2 py-1 dark:bg-orange-950/30">
          <Flame className="text-orange-500" size={13} aria-hidden="true" />
          <span className="text-xs font-bold text-orange-500">{streak}</span>
        </div>
      )}
    </div>
  );
}
