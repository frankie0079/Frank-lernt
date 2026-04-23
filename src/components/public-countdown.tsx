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
  /**
   * Compact variant: smaller padding, smaller digits, smaller header text.
   * Used in tight spaces like event cards and between cover/title on the
   * event dashboard. Defaults to `false` (full banner size for the public page).
   */
  compact?: boolean;
}

function diffParts(target: number, now: number) {
  const ms = Math.max(0, target - now);
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return { days, hours, minutes, done: ms === 0 };
}

export function PublicCountdown({ startDate, targetHour = 12, compact = false }: Props) {
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

  if (compact) {
    // Compact text-only variant used on /events and /events/[id]:
    // no box, no fill — plain text with "in:" prefix before the digits.
    return (
      <div className="text-right">
        <div className="flex items-center justify-end gap-1.5 text-primary">
          <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="text-xs font-semibold">Startet am {formatted}</span>
        </div>
        <div
          className="flex items-baseline justify-end gap-2 text-foreground"
          role="timer"
          aria-live="polite"
          aria-label="Countdown bis Eventstart"
        >
          <span className="text-sm font-semibold text-primary">in:</span>
          {[
            { label: "Tage", value: parts.days },
            { label: "Std", value: parts.hours },
            { label: "Min", value: parts.minutes },
          ].map((p) => (
            <span key={p.label} className="flex items-baseline gap-1">
              <span className="text-base font-bold tabular-nums leading-none">
                {p.value.toString().padStart(2, "0")}
              </span>
              <span className="text-[9px] uppercase tracking-wide text-muted-foreground">
                {p.label}
              </span>
            </span>
          ))}
        </div>
      </div>
    );
  }

  // Full banner variant (public event page / PROJ-35) — unchanged look.
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
