"use client";

// PROJ-35: Countdown banner shown only when the event has not started yet.
// PROJ-40: Added `targetHour` prop (default 12), removed seconds column,
//          reduced update interval to 60s.

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { CalendarClock } from "lucide-react";

interface Props {
  /** ISO date (YYYY-MM-DD) of the event start. */
  startDate: string;
  /**
   * Target hour (0-23, local browser time) at which the countdown reaches
   * zero on `startDate`. Defaults to 12 (noon, typical travel start).
   * The public event page (PROJ-35) passes `0` to preserve midnight behavior.
   */
  targetHour?: number;
}

function diffParts(target: number, now: number) {
  const ms = Math.max(0, target - now);
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return { days, hours, minutes, done: ms === 0 };
}

export function PublicCountdown({ startDate, targetHour = 12 }: Props) {
  const target = useMemo(() => {
    // Parse YYYY-MM-DD into local Date at the requested hour.
    const [y, m, d] = startDate.split("-").map((n) => parseInt(n, 10));
    return new Date(y, (m ?? 1) - 1, d ?? 1, targetHour, 0, 0, 0).getTime();
  }, [startDate, targetHour]);

  // `now` is the clock we render against. We only need it to bump every 60s;
  // whenever `target` changes, `parts` naturally recomputes from the live `now`.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const parts = diffParts(target, now);

  const formatted = useMemo(() => {
    const [y, m, d] = startDate.split("-").map((n) => parseInt(n, 10));
    return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString("de-DE", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, [startDate]);

  if (parts.done) return null;

  return (
    <Card className="border-primary/30 bg-primary/5 p-5 text-center">
      <div className="mb-2 flex items-center justify-center gap-2 text-primary">
        <CalendarClock className="h-5 w-5" aria-hidden="true" />
        <span className="text-sm font-medium">Startet am {formatted}</span>
      </div>
      <div
        className="grid grid-cols-3 gap-2 text-foreground"
        role="timer"
        aria-live="polite"
        aria-label="Countdown bis Eventstart"
      >
        {[
          { label: "Tage", value: parts.days },
          { label: "Std", value: parts.hours },
          { label: "Min", value: parts.minutes },
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
