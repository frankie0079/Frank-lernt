"use client";

import { Badge } from "@/components/ui/badge";
import { EyeOff } from "lucide-react";
import type { BookPage } from "@/lib/book-types";

interface BookDaySidebarProps {
  pages: BookPage[];
  activeAgendaItemId: string | null;
  onSelect: (agendaItemId: string) => void;
}

export function BookDaySidebar({
  pages,
  activeAgendaItemId,
  onSelect,
}: BookDaySidebarProps) {
  if (pages.length === 0) return null;

  return (
    <nav
      aria-label="Tagebuch-Seiten"
      className="max-w-full md:sticky md:top-4 md:self-start"
    >
        <ul className="grid max-w-full grid-cols-1 gap-2">
          {pages.map((p) => {
            const isActive = p.agenda_item_id === activeAgendaItemId;
            const itemDate = new Date(p.agenda_date + "T00:00:00");
            const itemCount = (p.sections ?? []).reduce(
              (sum, s) => sum + (s.items?.length ?? 0),
              0
            );

            return (
              <li key={p.id} className="min-w-0">
                <button
                  type="button"
                  onClick={() => onSelect(p.agenda_item_id)}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex w-full min-w-0 items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                    isActive
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card hover:bg-accent"
                  }`}
                >
                  <div className="flex flex-col items-center justify-center rounded-md bg-muted px-2 py-1 text-center">
                    <span className="text-[10px] font-medium uppercase text-muted-foreground">
                      {itemDate.toLocaleDateString("de-DE", { weekday: "short" })}
                    </span>
                    <span className="text-base font-bold leading-none text-foreground">
                      {itemDate.getDate()}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {itemDate.toLocaleDateString("de-DE", { month: "short" })}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-foreground">
                      {p.agenda_title}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>
                        {itemCount}{" "}
                        {itemCount === 1 ? "Beitrag" : "Beiträge"}
                      </span>
                      {!p.is_visible && (
                        <Badge
                          variant="outline"
                          className="gap-1 px-1.5 py-0 text-[9px]"
                        >
                          <EyeOff className="h-2.5 w-2.5" aria-hidden="true" />
                          versteckt
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
    </nav>
  );
}
