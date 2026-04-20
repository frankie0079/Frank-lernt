"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AlertCircle, AlertTriangle, Check, Eye, Loader2 } from "lucide-react";
import type { AgendaItem } from "@/lib/event-utils";
import type { ContentItem } from "@/components/content-card";
import type { SelectedTileItem } from "@/components/sortable-tile";
import { BookLayoutPicker } from "@/components/book-layout-picker";
import { BookCommentTextarea } from "@/components/book-comment-textarea";
import { SelectableContentGrid } from "@/components/selectable-content-grid";
import { SelectedItemsRail } from "@/components/selected-items-rail";
import {
  MAX_COMMENT_LENGTH,
  MAX_PHOTOS_PER_PAGE,
  type BookLayout,
  type BookPage,
  type BookPageItem,
  type BookPutResponse,
} from "@/lib/book-types";

type SaveState = "idle" | "saving" | "saved" | "error";

interface BookPageEditorProps {
  eventId: string;
  userId: string;
  isOrganizer: boolean;
  agendaItems: AgendaItem[];
  page: BookPage;
  /** Fires after a successful save so the parent can refresh its summary */
  onSaved: (updated: BookPage) => void;
  /** Opens `/events/[id]/book?preview=true` in a new tab */
  onOpenPreview: () => void;
}

function itemsToSelectedIds(items: BookPageItem[]): string[] {
  return items
    .filter((i) => i.content_item_id)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((i) => i.content_item_id);
}

function itemsToMap(items: BookPageItem[]): Map<string, SelectedTileItem> {
  const map = new Map<string, SelectedTileItem>();
  for (const i of items) {
    if (!i.content_item_id) continue;
    map.set(i.content_item_id, {
      id: i.id,
      content_item_id: i.content_item_id,
      sort_order: i.sort_order,
      deleted: i.type == null,
      type: i.type,
      media_url: i.media_url,
      thumbnail_url: i.thumbnail_url,
      caption: i.caption,
      author_name: i.author_name,
      author_avatar_url: i.author_avatar_url,
    });
  }
  return map;
}

export function BookPageEditor({
  eventId,
  userId,
  isOrganizer,
  agendaItems,
  page,
  onSaved,
  onOpenPreview,
}: BookPageEditorProps) {
  // ---- local editable state ----
  const [layout, setLayout] = useState<BookLayout>(page.layout);
  const [comment, setComment] = useState<string>(page.comment ?? "");
  const [isVisible, setIsVisible] = useState<boolean>(page.is_visible);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    itemsToSelectedIds(page.items)
  );
  const [itemsById, setItemsById] = useState<Map<string, SelectedTileItem>>(
    itemsToMap(page.items)
  );

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Re-seed local state whenever the selected page changes (sidebar switch).
  const pageIdRef = useRef(page.agenda_item_id);
  useEffect(() => {
    if (pageIdRef.current !== page.agenda_item_id) {
      pageIdRef.current = page.agenda_item_id;
      setLayout(page.layout);
      setComment(page.comment ?? "");
      setIsVisible(page.is_visible);
      setSelectedIds(itemsToSelectedIds(page.items));
      setItemsById(itemsToMap(page.items));
      setSaveState("idle");
      setErrorMsg(null);
    }
  }, [page]);

  // ---- derived flags ----
  const commentTooLong = comment.length > MAX_COMMENT_LENGTH;
  const tooManyItems = selectedIds.length > MAX_PHOTOS_PER_PAGE;

  // ---- Save implementation ----
  const performSave = useCallback(
    async (payload: {
      layout: BookLayout;
      comment: string;
      is_visible: boolean;
      item_ids: string[];
    }) => {
      if (!isOrganizer) return;
      if (payload.comment.length > MAX_COMMENT_LENGTH) return; // client-side guard

      setSaveState("saving");
      setErrorMsg(null);

      try {
        const res = await fetch(
          `/api/events/${eventId}/book/${page.agenda_item_id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              layout: payload.layout,
              comment: payload.comment,
              is_visible: payload.is_visible,
              items: payload.item_ids.map((id, i) => ({
                content_item_id: id,
                sort_order: (i + 1) * 10,
              })),
            }),
          }
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Speichern fehlgeschlagen");
        }
        const data = (await res.json()) as BookPutResponse;
        setSaveState("saved");
        onSaved(data.page);
      } catch (err) {
        setSaveState("error");
        setErrorMsg(
          err instanceof Error ? err.message : "Speichern fehlgeschlagen"
        );
      }
    },
    [eventId, page.agenda_item_id, isOrganizer, onSaved]
  );

  const debouncedSave = useDebouncedCallback(
    (args: {
      layout: BookLayout;
      comment: string;
      is_visible: boolean;
      item_ids: string[];
    }) => performSave(args),
    2000
  );

  // Skip auto-save on initial render after the page loads.
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    if (commentTooLong) return; // auto-save suspended until valid
    debouncedSave({
      layout,
      comment,
      is_visible: isVisible,
      item_ids: selectedIds,
    });
  }, [layout, comment, isVisible, selectedIds, commentTooLong, debouncedSave]);

  const manualSave = useCallback(async () => {
    debouncedSave.cancel();
    await performSave({
      layout,
      comment,
      is_visible: isVisible,
      item_ids: selectedIds,
    });
  }, [debouncedSave, performSave, layout, comment, isVisible, selectedIds]);

  // ---- selection handlers (mirroring report-editor semantics) ----
  const handleToggle = useCallback((item: ContentItem) => {
    setSelectedIds((prev) => {
      if (prev.includes(item.id)) return prev.filter((id) => id !== item.id);
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
  }, []);

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

  // ---- collaborator hint ----
  const collaboratorHint = page.updated_by_name
    ? `Zuletzt gespeichert von ${page.updated_by_name}${
        page.updated_at
          ? ` am ${new Date(page.updated_at).toLocaleString("de-DE", {
              dateStyle: "short",
              timeStyle: "short",
            })}`
          : ""
      }`
    : null;

  const noItems = selectedIds.length === 0;

  return (
    <div className="space-y-5">
      {/* Top status bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
        <SaveBadge state={saveState} tooLong={commentTooLong} />
        <div className="flex items-center gap-2">
          {saveState === "error" && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={manualSave}
            >
              Jetzt speichern
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              // Try to flush unsaved changes before popping the preview tab.
              debouncedSave.flush();
              onOpenPreview();
            }}
            aria-label="Vorschau im neuen Tab öffnen"
          >
            <Eye className="mr-1 h-4 w-4" aria-hidden="true" />
            Vorschau
          </Button>
        </div>
      </div>

      {errorMsg && saveState === "error" && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {collaboratorHint && (
        <p className="text-xs text-muted-foreground">{collaboratorHint}</p>
      )}

      {/* Empty-content hint */}
      {noItems && (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          Keine Beiträge für diesen Tag ausgewählt.
          {!isVisible && (
            <span className="ml-1">Seite ist aktuell ausgeblendet.</span>
          )}
        </div>
      )}

      {/* Too-many warning */}
      {tooManyItems && (
        <Alert>
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>
            Du hast {selectedIds.length} Beiträge ausgewählt. In der
            Leseansicht werden nur die ersten {MAX_PHOTOS_PER_PAGE} angezeigt.
          </AlertDescription>
        </Alert>
      )}

      {/* Selected rail */}
      <div className="space-y-2">
        <Label className="font-[family-name:var(--font-caveat)] text-2xl font-bold text-foreground">
          Auswahl
          {selectedIds.length > 0 && (
            <Badge variant="secondary" className="ml-2 align-middle text-xs">
              {selectedIds.length}
            </Badge>
          )}
        </Label>
        {selectedIds.length > 0 ? (
          <SelectedItemsRail
            selectedIds={selectedIds}
            itemsById={itemsById}
            onReorder={handleReorder}
            onRemove={handleRemove}
          />
        ) : (
          <p className="text-xs text-muted-foreground">
            Tippe auf einen Beitrag unten, um ihn auf diese Seite zu holen.
          </p>
        )}
      </div>

      {/* Layout + settings */}
      <BookLayoutPicker
        value={layout}
        onChange={setLayout}
        disabled={!isOrganizer}
      />

      <BookCommentTextarea
        value={comment}
        onChange={setComment}
        disabled={!isOrganizer}
      />

      <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
        <div className="min-w-0">
          <Label
            htmlFor="book-page-visible"
            className="cursor-pointer text-sm font-medium text-foreground"
          >
            Seite sichtbar
          </Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Ausgeblendete Seiten erscheinen nicht in der Leseansicht.
          </p>
        </div>
        <Switch
          id="book-page-visible"
          checked={isVisible}
          onCheckedChange={setIsVisible}
          disabled={!isOrganizer}
          aria-label="Seite in Leseansicht anzeigen"
        />
      </div>

      {/* Content selector */}
      <div className="space-y-2">
        <Label className="font-[family-name:var(--font-caveat)] text-2xl font-bold text-foreground">
          Beiträge an diesem Tag
        </Label>
        <SelectableContentGrid
          eventId={eventId}
          userId={userId}
          isOrganizer={isOrganizer}
          agendaItems={agendaItems}
          selectedIds={selectedSet}
          onToggle={handleToggle}
          defaultAgendaItemId={page.agenda_item_id}
        />
      </div>
    </div>
  );
}

function SaveBadge({
  state,
  tooLong,
}: {
  state: SaveState;
  tooLong: boolean;
}) {
  if (tooLong) {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-destructive">
        <AlertCircle className="h-3 w-3" aria-hidden="true" />
        Auto-Save pausiert — Kommentar zu lang
      </span>
    );
  }
  if (state === "saving") {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        Speichere…
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="flex items-center gap-1 text-xs text-green-600">
        <Check className="h-3 w-3" aria-hidden="true" />
        Gespeichert
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="flex items-center gap-1 text-xs text-destructive">
        <AlertCircle className="h-3 w-3" aria-hidden="true" />
        Nicht gespeichert
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground">Bereit</span>;
}

