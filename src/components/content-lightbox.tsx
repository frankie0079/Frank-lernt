"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { X, ChevronLeft, ChevronRight, Mic } from "lucide-react";
import type { ContentItem } from "@/components/content-card";
import { useCallback, useEffect, useRef, useState } from "react";

interface ContentLightboxProps {
  items: ContentItem[];
  currentIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onIndexChange: (index: number) => void;
}

export function ContentLightbox({
  items,
  currentIndex,
  open,
  onOpenChange,
  onIndexChange,
}: ContentLightboxProps) {
  const item = items[currentIndex];
  const touchStartX = useRef<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < items.length - 1;

  const goNext = useCallback(() => {
    if (hasNext) onIndexChange(currentIndex + 1);
  }, [hasNext, currentIndex, onIndexChange]);

  const goPrev = useCallback(() => {
    if (hasPrev) onIndexChange(currentIndex - 1);
  }, [hasPrev, currentIndex, onIndexChange]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, goNext, goPrev]);

  if (!item) return null;

  const relativeTime = formatDistanceToNow(new Date(item.created_at), {
    addSuffix: true,
    locale: de,
  });

  // Only enable swipe on photo and text content (not video/audio where it
  // interferes with controls and vertical scrolling — BUG-5 fix)
  const swipeEnabled = item.type === "photo" || item.type === "text";

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!swipeEnabled) return;
    touchStartX.current = e.clientX;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!swipeEnabled || touchStartX.current === null) return;
    const diff = e.clientX - touchStartX.current;
    setSwipeOffset(diff);
  };

  const handlePointerUp = () => {
    if (!swipeEnabled || touchStartX.current === null) return;
    if (swipeOffset < -60) goNext();
    else if (swipeOffset > 60) goPrev();
    touchStartX.current = null;
    setSwipeOffset(0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[100vw] h-[100dvh] w-screen p-0 border-none bg-black/95 sm:rounded-none [&>button]:hidden"
        aria-label="Vollbild-Ansicht"
      >
        <DialogTitle className="sr-only">
          Beitrag von {item.author_name || "Unbekannt"}
        </DialogTitle>

        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-3 top-3 z-50 h-9 w-9 rounded-full bg-black/40 text-white hover:bg-black/60"
          onClick={() => onOpenChange(false)}
          aria-label="Schliessen"
        >
          <X className="h-5 w-5" />
        </Button>

        {/* Navigation buttons */}
        {hasPrev && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-2 top-1/2 z-50 hidden h-10 w-10 -translate-y-1/2 rounded-full bg-black/40 text-white hover:bg-black/60 sm:flex"
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            aria-label="Vorheriger Beitrag"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
        )}
        {hasNext && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 z-50 hidden h-10 w-10 -translate-y-1/2 rounded-full bg-black/40 text-white hover:bg-black/60 sm:flex"
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            aria-label="Naechster Beitrag"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        )}

        {/* Content area */}
        <div className="flex h-full flex-col">
          {/* Media */}
          <div
            className="relative flex flex-1 items-center justify-center overflow-hidden touch-pan-y"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            {item.type === "photo" && item.media_url && (
              <img
                src={item.media_url}
                alt={item.caption || "Foto"}
                className="max-h-full max-w-full object-contain"
                draggable={false}
              />
            )}

            {item.type === "video" && item.media_url && (
              <video
                src={item.media_url}
                controls
                playsInline
                className="max-h-full max-w-full"
                aria-label={item.caption || "Video"}
              />
            )}

            {item.type === "audio" && item.media_url && (
              <div className="flex flex-col items-center gap-6 px-8">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-purple-500/20">
                  <Mic className="h-12 w-12 text-purple-300" aria-hidden="true" />
                </div>
                <audio
                  src={item.media_url}
                  controls
                  className="w-full max-w-sm"
                  aria-label={item.caption || "Sprachmemo"}
                />
              </div>
            )}

            {item.type === "text" && (
              <div className="max-h-full overflow-y-auto px-6 py-8 sm:px-12">
                <p className="text-lg leading-relaxed text-white whitespace-pre-wrap">
                  {item.caption}
                </p>
              </div>
            )}
          </div>

          {/* Bottom info bar */}
          <div className="shrink-0 border-t border-white/10 bg-black/80 px-4 py-3">
            <div className="mx-auto flex max-w-2xl items-center gap-3">
              <Avatar className="h-8 w-8 shrink-0">
                {item.author_avatar_url && (
                  <AvatarImage
                    src={item.author_avatar_url}
                    alt={item.author_name || "Avatar"}
                  />
                )}
                <AvatarFallback className="text-xs">
                  {item.author_name?.charAt(0).toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-white">
                    {item.author_name || "Unbekannt"}
                  </span>
                  <span className="shrink-0 text-xs text-white/60">
                    {relativeTime}
                  </span>
                </div>
                {item.caption && item.type !== "text" && (
                  <p className="mt-0.5 truncate text-xs text-white/70">
                    {item.caption}
                  </p>
                )}
              </div>
              <Badge variant="secondary" className="shrink-0 text-[10px]">
                {currentIndex + 1} / {items.length}
              </Badge>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
