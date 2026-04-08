"use client";

// PROJ-35: Countdown banner shown only when the event has not started yet.

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { CalendarClock } from "lucide-react";

interface Props {
  startDate: string; // ISO date (YYYY-MM-DD)
}

function diffParts(target: number, now: number) {
  const ms = Math.max(0, target - now);
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return { days, hours, minutes, seconds, done: ms === 0 };
}

export function PublicCountdown({ startDate }: Props) {
  const target = new Date(startDate + "T00:00:00").getTime();
  const [parts, setParts] = useState(() => diffParts(target, Date.now()));

  useEffect(() => {
    const id = window.setInterval(() => {
      setParts(diffParts(target, Date.now()));
    }, 1000);
    return () => window.clearInterval(id);
  }, [target]);

  const formatted = new Date(startDate + "T00:00:00").toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  if (parts.done) return null;

  return (
    <Card className="border-primary/30 bg-primary/5 p-5 text-center">
      <div className="mb-2 flex items-center justify-center gap-2 text-primary">
        <CalendarClock className="h-5 w-5" aria-hidden="true" />
        <span className="text-sm font-medium">Startet am {formatted}</span>
      </div>
      <div
        className="grid grid-cols-4 gap-2 text-foreground"
        role="timer"
        aria-live="polite"
        aria-label="Countdown bis Eventstart"
      >
        {[
          { label: "Tage", value: parts.days },
          { label: "Std", value: parts.hours },
          { label: "Min", value: parts.minutes },
          { label: "Sek", value: parts.seconds },
        ].map((p) => (
          <div key={p.label} className="rounded-md bg-background/60 py-2">
            <div className="text-2xl font-bold tabular-nums sm:text-3xl">
              {p.value.toString().padStart(2, "0")}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {p.label}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
