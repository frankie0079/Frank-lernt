"use client";

import { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import type { AgendaItem } from "@/lib/event-utils";
import { Camera, Video, Type, Mic, LayoutGrid, ChevronRight } from "lucide-react";

export type FilterValue =
  | "all"
  | "photos"
  | "videos"
  | "texts"
  | "voice"
  | `agenda:${string}`;

interface FilterOption {
  value: FilterValue;
  label: string;
  icon?: React.ReactNode;
}

interface ContentFilterBarProps {
  activeFilter: FilterValue;
  onFilterChange: (filter: FilterValue) => void;
  agendaItems: AgendaItem[];
}

export function ContentFilterBar({
  activeFilter,
  onFilterChange,
  agendaItems,
}: ContentFilterBarProps) {
  const baseFilters: FilterOption[] = [
    { value: "all", label: "Alle", icon: <LayoutGrid className="h-3 w-3" /> },
    { value: "photos", label: "Fotos", icon: <Camera className="h-3 w-3" /> },
    { value: "videos", label: "Videos", icon: <Video className="h-3 w-3" /> },
    { value: "texts", label: "Texte", icon: <Type className="h-3 w-3" /> },
    {
      value: "voice",
      label: "Sprachmemos",
      icon: <Mic className="h-3 w-3" />,
    },
  ];

  const agendaFilters: FilterOption[] = agendaItems.map((item) => ({
    value: `agenda:${item.id}` as FilterValue,
    label: item.title,
  }));

  const allFilters = [...baseFilters, ...agendaFilters];

  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollHint, setShowScrollHint] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => setShowScrollHint(el.scrollWidth > el.clientWidth + 10 && el.scrollLeft < 20);
    check();
    el.addEventListener("scroll", check, { passive: true });
    return () => el.removeEventListener("scroll", check);
  }, [allFilters.length]);

  return (
    <div className="relative">
      <ScrollArea className="w-full whitespace-nowrap" ref={scrollRef}>
        <div className="flex gap-2 pb-2" role="tablist" aria-label="Beitraege filtern">
          {allFilters.map((filter) => {
            const isActive = activeFilter === filter.value;
            return (
              <button
                key={filter.value}
                role="tab"
                aria-selected={isActive}
                onClick={() => onFilterChange(filter.value)}
                className="shrink-0"
              >
                <Badge
                  variant={isActive ? "default" : "outline"}
                  className={`cursor-pointer gap-1 px-3 py-1.5 text-xs transition-colors ${
                    isActive
                      ? ""
                      : "hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  {filter.icon}
                  {filter.label}
                </Badge>
              </button>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      {showScrollHint && (
        <div className="pointer-events-none absolute right-0 top-0 flex h-full items-center bg-gradient-to-l from-background via-background/80 to-transparent pl-6 pr-1">
          <ChevronRight className="h-4 w-4 animate-pulse text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
