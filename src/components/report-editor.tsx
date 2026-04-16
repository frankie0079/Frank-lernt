"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";
import { CurationToolbar, type SaveState } from "@/components/curation-toolbar";
import { SelectedItemsRail } from "@/components/selected-items-rail";
import { SelectableContentGrid } from "@/components/selectable-content-grid";
import { ReportPreviewSheet } from "@/components/report-preview-sheet";
import { SlideshowGeneratorPanel } from "@/components/slideshow-generator-panel";
import { OfflineBanner } from "@/components/offline-banner";
import { useOnlineStatus } from "@/hooks/use-online-status";
import type { SelectedTileItem } from "@/components/sortable-tile";
import type { ContentItem } from "@/components/content-card";
import type { AgendaItem } from "@/lib/event-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface ReportShape {
  id: string;
  event_id: string;
  agenda_item_id: string;
  status: "draft" | "published";
  published_at: string | null;
  updated_at: string;
  created_by: string;
}

interface ReportItemShape {
  id: string;
  content_item_id: string;
  sort_order: number;
  deleted: boolean;
  type: "photo" | "video" | "text" | "audio" | null;
  media_url: string | null;
  thumbnail_url: string | null;
  caption: string | null;
  content_created_at: string | null;
  author_id: string | null;
  author_name: string | null;
  author_avatar_url: string | null;
}

// --- localStorage draft helpers (BUG-1) ---
interface DraftPayload {
  selectedIds: string[];
  itemsById: [string, SelectedTileItem][];
  savedAt: string;
  eventId: string;
  status: "draft" | "published" | "empty";
}

function draftStorageKey(agendaItemId: string) {
  return `proj33-report-draft-${agendaItemId}`;
}

function loadDraftFromStorage(agendaItemId: string): DraftPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(draftStorageKey(agendaItemId));
    if (!raw) return null;
    return JSON.parse(raw) as DraftPayload;
  } catch {
    return null;
  }
}

function saveDraftToStorage(agendaItemId: string, payload: DraftPayload) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      draftStorageKey(agendaItemId),
      JSON.stringify(payload)
    );
  } catch {
    /* quota / unavailable — ignore */
  }
}

function clearDraftFromStorage(agendaItemId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(draftStorageKey(agendaItemId));
  } catch {
    /* ignore */
  }
}

interface ReportEditorProps {
  eventId: string;
  agendaItemId: string;
  userId: string;
  isOrganizer: boolean;
  agendaItems: AgendaItem[];
  agendaTitle?: string;
}

export function ReportEditor({
  eventId,
  agendaItemId,
  userId,
  isOrganizer,
  agendaItems,
  agendaTitle,
}: ReportEditorProps) {
  const router = useRouter();
  const isOnline = useOnlineStatus();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [itemsById, setItemsById] = useState<Map<string, SelectedTileItem>>(
    new Map()
  );
  const [status, setStatus] = useState<"draft" | "published" | "empty">(
    "empty"
  );
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [previewOpen, setPreviewOpen] = useState(false);

  // Track the "last known" status to detect demotion on save
  const prevStatusRef = useRef<"draft" | "published" | "empty">("empty");

  const totalCountRef = useRef(0);
  const [totalCount, setTotalCount] = useState(0);

  // Always-fresh view of itemsById for async callbacks (e.g. offline save).
  const itemsByIdRef = useRef<Map<string, SelectedTileItem>>(new Map());
  useEffect(() => {
    itemsByIdRef.current = itemsById;
  }, [itemsById]);

  // --- Initial load ---
  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/events/${eventId}/reports/${agendaItemId}`
      );
      if (res.status === 403) {
        toast.error("Kein Zugriff auf diesen Bericht");
        router.push(`/events/${eventId}`);
        return;
      }
      if (res.status === 404) {
        setLoadError("Bericht nicht gefunden.");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Bericht konnte nicht geladen werden.");
      }
      const data = (await res.json()) as {
        report: ReportShape;
        items: ReportItemShape[];
      };

      // Deleted items have content_item_id = null (BUG-3 fix). Use the
      // report_items.id as a synthetic key so dnd-kit / React keys stay
      // unique and the tile can still render as "nicht verfügbar".
      const keyOf = (it: ReportItemShape) =>
        it.content_item_id ?? `__del__${it.id}`;
      // Reconnect-on-mount: if a localStorage draft exists from an offline
      // session, push it to the server BEFORE rendering server state — the
      // user's offline edits would otherwise be silently dropped.
      const pendingDraft = loadDraftFromStorage(agendaItemId);
      if (pendingDraft && pendingDraft.eventId === eventId) {
        const persistable = pendingDraft.selectedIds.filter(
          (id) => !id.startsWith("__del__")
        );
        const syncRes = await fetch(
          `/api/events/${eventId}/reports/${agendaItemId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              items: persistable.map((id, i) => ({
                content_item_id: id,
                sort_order: (i + 1) * 10,
              })),
            }),
          }
        );
        if (syncRes.ok) {
          toast.success("Offline-Änderungen synchronisiert");
          clearDraftFromStorage(agendaItemId);
          // Re-fetch the freshly-synced report so client state matches server
          const r2 = await fetch(
            `/api/events/${eventId}/reports/${agendaItemId}`
          );
          if (r2.ok) {
            const d2 = (await r2.json()) as {
              report: ReportShape;
              items: ReportItemShape[];
            };
            data.report = d2.report;
            data.items = d2.items;
          }
        } else {
          const errBody = await syncRes.json().catch(() => ({}));
          if (/content_not_in_event/i.test(errBody.error || "")) {
            toast.error(
              "Einige Offline-Änderungen konnten nicht synchronisiert werden"
            );
          }
          clearDraftFromStorage(agendaItemId);
        }
      }

      // Recompute keys/ids from (possibly refreshed) data
      const finalSorted = [...data.items].sort(
        (a, b) => a.sort_order - b.sort_order
      );
      const finalIds = finalSorted.map(keyOf);
      const finalMap = new Map<string, SelectedTileItem>();
      for (const it of finalSorted) {
        const key = keyOf(it);
        finalMap.set(key, {
          id: it.id,
          content_item_id: key,
          sort_order: it.sort_order,
          deleted: it.deleted,
          type: it.type,
          media_url: it.media_url,
          thumbnail_url: it.thumbnail_url,
          caption: it.caption,
          author_name: it.author_name,
          author_avatar_url: it.author_avatar_url,
        });
      }
      setSelectedIds(finalIds);
      setItemsById(finalMap);
      const nextStatus: "draft" | "published" | "empty" =
        data.report?.status ?? "draft";
      setStatus(nextStatus);
      prevStatusRef.current = nextStatus;
      setLoadError(null);
      // Server is source of truth — clear any stale localStorage draft.
      clearDraftFromStorage(agendaItemId);
    } catch (err) {
      // Offline fallback: use localStorage draft if present.
      const draft = loadDraftFromStorage(agendaItemId);
      if (
        draft &&
        draft.eventId === eventId &&
        typeof navigator !== "undefined" &&
        !navigator.onLine
      ) {
        setSelectedIds(draft.selectedIds);
        setItemsById(new Map(draft.itemsById));
        setStatus(draft.status);
        prevStatusRef.current =
          draft.status === "empty" ? "empty" : draft.status;
        setSaveState("offline-pending");
        setLoadError(null);
      } else {
        setLoadError(
          err instanceof Error ? err.message : "Ein Fehler ist aufgetreten."
        );
      }
    } finally {
      setLoading(false);
    }
  }, [eventId, agendaItemId, router]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  // Fetch total count for "X von Y ausgewählt" counter (BUG-2)
  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/events/${eventId}/content?limit=1`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (aborted) return;
        const n =
          typeof data.total_count === "number"
            ? data.total_count
            : (data.content_items || []).length;
        totalCountRef.current = n;
        setTotalCount(n);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      aborted = true;
    };
  }, [eventId]);

  // --- Auto-save ---
  const performSave = useCallback(
    async (ids: string[]) => {
      if (!isOnline) {
        // Persist to localStorage and surface an offline-pending state.
        const itemEntries: [string, SelectedTileItem][] = [];
        const cur = itemsByIdRef.current;
        for (const id of ids) {
          const v = cur.get(id);
          if (v) itemEntries.push([id, v]);
        }
        saveDraftToStorage(agendaItemId, {
          selectedIds: ids,
          itemsById: itemEntries,
          savedAt: new Date().toISOString(),
          eventId,
          status: status === "empty" ? "draft" : status,
        });
        setSaveState("offline-pending");
        return;
      }
      setSaveState("saving");
      try {
        // Filter out synthetic keys for deleted items — they exist only on
        // the client to keep dnd-kit happy. The server preserves null-marker
        // rows automatically (save_report_items v2).
        const persistable = ids.filter((id) => !id.startsWith("__del__"));
        const body = {
          items: persistable.map((id, i) => ({
            content_item_id: id,
            sort_order: (i + 1) * 10,
          })),
        };
        const res = await fetch(
          `/api/events/${eventId}/reports/${agendaItemId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          const errMsg: string = data.error || "Speichern fehlgeschlagen";
          if (/content_not_in_event/i.test(errMsg)) {
            toast.error(
              "Einige Offline-Änderungen konnten nicht synchronisiert werden"
            );
            clearDraftFromStorage(agendaItemId);
            await loadReport();
            return;
          }
          throw new Error(errMsg);
        }
        const data = (await res.json()) as {
          report: ReportShape;
          item_count: number;
        };
        const nextStatus = (data.report?.status ?? "draft") as
          | "draft"
          | "published";
        if (
          prevStatusRef.current === "published" &&
          nextStatus === "draft"
        ) {
          toast.warning(
            "Bericht wird von Landing Page entfernt bis du erneut veröffentlichst"
          );
        }
        setStatus(nextStatus);
        prevStatusRef.current = nextStatus;
        setSaveState("saved");
        clearDraftFromStorage(agendaItemId);
      } catch (err) {
        setSaveState("error");
        toast.error(
          err instanceof Error ? err.message : "Speichern fehlgeschlagen"
        );
      }
    },
    [eventId, agendaItemId, isOnline, status, loadReport]
  );

  const debouncedSave = useDebouncedCallback(
    (ids: string[]) => performSave(ids),
    2000
  );

  // Skip auto-save on the very first render after load
  const loadedOnceRef = useRef(false);
  useEffect(() => {
    if (loading) return;
    if (!loadedOnceRef.current) {
      loadedOnceRef.current = true;
      return;
    }
    debouncedSave(selectedIds);
  }, [selectedIds, loading, isOnline, debouncedSave]);

  // BUG-1: Reconnect sync — when transitioning offline → online, flush pending draft.
  const wasOfflineRef = useRef(false);
  useEffect(() => {
    if (!isOnline) {
      wasOfflineRef.current = true;
      return;
    }
    if (!wasOfflineRef.current) return;
    wasOfflineRef.current = false;
    const draft = loadDraftFromStorage(agendaItemId);
    if (!draft || draft.eventId !== eventId) return;
    (async () => {
      try {
        await performSave(draft.selectedIds);
        // performSave clears localStorage on success; surface toast if still cleared.
        if (!loadDraftFromStorage(agendaItemId)) {
          toast.success("Offline-Änderungen synchronisiert");
        }
      } catch {
        /* performSave already surfaces the error */
      }
    })();
  }, [isOnline, agendaItemId, eventId, performSave]);

  // --- Selection handlers ---
  const handleToggle = useCallback(
    (item: ContentItem) => {
      setSelectedIds((prev) => {
        if (prev.includes(item.id)) {
          return prev.filter((id) => id !== item.id);
        }
        return [...prev, item.id];
      });
      setItemsById((prev) => {
        if (prev.has(item.id)) {
          const next = new Map(prev);
          next.delete(item.id);
          return next;
        }
        const next = new Map(prev);
        next.set(item.id, {
          id: "",
          content_item_id: item.id,
          sort_order: 0,
          deleted: false,
          type: item.type,
          media_url: item.media_url,
          thumbnail_url: item.thumbnail_url,
          caption: item.caption,
          author_name: item.author_name ?? null,
          author_avatar_url: item.author_avatar_url ?? null,
        });
        return next;
      });
    },
    []
  );

  const handleRemove = useCallback((contentItemId: string) => {
    setSelectedIds((prev) => prev.filter((id) => id !== contentItemId));
    setItemsById((prev) => {
      const next = new Map(prev);
      next.delete(contentItemId);
      return next;
    });
  }, []);

  const handleReorder = useCallback((newOrder: string[]) => {
    setSelectedIds(newOrder);
  }, []);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  // --- Publish / unpublish ---
  const handleTogglePublish = useCallback(
    async (publish: boolean) => {
      // Flush pending debounced save first
      await debouncedSave.flush();
      try {
        const res = await fetch(
          `/api/events/${eventId}/reports/${agendaItemId}/publish`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ publish }),
          }
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Aktion fehlgeschlagen");
        }
        const data = (await res.json()) as { report: ReportShape };
        const nextStatus = (data.report?.status ?? "draft") as
          | "draft"
          | "published";
        setStatus(nextStatus);
        prevStatusRef.current = nextStatus;
        toast.success(
          publish ? "Bericht veröffentlicht" : "Bericht zurück auf Entwurf"
        );
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Aktion fehlgeschlagen"
        );
      }
    },
    [debouncedSave, eventId, agendaItemId]
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (loadError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{loadError}</AlertDescription>
      </Alert>
    );
  }

  const effectiveTotal = totalCount;

  return (
    <div className="space-y-4">
      <OfflineBanner visible={!isOnline} />

      <CurationToolbar
        selectedCount={selectedIds.length}
        totalCount={effectiveTotal}
        saveState={saveState}
        status={status}
        onTogglePublish={handleTogglePublish}
        onOpenPreview={() => setPreviewOpen(true)}
        disabled={!isOnline}
      />

      {agendaTitle && (
        <h2 className="text-lg font-semibold text-foreground">{agendaTitle}</h2>
      )}

      <SelectedItemsRail
        selectedIds={selectedIds}
        itemsById={itemsById}
        onReorder={handleReorder}
        onRemove={handleRemove}
      />

      <SelectableContentGrid
        eventId={eventId}
        userId={userId}
        isOrganizer={isOrganizer}
        agendaItems={agendaItems}
        selectedIds={selectedSet}
        onToggle={handleToggle}
        defaultAgendaItemId={agendaItemId}
      />

      <ReportPreviewSheet
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        selectedIds={selectedIds}
        itemsById={itemsById}
      />

      <SlideshowGeneratorPanel
        eventId={eventId}
        agendaItemId={agendaItemId}
        hasItems={selectedIds.filter((id) => !id.startsWith("__del__")).length > 0}
      />
    </div>
  );
}
