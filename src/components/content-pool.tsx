"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { toast } from "sonner";
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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ContentCard,
  ContentCardSkeleton,
  type ContentItem,
} from "@/components/content-card";
import {
  REACTION_EMOJIS,
  emptyReactionState,
  type ReactionEmoji,
} from "@/components/reaction-bar";
import {
  ContentFilterBar,
  type FilterValue,
} from "@/components/content-filter-bar";
import { ContentLightbox } from "@/components/content-lightbox";
import type { AgendaItem } from "@/lib/event-utils";
import { Camera, ArrowDown, LayoutGrid, MapPin } from "lucide-react";
import { PublicEventMap, type MapMarker } from "@/components/public-event-map";

const PAGE_SIZE = 20;

interface ContentPoolProps {
  eventId: string;
  userId: string;
  isOrganizer: boolean;
  agendaItems: AgendaItem[];
}

/** Map filter value to API type param */
function filterToTypeParam(filter: FilterValue): string | null {
  switch (filter) {
    case "photos":
      return "photo";
    case "videos":
      return "video";
    case "texts":
      return "text";
    case "voice":
      return "audio";
    default:
      return null;
  }
}

/** Map filter to agenda_item_id param */
function filterToAgendaId(filter: FilterValue): string | null {
  if (typeof filter === "string" && filter.startsWith("agenda:")) {
    return filter.slice(7);
  }
  return null;
}

export function ContentPool({
  eventId,
  userId,
  isOrganizer,
  agendaItems,
}: ContentPoolProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // State
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<ContentItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // "New items" pill
  const [newItemsCount, setNewItemsCount] = useState(0);
  const [isAtTop, setIsAtTop] = useState(true);
  const [showMap, setShowMap] = useState(false);

  // Refs
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<
    ReturnType<typeof createClient>["channel"]
  > | null>(null);
  // Refs for values used inside Realtime callbacks (avoids stale closures)
  const activeFilterRef = useRef<FilterValue>("all");
  const isAtTopRef = useRef(true);
  const itemIdsRef = useRef<Set<string>>(new Set());

  // Filter from URL
  const activeFilter = (searchParams.get("filter") as FilterValue) || "all";
  activeFilterRef.current = activeFilter;

  const setFilter = useCallback(
    (filter: FilterValue) => {
      const params = new URLSearchParams(searchParams.toString());
      if (filter === "all") {
        params.delete("filter");
      } else {
        params.set("filter", filter);
      }
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  // Build API URL
  const buildUrl = useCallback(
    (cursor?: string) => {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      if (cursor) params.set("cursor", cursor);

      const typeParam = filterToTypeParam(activeFilter);
      if (typeParam) params.set("filter", typeParam);

      const agendaId = filterToAgendaId(activeFilter);
      if (agendaId) params.set("agenda", agendaId);

      return `/api/events/${eventId}/content?${params.toString()}`;
    },
    [eventId, activeFilter]
  );

  // Fetch items
  const fetchItems = useCallback(
    async (cursor?: string) => {
      try {
        if (!cursor) setLoading(true);
        else setLoadingMore(true);

        const res = await fetch(buildUrl(cursor));
        if (!res.ok) {
          throw new Error("Beiträge konnten nicht geladen werden.");
        }
        const data = await res.json();
        const newItems: ContentItem[] = data.content_items || [];

        if (!cursor) {
          setItems(newItems);
        } else {
          setItems((prev) => [...prev, ...newItems]);
        }

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

  // Reset and reload when filter changes
  useEffect(() => {
    setItems([]);
    setHasMore(true);
    setNewItemsCount(0);
    fetchItems();
  }, [activeFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          const lastItem = items[items.length - 1];
          if (lastItem) {
            fetchItems(lastItem.created_at);
          }
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, items, fetchItems]);

  // Track scroll position for "new items" pill
  useEffect(() => {
    const handleScroll = () => {
      const atTop = window.scrollY < 300;
      setIsAtTop(atTop);
      isAtTopRef.current = atTop;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Keep item IDs ref in sync for deduplication
  useEffect(() => {
    itemIdsRef.current = new Set(items.map((i) => i.id));
  }, [items]);

  // When at top, clear new items count
  useEffect(() => {
    if (isAtTop && newItemsCount > 0) {
      setNewItemsCount(0);
    }
  }, [isAtTop, newItemsCount]);

  // Supabase Realtime — uses refs to avoid stale closures (BUG-1 fix)
  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return;

    const supabase = createClient(supabaseUrl, supabaseKey);

    const channel = supabase
      .channel(`content_items:event_id=eq.${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "content_items",
          filter: `event_id=eq.${eventId}`,
        },
        async (payload) => {
          const newRow = payload.new as ContentItem;

          // Deduplicate: skip if already in the list
          if (itemIdsRef.current.has(newRow.id)) return;

          // Fetch the full item with author data (uses cookie auth)
          try {
            const res = await fetch(
              `/api/events/${eventId}/content?id=${newRow.id}`
            );
            if (!res.ok) return;
            const data = await res.json();
            const fullItems: ContentItem[] = data.content_items || [];
            const fullItem = fullItems[0];
            // Guard: item may have been deleted before fetch completed
            if (!fullItem) return;

            // Deduplicate again after async fetch
            if (itemIdsRef.current.has(fullItem.id)) return;

            // Toast for other users' content (not own)
            if (fullItem.author_id !== userId) {
              toast.info(
                `Neuer Beitrag von ${fullItem.author_name || "Unbekannt"}`
              );
            }

            // Add to list if it matches current filter
            if (matchesFilter(fullItem, activeFilterRef.current)) {
              // Update ref immediately to prevent duplicates
              itemIdsRef.current.add(fullItem.id);
              if (isAtTopRef.current) {
                setItems((prev) => [fullItem, ...prev]);
              } else {
                setNewItemsCount((c) => c + 1);
                setItems((prev) => [fullItem, ...prev]);
              }
            }
          } catch {
            // Network error — silently ignore
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
          const deletedId = (payload.old as { id?: string })?.id;
          if (deletedId) {
            setItems((prev) => prev.filter((i) => i.id !== deletedId));
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, userId]);

  // Realtime: reactions INSERT/DELETE — patches items[*].reactions
  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return;

    const supabase = createClient(supabaseUrl, supabaseKey);
    const isValidEmoji = (e: unknown): e is ReactionEmoji =>
      typeof e === "string" &&
      (REACTION_EMOJIS as readonly string[]).includes(e);

    const applyDelta = (
      contentItemId: string,
      emoji: ReactionEmoji,
      delta: number,
      memberId: string | null
    ) => {
      setItems((prev) =>
        prev.map((it) => {
          if (it.id !== contentItemId) return it;
          const r = it.reactions ?? emptyReactionState();
          const counts = { ...r.counts };
          counts[emoji] = Math.max(0, (counts[emoji] ?? 0) + delta);
          let userReactions = r.userReactions;
          if (memberId && memberId === userId) {
            if (delta > 0 && !userReactions.includes(emoji)) {
              userReactions = [...userReactions, emoji];
            } else if (delta < 0) {
              userReactions = userReactions.filter((e) => e !== emoji);
            }
          }
          return { ...it, reactions: { counts, userReactions } };
        })
      );
    };

    const channel = supabase
      .channel(`reactions:event=${eventId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "reactions" },
        (payload) => {
          const row = payload.new as {
            content_item_id?: string;
            emoji?: string;
            member_id?: string;
          };
          if (!row.content_item_id || !isValidEmoji(row.emoji)) return;
          applyDelta(row.content_item_id, row.emoji, 1, row.member_id ?? null);
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "reactions" },
        (payload) => {
          const row = payload.old as {
            content_item_id?: string;
            emoji?: string;
            member_id?: string;
          };
          if (!row.content_item_id || !isValidEmoji(row.emoji)) return;
          applyDelta(row.content_item_id, row.emoji, -1, row.member_id ?? null);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, userId]);

  // Delete handler
  const handleDelete = async () => {
    if (!deleteTarget) return;
    const targetId = deleteTarget.id;

    // Optimistic removal
    setItems((prev) => prev.filter((i) => i.id !== targetId));
    setDeleteTarget(null);
    setDeleting(true);

    try {
      const res = await fetch(
        `/api/events/${eventId}/content/${targetId}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        throw new Error("Löschen fehlgeschlagen");
      }

      toast.success("Beitrag gelöscht");
    } catch {
      // Restore item on failure
      toast.error("Beitrag konnte nicht gelöscht werden");
      // Refetch to restore
      fetchItems();
    } finally {
      setDeleting(false);
    }
  };

  // Scroll to top helper
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setNewItemsCount(0);
  };

  // Lightbox handlers
  const openLightbox = (item: ContentItem) => {
    const idx = items.findIndex((i) => i.id === item.id);
    setLightboxIndex(idx >= 0 ? idx : 0);
    setLightboxOpen(true);
  };

  // Loading state
  if (loading && items.length === 0) {
    return (
      <div className="space-y-4">
        <ContentFilterBar
          activeFilter={activeFilter}
          onFilterChange={setFilter}
          agendaItems={agendaItems}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <ContentCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error && items.length === 0) {
    return (
      <div className="space-y-4">
        <ContentFilterBar
          activeFilter={activeFilter}
          onFilterChange={setFilter}
          agendaItems={agendaItems}
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

  // Empty state
  if (items.length === 0 && !loading) {
    return (
      <div className="space-y-4">
        <ContentFilterBar
          activeFilter={activeFilter}
          onFilterChange={setFilter}
          agendaItems={agendaItems}
        />
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <LayoutGrid
            className="mx-auto mb-3 h-10 w-10 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="text-sm font-medium text-foreground">
            {activeFilter === "all"
              ? "Noch keine Beiträge"
              : "Keine Beiträge für diesen Filter"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {activeFilter === "all"
              ? "Sei der Erste! Wechsle zum Beiträge-Tab und teile ein Foto oder einen Kommentar."
              : "Versuche einen anderen Filter oder erstelle einen passenden Beitrag."}
          </p>
          {activeFilter !== "all" && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setFilter("all")}
            >
              Alle Beiträge anzeigen
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" ref={listRef}>
      <div className="flex items-center gap-2">
        <div className="flex-1 overflow-x-auto">
          <ContentFilterBar
            activeFilter={activeFilter}
            onFilterChange={setFilter}
            agendaItems={agendaItems}
          />
        </div>
        {(items.some((i) => i.latitude != null) || agendaItems.some((a) => a.latitude != null)) && (
          <Button
            variant={showMap ? "default" : "outline"}
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setShowMap((v) => !v)}
            aria-label={showMap ? "Karte ausblenden" : "Karte anzeigen"}
          >
            <MapPin className="h-4 w-4" />
          </Button>
        )}
      </div>

      {showMap && (() => {
        const markers: MapMarker[] = items
          .map((i) => {
            // If agenda item has a location, use it (overrides photo GPS).
            // Agenda location is the curated "day location" — photo GPS
            // is often the upload location (iOS strips EXIF GPS).
            const agenda = agendaItems.find((a) => a.id === i.agenda_item_id);
            let lat: number | null;
            let lng: number | null;
            if (agenda?.latitude != null && agenda?.longitude != null) {
              lat = agenda.latitude;
              lng = agenda.longitude;
            } else {
              lat = i.latitude;
              lng = i.longitude;
            }
            if (lat == null || lng == null) return null;
            return {
              id: i.id,
              latitude: lat,
              longitude: lng,
              thumbnailUrl: i.thumbnail_url,
              authorName: i.author_name || null,
              agendaTitle: agendaItems.find((a) => a.id === i.agenda_item_id)?.title || "",
            };
          })
          .filter((m): m is MapMarker => m != null);
        return markers.length > 0 ? (
          <PublicEventMap markers={markers} />
        ) : null;
      })()}

      {/* "New items" pill */}
      {newItemsCount > 0 && !isAtTop && (
        <div className="fixed left-1/2 top-20 z-40 -translate-x-1/2">
          <Button
            size="sm"
            className="gap-1.5 rounded-full shadow-lg"
            onClick={scrollToTop}
          >
            <ArrowDown className="h-3.5 w-3.5 rotate-180" aria-hidden="true" />
            {newItemsCount} {newItemsCount === 1 ? "neuer Beitrag" : "neue Beiträge"}
          </Button>
        </div>
      )}

      {/* Content grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <ContentCard
            key={item.id}
            item={item}
            currentUserId={userId}
            isOrganizer={isOrganizer}
            onTap={openLightbox}
            onDelete={setDeleteTarget}
          />
        ))}
      </div>

      {/* Infinite scroll trigger */}
      <div ref={loadMoreRef} className="h-px" />

      {/* Loading more indicator */}
      {loadingMore && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ContentCardSkeleton />
          <ContentCardSkeleton />
        </div>
      )}

      {/* End of list */}
      {!hasMore && items.length > 0 && (
        <p className="py-4 text-center text-xs text-muted-foreground">
          Alle Beiträge geladen
        </p>
      )}

      {/* Lightbox */}
      <ContentLightbox
        items={items}
        currentIndex={lightboxIndex}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        onIndexChange={setLightboxIndex}
      />

      {/* Delete confirm dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Beitrag löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Beitrag unwiderruflich löschen? Diese Aktion kann nicht
              rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Check if a content item matches the current filter */
function matchesFilter(item: ContentItem, filter: FilterValue): boolean {
  if (filter === "all") return true;
  if (filter === "photos") return item.type === "photo";
  if (filter === "videos") return item.type === "video";
  if (filter === "texts") return item.type === "text";
  if (filter === "voice") return item.type === "audio";
  if (filter.startsWith("agenda:")) {
    return item.agenda_item_id === filter.slice(7);
  }
  return true;
}
