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
    return null;
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
          aria-label="Agenda-Punkt auswaehlen"
        >
          <SelectValue placeholder="Tagesabschnitt waehlen" />
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
 * Returns the ID of the matching item, or null.
 */
export function findTodayAgendaItem(
  agendaItems: AgendaItem[]
): string | null {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const match = agendaItems.find((item) => item.date === todayStr);
  return match?.id ?? null;
}
