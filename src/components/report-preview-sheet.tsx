"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Video, Type, Mic, ImageOff, Play } from "lucide-react";
import type { SelectedTileItem } from "@/components/sortable-tile";

interface ReportPreviewSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  itemsById: Map<string, SelectedTileItem>;
}

const typeLabel = {
  photo: "Foto",
  video: "Video",
  text: "Text",
  audio: "Sprachmemo",
};

export function ReportPreviewSheet({
  open,
  onOpenChange,
  selectedIds,
  itemsById,
}: ReportPreviewSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[90vh] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>Vorschau</SheetTitle>
          <SheetDescription>
            Vorläufige Ansicht — das Landing-Page-Design folgt später.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4 pb-6">
          {selectedIds.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Noch keine Beiträge ausgewählt.
            </p>
          ) : (
            selectedIds.map((id, index) => {
              const item = itemsById.get(id);
              if (!item || item.deleted) {
                return (
                  <PreviewRow key={id} index={index}>
                    <div className="flex h-24 items-center justify-center rounded-md border border-dashed bg-muted text-xs text-muted-foreground">
                      Beitrag nicht verfügbar
                    </div>
                  </PreviewRow>
                );
              }

              const thumb = item.thumbnail_url || item.media_url;
              const authorInitial = item.author_name?.charAt(0).toUpperCase() || "?";

              return (
                <PreviewRow key={id} index={index}>
                  <div className="space-y-2">
                    {(item.type === "photo" || item.type === "video") && thumb ? (
                      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md bg-muted">
                        <img
                          src={thumb}
                          alt={item.caption || ""}
                          className="h-full w-full object-cover"
                        />
                        {item.type === "video" && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60">
                              <Play className="ml-0.5 h-5 w-5 text-white" />
                            </div>
                          </div>
                        )}
                      </div>
                    ) : item.type === "text" ? (
                      <div className="rounded-md bg-amber-50 p-3 text-sm text-foreground">
                        {item.caption || "(leer)"}
                      </div>
                    ) : item.type === "audio" ? (
                      <div className="flex items-center gap-2 rounded-md bg-purple-50 p-3 text-sm">
                        <Mic className="h-4 w-4 text-purple-700" />
                        <span className="italic text-purple-900">
                          {item.caption || "Sprachmemo"}
                        </span>
                      </div>
                    ) : (
                      <div className="flex h-24 items-center justify-center rounded-md bg-muted">
                        <ImageOff className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}

                    {item.caption &&
                      item.type !== "text" &&
                      item.type !== "audio" && (
                        <p className="text-sm text-foreground">
                          {item.caption}
                        </p>
                      )}

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <Avatar className="h-5 w-5">
                          {item.author_avatar_url && (
                            <AvatarImage src={item.author_avatar_url} />
                          )}
                          <AvatarFallback className="text-[9px]">
                            {authorInitial}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate text-xs text-muted-foreground">
                          {item.author_name || "Unbekannt"}
                        </span>
                      </div>
                      {item.type && (
                        <Badge
                          variant="secondary"
                          className="h-5 px-1.5 text-[10px]"
                        >
                          <TypeIcon type={item.type} />
                          {typeLabel[item.type]}
                        </Badge>
                      )}
                    </div>
                  </div>
                </PreviewRow>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PreviewRow({
  index,
  children,
}: {
  index: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function TypeIcon({ type }: { type: "photo" | "video" | "text" | "audio" }) {
  const Icon =
    type === "photo" ? Camera : type === "video" ? Video : type === "text" ? Type : Mic;
  return <Icon className="mr-0.5 h-2.5 w-2.5" aria-hidden="true" />;
}
