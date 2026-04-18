"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AgendaItem } from "@/lib/event-utils";

interface AgendaSelectorProps {
  agendaItems: AgendaItem[];
  value: string | null;
  onChange: (value: string | null) => void;
}

const NO_AGENDA_VALUE = "__none__";

/**
 * Dropdown to select the current agenda item for a content contribution.
 * Auto-selects today's agenda item. Hidden when no agenda items exist.
 */
export function AgendaSelector({
  agendaItems,
  value,
  onChange,
}: AgendaSelectorProps) {
  if (agendaItems.length === 0) {
    return (
      <div className="w-full">
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          Tagesabschnitt
        </label>
        <div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          Bitte Tagesabschnitte definieren
        </div>
      </div>
    );
  }

  const handleChange = (val: string) => {
    onChange(val === NO_AGENDA_VALUE ? null : val);
  };

  return (
    <div className="w-full">
      <label
        htmlFor="agenda-selector"
        className="mb-1.5 block text-xs font-medium text-muted-foreground"
      >
        Tagesabschnitt
      </label>
      <Select
        value={value ?? NO_AGENDA_VALUE}
        onValueChange={handleChange}
      >
        <SelectTrigger
          id="agenda-selector"
          className="w-full"
          aria-label="Agenda-Punkt auswählen"
        >
          <SelectValue placeholder="Tagesabschnitt wählen" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_AGENDA_VALUE}>
            Kein Tagesabschnitt
          </SelectItem>
          {agendaItems
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((item) => {
              const itemDate = new Date(item.date + "T00:00:00");
              const dateLabel = itemDate.toLocaleDateString("de-DE", {
                weekday: "short",
                day: "numeric",
                month: "short",
              });
              return (
                <SelectItem key={item.id} value={item.id}>
                  {dateLabel} — {item.title}
                </SelectItem>
              );
            })}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Find today's agenda item from the list.
 * Falls back to the first item (by sort_order) if today doesn't match.
 * Returns null only if the list is empty.
 */
export function findTodayAgendaItem(
  agendaItems: AgendaItem[]
): string | null {
  if (agendaItems.length === 0) return null;

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const todayMatch = agendaItems.find((item) => item.date === todayStr);
  if (todayMatch) return todayMatch.id;

  // Fallback: first item by sort_order
  const sorted = [...agendaItems].sort((a, b) => a.sort_order - b.sort_order);
  return sorted[0].id;
}
