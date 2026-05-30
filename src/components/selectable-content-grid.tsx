"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ContentCard,
  ContentCardSkeleton,
  type ContentItem,
} from "@/components/content-card";
import {
  ContentFilterBar,
  type FilterValue,
} from "@/components/content-filter-bar";
import type { AgendaItem } from "@/lib/event-utils";
import { Check, LayoutGrid } from "lucide-react";

const PAGE_SIZE = 20;

interface SelectableContentGridProps {
  eventId: string;
  userId: string;
  isOrganizer: boolean;
  agendaItems: AgendaItem[];
  selectedIds: Set<string>;
  onToggle: (item: ContentItem) => void;
  /** If set, the grid defaults to showing only this agenda day's content (used in curation). */
  defaultAgendaItemId?: string;
}

function filterToTypeParam(filter: FilterValue): string | null {
  switch (filter) {
    case "photos":
      return "photo";
    case "videos":
      return "video";
    case "notes":
      return "notes";
    default:
      return null;
  }
}

function filterToAgendaId(filter: FilterValue): string | null {
  if (typeof filter === "string" && filter.startsWith("agenda:")) {
    return filter.slice(7);
  }
  return null;
}

function matchesFilter(item: ContentItem, filter: FilterValue): boolean {
  if (filter === "all") return true;
  if (filter === "photos") return item.type === "photo";
  if (filter === "videos") return item.type === "video";
  if (filter === "notes") return item.type === "text" || item.type === "audio";
  if (filter.startsWith("agenda:")) {
    return item.agenda_item_id === filter.slice(7);
  }
  return true;
}

export function SelectableContentGrid({
  eventId,
  userId,
  isOrganizer,
  agendaItems,
  selectedIds,
  onToggle,
  defaultAgendaItemId,
}: SelectableContentGridProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContentItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadMoreRef = useRef<HTMLDivElement>(null);
  const activeFilterRef = useRef<FilterValue>("all");
  const itemIdsRef = useRef<Set<string>>(new Set());

  const rawFilter = (searchParams.get("filter") as FilterValue) || "all";
  // When scoped to a specific agenda day (curation mode), combine the type
  // filter with the agenda filter so "Fotos" means "photos of THIS day", not
  // "all photos of the whole event".
  const activeFilter: FilterValue = defaultAgendaItemId && rawFilter === "all"
    ? (`agenda:${defaultAgendaItemId}` as FilterValue)
    : rawFilter;
  activeFilterRef.current = activeFilter;

  const setFilter = useCallback(
    (filter: FilterValue) => {
      const params = new URLSearchParams(searchParams.toString());
      if (filter === "all") params.delete("filter");
      else params.set("filter", filter);
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  const buildUrl = useCallback(
    (cursor?: string) => {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      if (cursor) params.set("cursor", cursor);
      const typeParam = filterToTypeParam(activeFilter);
      if (typeParam) params.set("filter", typeParam);
      const agendaId = filterToAgendaId(activeFilter);
      // In curation mode, always scope by the default agenda day, even when a
      // type filter is active (otherwise "Fotos" would show all event photos).
      const effectiveAgendaId = agendaId || defaultAgendaItemId || null;
      if (effectiveAgendaId) params.set("agenda", effectiveAgendaId);
      return `/api/events/${eventId}/content?${params.toString()}`;
    },
    [eventId, activeFilter, defaultAgendaItemId]
  );

  const fetchItems = useCallback(
    async (cursor?: string) => {
      try {
        if (!cursor) setLoading(true);
        else setLoadingMore(true);

        const res = await fetch(buildUrl(cursor));
        if (!res.ok) throw new Error("Beiträge konnten nicht geladen werden.");
        const data = await res.json();
        const newItems: ContentItem[] = data.content_items || [];

        if (!cursor) setItems(newItems);
        else setItems((prev) => [...prev, ...newItems]);

        setHasMore(newItems.length >= PAGE_SIZE);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Ein Fehler ist aufgetreten."
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [buildUrl]
  );

  useEffect(() => {
    setItems([]);
    setHasMore(true);
    fetchItems();
  }, [activeFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          const last = items[items.length - 1];
          if (last) fetchItems(last.created_at);
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, items, fetchItems]);

  useEffect(() => {
    itemIdsRef.current = new Set(items.map((i) => i.id));
  }, [items]);

  // Realtime: new INSERTs appear in the pool as they come in
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    const supabase = createClient(url, key);

    const channel = supabase
      .channel(`curation_content:event=${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "content_items",
          filter: `event_id=eq.${eventId}`,
        },
        async (payload) => {
          const row = payload.new as ContentItem;
          if (itemIdsRef.current.has(row.id)) return;
          try {
            const res = await fetch(
              `/api/events/${eventId}/content?id=${row.id}`
            );
            if (!res.ok) return;
            const data = await res.json();
            const full: ContentItem | undefined = (data.content_items || [])[0];
            if (!full) return;
            if (itemIdsRef.current.has(full.id)) return;
            if (matchesFilter(full, activeFilterRef.current)) {
              itemIdsRef.current.add(full.id);
              setItems((prev) => [full, ...prev]);
            }
          } catch {
            /* ignore */
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "content_items",
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          const id = (payload.old as { id?: string })?.id;
          if (id) setItems((prev) => prev.filter((i) => i.id !== id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  if (loading && items.length === 0) {
    return (
      <div className="space-y-4">
        <ContentFilterBar
          activeFilter={activeFilter}
          onFilterChange={setFilter}
          agendaItems={defaultAgendaItemId ? [] : agendaItems}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <ContentCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div className="space-y-4">
        <ContentFilterBar
          activeFilter={activeFilter}
          onFilterChange={setFilter}
          agendaItems={defaultAgendaItemId ? [] : agendaItems}
        />
        <div className="rounded-lg border border-destructive/50 p-6 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => fetchItems()}
          >
            Erneut versuchen
          </Button>
        </div>
      </div>
    );
  }

  if (items.length === 0 && !loading) {
    return (
      <div className="space-y-4">
        <ContentFilterBar
          activeFilter={activeFilter}
          onFilterChange={setFilter}
          agendaItems={defaultAgendaItemId ? [] : agendaItems}
        />
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <LayoutGrid
            className="mx-auto mb-3 h-10 w-10 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="text-sm font-medium text-foreground">
            Noch keine Beiträge
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Sobald Teilnehmer Beiträge erstellen, erscheinen sie hier.
          </p>
        </div>
      </div>
    );
  }

  const noop = () => {};

  return (
    <div className="space-y-4">
      <ContentFilterBar
        activeFilter={activeFilter}
        onFilterChange={setFilter}
        agendaItems={agendaItems}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {items.map((item) => {
          const checked = selectedIds.has(item.id);
          return (
            <div
              key={item.id}
              className={`relative rounded-xl transition-shadow ${
                checked
                  ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                  : ""
              }`}
              onClick={(e) => {
                // Let reaction bar, comment badge, audio controls still work
                const target = e.target as HTMLElement;
                if (
                  target.closest("button, a, audio, input, [role='button']")
                ) {
                  return;
                }
                onToggle(item);
              }}
            >
              <div className="absolute left-2 top-2 z-20">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle(item);
                  }}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-background/90 shadow"
                  aria-label={
                    checked ? "Aus Auswahl entfernen" : "Zur Auswahl hinzufügen"
                  }
                  aria-pressed={checked}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-sm border ${
                      checked
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-primary bg-background"
                    }`}
                    aria-hidden="true"
                  >
                    {checked && <Check className="h-3.5 w-3.5" />}
                  </span>
                </button>
              </div>

              <ContentCard
                item={item}
                currentUserId={userId}
                isOrganizer={isOrganizer}
                onTap={noop}
                onDelete={setDeleteTarget}
                reactionsReadOnly
              />
            </div>
          );
        })}
      </div>

      <div ref={loadMoreRef} className="h-px" />

      {loadingMore && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ContentCardSkeleton />
          <ContentCardSkeleton />
        </div>
      )}

      {!hasMore && items.length > 0 && (
        <p className="py-4 text-center text-xs text-muted-foreground">
          Alle Beiträge geladen
        </p>
      )}

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Beitrag löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Beitrag unwiderruflich löschen? Falls er in einem Bericht
              ausgewählt ist, wird er auch dort entfernt. Diese Aktion kann
              nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={async (e) => {
                e.preventDefault();
                if (!deleteTarget) return;
                const target = deleteTarget;
                setDeleting(true);
                try {
                  const res = await fetch(
                    `/api/events/${eventId}/content/${target.id}`,
                    { method: "DELETE" }
                  );
                  if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data.error || "Löschen fehlgeschlagen");
                  }
                  setItems((prev) => prev.filter((i) => i.id !== target.id));
                  itemIdsRef.current.delete(target.id);
                  toast.success("Beitrag gelöscht");
                  setDeleteTarget(null);
                } catch (err) {
                  toast.error(
                    err instanceof Error ? err.message : "Löschen fehlgeschlagen"
                  );
                } finally {
                  setDeleting(false);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Lösche…" : "Löschen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
