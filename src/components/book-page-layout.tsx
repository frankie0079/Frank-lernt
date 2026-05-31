"use client";

import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { ArrowLeft, ImageOff, Map, Mic, Type, Video } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  MAX_PHOTOS_PER_PAGE,
  type BookLayout,
  type BookPageItem,
} from "@/lib/book-types";

interface BookPageLayoutProps {
  layout: BookLayout;
  items: BookPageItem[];
  /** Optional text that renders alongside the media when layout is "text-left" */
  sideText?: string | null;
}

function isMedia(item: BookPageItem): boolean {
  return item.type === "photo" || item.type === "video";
}

function isTourItem(item: BookPageItem): boolean {
  const text = item.caption?.toLowerCase() ?? "";
  return text.includes("tour:") || text.includes("etappe");
}

function tileClass(size: "hero" | "regular" | "small" = "regular") {
  if (size === "hero") return "min-h-[260px] rounded-lg sm:min-h-[360px]";
  if (size === "small") return "min-h-[220px] rounded-md sm:min-h-[240px]";
  return "min-h-[240px] rounded-lg sm:min-h-[260px]";
}

function MediaTile({
  item,
  className,
  onOpen,
}: {
  item: BookPageItem;
  className?: string;
  onOpen?: (item: BookPageItem) => void;
}) {
  const thumb = item.thumbnail_url || item.media_url;
  const lastTapAt = useRef(0);

  function handleDoubleTap() {
    if (!onOpen || !isMedia(item) || !item.media_url) return;
    const now = Date.now();
    if (now - lastTapAt.current < 320) {
      onOpen(item);
      lastTapAt.current = 0;
      return;
    }
    lastTapAt.current = now;
  }

  if (!item.type) {
    return (
      <div
        className={`flex items-center justify-center bg-muted text-muted-foreground ${className ?? ""}`}
      >
        <ImageOff className="h-8 w-8" aria-hidden="true" />
      </div>
    );
  }

  if (isMedia(item) && thumb) {
    const isTour = isTourItem(item);
    return (
      <figure
        className={`flex min-h-0 flex-col overflow-hidden bg-muted ${onOpen ? "cursor-zoom-in" : ""} ${className ?? ""}`}
        role={onOpen ? "button" : undefined}
        tabIndex={onOpen ? 0 : undefined}
        aria-label={onOpen ? "Foto vergrößern" : undefined}
        onClick={() => onOpen?.(item)}
        onDoubleClick={() => onOpen?.(item)}
        onPointerUp={(event) => {
          if (event.pointerType === "touch") handleDoubleTap();
        }}
        onTouchEnd={handleDoubleTap}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpen?.(item);
          }
        }}
        title="Tippen zum Vergrößern"
      >
        <div className="relative min-h-0 flex-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumb}
            alt={item.caption || "Tagebuch-Foto"}
            className="h-full w-full object-contain"
            loading="lazy"
          />
          {(item.type === "video" || isTour) && (
            <div
              className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-medium text-white"
              aria-label={isTour ? "Tour" : "Video"}
            >
              {isTour ? (
                <Map className="h-3 w-3" aria-hidden="true" />
              ) : (
                <Video className="h-3 w-3" aria-hidden="true" />
              )}
              {isTour ? "Tour" : "Video"}
            </div>
          )}
        </div>
        {item.caption ? (
          <figcaption className="border-t border-border/40 bg-card/90 px-3 py-2 text-xs leading-relaxed text-foreground">
            {item.caption}
          </figcaption>
        ) : null}
      </figure>
    );
  }

  if (item.type === "text" || item.type === "audio") {
    const Icon = item.type === "audio" ? Mic : Type;
    return (
      <div
        className={`flex flex-col justify-between gap-3 bg-accent/15 p-4 text-foreground ${className ?? ""}`}
      >
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          {item.type === "audio" ? "Sprachnotiz" : "Notiz"}
        </div>
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed sm:text-base">
          {item.caption || "(kein Text)"}
        </p>
        {item.author_name && (
          <span className="text-xs text-muted-foreground">
            {item.author_name}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-center bg-muted text-muted-foreground ${className ?? ""}`}
    >
      <ImageOff className="h-8 w-8" aria-hidden="true" />
    </div>
  );
}

/**
 * Renders the selected items using the configured layout. Layouts preserve the
 * editor's item order, but adapt column counts to the viewport so archive pages
 * stay readable on iPhone, iPad, and desktop.
 */
export function BookPageLayout({ layout, items, sideText }: BookPageLayoutProps) {
  const shown = items.slice(0, MAX_PHOTOS_PER_PAGE);
  const [lightboxItem, setLightboxItem] = useState<BookPageItem | null>(null);

  if (shown.length === 0) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-sm text-muted-foreground">
        Keine Beiträge auf dieser Seite
      </div>
    );
  }

  let hero: BookPageItem[] = [];
  let heroGrid: ReactNode = null;

  switch (layout) {
    case "single": {
      hero = shown.slice(0, 1);
      heroGrid = (
        <MediaTile
          item={hero[0]}
          className={tileClass("hero")}
          onOpen={setLightboxItem}
        />
      );
      break;
    }
    case "two": {
      hero = shown.slice(0, 2);
      heroGrid = (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {hero.map((item) => (
            <MediaTile
              key={item.id}
              item={item}
              className={tileClass()}
              onOpen={setLightboxItem}
            />
          ))}
        </div>
      );
      break;
    }
    case "three": {
      hero = shown.slice(0, 3);
      heroGrid = (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {hero.map((item) => (
            <MediaTile
              key={item.id}
              item={item}
              className={tileClass()}
              onOpen={setLightboxItem}
            />
          ))}
        </div>
      );
      break;
    }
    case "four": {
      hero = shown.slice(0, 4);
      heroGrid = (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {hero.map((item) => (
            <MediaTile
              key={item.id}
              item={item}
              className={tileClass()}
              onOpen={setLightboxItem}
            />
          ))}
        </div>
      );
      break;
    }
    case "five-hero": {
      hero = shown.slice(0, 5);
      const [heroItem, ...quad] = hero;
      heroGrid = (
        <div className="space-y-3">
          {heroItem && (
            <MediaTile
              item={heroItem}
              className={tileClass("hero")}
              onOpen={setLightboxItem}
            />
          )}
          {quad.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {quad.map((item) => (
                <MediaTile
                  key={item.id}
                  item={item}
                  className={tileClass()}
                  onOpen={setLightboxItem}
                />
              ))}
            </div>
          )}
        </div>
      );
      break;
    }
    case "grid-3": {
      hero = shown;
      heroGrid = (
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          {shown.map((item) => (
            <MediaTile
              key={item.id}
              item={item}
              className="aspect-square rounded-sm"
              onOpen={setLightboxItem}
            />
          ))}
        </div>
      );
      break;
    }
    case "text-left": {
      hero = shown.slice(0, 1);
      const first = hero[0];
      heroGrid = (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:items-stretch">
          <div className="flex flex-col justify-center rounded-lg bg-accent/10 p-4 md:min-h-[280px]">
            {sideText ? (
              <p className="whitespace-pre-wrap text-base leading-relaxed text-foreground">
                {sideText}
              </p>
            ) : (
              <p className="text-sm italic text-muted-foreground">
                Kein Kommentar hinterlegt.
              </p>
            )}
          </div>
          {first && (
            <MediaTile
              item={first}
              className="min-h-[280px] rounded-lg"
              onOpen={setLightboxItem}
            />
          )}
        </div>
      );
      break;
    }
  }

  const heroIds = new Set(hero.map((h) => h.id));
  const extras = shown.filter((i) => !heroIds.has(i.id));

  return (
    <div className="space-y-3">
      {heroGrid}
      {extras.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {extras.map((item) => (
            <MediaTile
              key={item.id}
              item={item}
              className="aspect-square rounded-md"
              onOpen={setLightboxItem}
            />
          ))}
        </div>
      )}
      <Dialog open={!!lightboxItem} onOpenChange={(open) => !open && setLightboxItem(null)}>
        <DialogContent className="h-[100dvh] w-screen max-w-[100vw] border-none bg-black/95 p-0 sm:rounded-none [&>button]:text-white">
          <DialogTitle className="sr-only">
            {lightboxItem?.caption || "Tagebuch-Foto vergrößert"}
          </DialogTitle>
          <div className="flex h-full flex-col">
            <button
              type="button"
              className="absolute left-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white shadow-sm transition-colors hover:bg-black/75 focus:outline-none focus:ring-2 focus:ring-white"
              style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}
              aria-label="Zurück zum Tagebuch"
              onClick={() => setLightboxItem(null)}
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className="flex min-h-0 flex-1 items-center justify-center p-3 sm:p-6">
              {lightboxItem?.media_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={lightboxItem.media_url}
                  alt={lightboxItem.caption || "Tagebuch-Foto"}
                  className="max-h-full max-w-full object-contain"
                />
              ) : null}
            </div>
            {lightboxItem?.caption ? (
              <div className="border-t border-white/10 bg-black/80 px-4 py-3 text-sm leading-relaxed text-white/85">
                {lightboxItem.caption}
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
