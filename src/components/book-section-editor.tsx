"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ImagePlus,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { BookLayoutPicker } from "@/components/book-layout-picker";
import { BookCommentTextarea } from "@/components/book-comment-textarea";
import { SelectableContentGrid } from "@/components/selectable-content-grid";
import { SelectedItemsRail } from "@/components/selected-items-rail";
import type { ContentItem } from "@/components/content-card";
import type { SelectedTileItem } from "@/components/sortable-tile";
import type { AgendaItem } from "@/lib/event-utils";
import {
  BOOK_LAYOUT_CAPACITY,
  MAX_PHOTOS_PER_PAGE,
  type BookLayout,
  type BookPageItem,
  type BookSection,
} from "@/lib/book-types";

/**
 * Draft shape of a section used by the editor. `id` may be empty for newly
 * added sections that have not yet been persisted. All fields are mirror-
 * writable so the parent can drive the state.
 */
export interface SectionDraft {
  id: string;
  layout: BookLayout;
  comment: string;
  sort_order: number;
  item_ids: string[];
  itemsById: Map<string, SelectedTileItem>;
}

export function sectionToDraft(sec: BookSection): SectionDraft {
  const sorted = [...sec.items].sort((a, b) => a.sort_order - b.sort_order);
  const item_ids = sorted.map((i) => i.content_item_id);
  const itemsById = new Map<string, SelectedTileItem>();
  for (const i of sorted) {
    if (!i.content_item_id) continue;
    itemsById.set(i.content_item_id, {
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
  return {
    id: sec.id,
    layout: sec.layout,
    comment: sec.comment,
    sort_order: sec.sort_order,
    item_ids,
    itemsById,
  };
}

export function emptyDraft(sortOrder: number): SectionDraft {
  return {
    id: "",
    layout: "single",
    comment: "",
    sort_order: sortOrder,
    item_ids: [],
    itemsById: new Map(),
  };
}

function tileToItem(item: ContentItem): SelectedTileItem {
  return {
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
  };
}

interface BookSectionEditorProps {
  eventId: string;
  userId: string;
  isOrganizer: boolean;
  agendaItems: AgendaItem[];
  dayAgendaItemId: string;
  index: number;
  section: SectionDraft;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onChange: (next: SectionDraft) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}

export function BookSectionEditor({
  eventId,
  userId,
  isOrganizer,
  agendaItems,
  dayAgendaItemId,
  index,
  section,
  canMoveUp,
  canMoveDown,
  onChange,
  onMoveUp,
  onMoveDown,
  onDelete,
}: BookSectionEditorProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const selectedSet = useMemo(
    () => new Set(section.item_ids),
    [section.item_ids]
  );

  const capacity = BOOK_LAYOUT_CAPACITY[section.layout] ?? MAX_PHOTOS_PER_PAGE;
  const overCapacity = section.item_ids.length > capacity;

  const handleToggle = useCallback(
    (item: ContentItem) => {
      if (section.item_ids.includes(item.id)) {
        const nextIds = section.item_ids.filter((id) => id !== item.id);
        const nextMap = new Map(section.itemsById);
        nextMap.delete(item.id);
        onChange({ ...section, item_ids: nextIds, itemsById: nextMap });
      } else {
        const nextIds = [...section.item_ids, item.id];
        const nextMap = new Map(section.itemsById);
        nextMap.set(item.id, tileToItem(item));
        onChange({ ...section, item_ids: nextIds, itemsById: nextMap });
      }
    },
    [section, onChange]
  );

  const handleReorder = useCallback(
    (newOrder: string[]) => {
      onChange({ ...section, item_ids: newOrder });
    },
    [section, onChange]
  );

  const handleRemove = useCallback(
    (contentItemId: string) => {
      const nextIds = section.item_ids.filter((id) => id !== contentItemId);
      const nextMap = new Map(section.itemsById);
      nextMap.delete(contentItemId);
      onChange({ ...section, item_ids: nextIds, itemsById: nextMap });
    },
    [section, onChange]
  );

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-sm">
      {/* Header with section number + actions */}
      <div className="flex items-center justify-between gap-2">
        <Label className="font-[family-name:var(--font-caveat)] text-xl font-bold text-foreground">
          Seite {index + 1}
        </Label>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onMoveUp}
            disabled={!canMoveUp || !isOrganizer}
            aria-label="Seite nach oben"
          >
            <ArrowUp className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onMoveDown}
            disabled={!canMoveDown || !isOrganizer}
            aria-label="Seite nach unten"
          >
            <ArrowDown className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={onDelete}
            disabled={!isOrganizer}
            aria-label="Seite löschen"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Layout picker */}
      <BookLayoutPicker
        value={section.layout}
        onChange={(l) => onChange({ ...section, layout: l })}
        disabled={!isOrganizer}
      />

      {/* Over-capacity warning (fixed layouts take only first N, grid-3 is flowing) */}
      {overCapacity && section.layout !== "grid-3" && (
        <Alert>
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>
            Dieses Layout zeigt nur die ersten {capacity}{" "}
            {capacity === 1 ? "Beitrag" : "Beiträge"} — die weiteren werden als
            Galerie unter dem Haupt-Layout angezeigt.
          </AlertDescription>
        </Alert>
      )}

      {/* Photo picker trigger + selection rail */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm font-medium text-foreground">
            Fotos
            {section.item_ids.length > 0 && (
              <span className="ml-1 text-xs text-muted-foreground">
                ({section.item_ids.length})
              </span>
            )}
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPickerOpen(true)}
            disabled={!isOrganizer}
          >
            <ImagePlus className="mr-1 h-4 w-4" aria-hidden="true" />
            Fotos wählen
          </Button>
        </div>
        {section.item_ids.length > 0 ? (
          <SelectedItemsRail
            selectedIds={section.item_ids}
            itemsById={section.itemsById}
            onReorder={handleReorder}
            onRemove={handleRemove}
          />
        ) : (
          <p className="text-xs text-muted-foreground">
            Noch keine Fotos auf dieser Seite. Tippe{" "}
            &bdquo;Fotos wählen&ldquo; um welche aus dem Tag hinzuzufügen.
          </p>
        )}
      </div>

      {/* Comment textarea */}
      <BookCommentTextarea
        value={section.comment}
        onChange={(c) => onChange({ ...section, comment: c })}
        disabled={!isOrganizer}
      />

      {/* Photo picker sheet */}
      <Sheet open={pickerOpen} onOpenChange={setPickerOpen}>
        <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
          <SheetHeader className="space-y-1">
            <SheetTitle className="font-[family-name:var(--font-caveat)] text-2xl font-bold">
              Fotos wählen · Seite {index + 1}
            </SheetTitle>
            <SheetDescription>
              Tippe auf einen Beitrag, um ihn zum Seite hinzuzufügen oder
              wieder zu entfernen. Auswahl wird automatisch gespeichert.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            <SelectableContentGrid
              eventId={eventId}
              userId={userId}
              isOrganizer={isOrganizer}
              agendaItems={agendaItems}
              selectedIds={selectedSet}
              onToggle={handleToggle}
              defaultAgendaItemId={dayAgendaItemId}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function draftToSectionPayload(drafts: SectionDraft[]) {
  return drafts.map((d, idx) => ({
    layout: d.layout,
    comment: d.comment,
    sort_order: idx,
    items: d.item_ids.map((id, i) => ({
      content_item_id: id,
      sort_order: (i + 1) * 10,
    })),
  }));
}
