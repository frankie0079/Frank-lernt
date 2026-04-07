"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  GripVertical,
  X,
  Camera,
  Video,
  Type,
  Mic,
  ImageOff,
} from "lucide-react";

export interface SelectedTileItem {
  id: string; // report_items.id (may be absent for newly added)
  content_item_id: string;
  sort_order: number;
  deleted: boolean;
  type: "photo" | "video" | "text" | "audio" | null;
  media_url: string | null;
  thumbnail_url: string | null;
  caption: string | null;
  author_name: string | null;
  author_avatar_url: string | null;
}

interface SortableTileProps {
  item: SelectedTileItem;
  index: number;
  onRemove: (contentItemId: string) => void;
}

const typeIcon = {
  photo: Camera,
  video: Video,
  text: Type,
  audio: Mic,
};

export function SortableTile({ item, index, onRemove }: SortableTileProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.content_item_id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    touchAction: "manipulation",
  };

  const Icon = item.type ? typeIcon[item.type] : ImageOff;
  const thumb = item.thumbnail_url || item.media_url;
  const showThumb =
    !item.deleted && (item.type === "photo" || item.type === "video") && thumb;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative shrink-0 snap-start"
    >
      <div
        className={`relative h-[90px] w-[90px] overflow-hidden rounded-lg border ${
          item.deleted
            ? "border-dashed border-muted-foreground/40 bg-muted"
            : "border-border bg-muted"
        }`}
      >
        {/* Thumbnail / placeholder */}
        {showThumb ? (
          <img
            src={thumb!}
            alt={item.caption || "Beitrag"}
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-1 text-center">
            <Icon
              className="h-6 w-6 text-muted-foreground"
              aria-hidden="true"
            />
            {item.deleted ? (
              <span className="text-[9px] leading-tight text-muted-foreground">
                nicht verfügbar
              </span>
            ) : item.type === "text" && item.caption ? (
              <span className="line-clamp-2 text-[9px] leading-tight text-muted-foreground">
                {item.caption}
              </span>
            ) : null}
          </div>
        )}

        {/* Order badge */}
        <Badge
          variant="default"
          className="absolute left-1 top-1 h-5 min-w-5 px-1 text-[10px]"
        >
          {index + 1}
        </Badge>

        {/* Remove button */}
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="absolute right-1 top-1 h-6 w-6 rounded-full bg-black/60 text-white hover:bg-black/80"
          onClick={() => onRemove(item.content_item_id)}
          aria-label="Aus Auswahl entfernen"
        >
          <X className="h-3 w-3" />
        </Button>

        {/* Drag handle — ONLY this gets listeners */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="absolute bottom-0 right-0 flex h-11 w-11 items-center justify-center rounded-tl-lg bg-black/50 text-white touch-none"
          aria-label="Zum Sortieren ziehen"
          style={{ touchAction: "none" }}
        >
          <GripVertical className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
