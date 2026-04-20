"use client";

import { ImageOff, Mic, Type, Video } from "lucide-react";
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

function MediaTile({
  item,
  className,
}: {
  item: BookPageItem;
  className?: string;
}) {
  const thumb = item.thumbnail_url || item.media_url;

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
    return (
      <figure className={`relative overflow-hidden bg-muted ${className ?? ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumb}
          alt={item.caption || "Tagebuch-Foto"}
          className="h-full w-full object-cover"
          loading="lazy"
        />
        {item.type === "video" && (
          <div
            className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white"
            aria-label="Video"
          >
            <Video className="h-3 w-3" aria-hidden="true" />
            Video
          </div>
        )}
        {item.caption && (
          <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent p-2 text-xs text-white line-clamp-2">
            {item.caption}
          </figcaption>
        )}
      </figure>
    );
  }

  // Text / audio note fallback — render as a styled quote tile
  const Icon = item.type === "audio" ? Mic : Type;
  return (
    <div
      className={`flex flex-col justify-between gap-2 bg-accent/20 p-4 text-sm text-foreground ${className ?? ""}`}
    >
      <Icon
        className="h-5 w-5 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed line-clamp-[10]">
        {item.caption || "(kein Text)"}
      </p>
      {item.author_name && (
        <span className="text-xs text-muted-foreground">
          — {item.author_name}
        </span>
      )}
    </div>
  );
}

/**
 * Renders the selected items using the configured layout. Behaviour:
 * - `single` uses item[0], fills full width with aspect-[4/3].
 * - `two`    uses item[0..1]  as a 2-column grid.
 * - `three`  uses item[0..2]  as a 3-column grid.
 * - `text-left` shows sideText on the left and the first media item right.
 * - Any further items beyond the layout's "hero" slots are rendered below as
 *   a 3-column gallery so nothing is lost when a tag was especially eventful.
 * - Maximum MAX_PHOTOS_PER_PAGE items are rendered; the rest are dropped
 *   (the editor already warns when a page has too many items).
 */
export function BookPageLayout({ layout, items, sideText }: BookPageLayoutProps) {
  const shown = items.slice(0, MAX_PHOTOS_PER_PAGE);

  if (shown.length === 0) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-sm text-muted-foreground">
        Keine Beiträge auf dieser Seite
      </div>
    );
  }

  let hero: BookPageItem[] = [];
  let heroGrid: React.ReactNode = null;

  switch (layout) {
    case "single": {
      hero = shown.slice(0, 1);
      heroGrid = (
        <MediaTile
          item={hero[0]}
          className="aspect-[4/3] rounded-lg sm:aspect-[16/9]"
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
              className="aspect-square rounded-lg"
            />
          ))}
        </div>
      );
      break;
    }
    case "three": {
      hero = shown.slice(0, 3);
      heroGrid = (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {hero.map((item) => (
            <MediaTile
              key={item.id}
              item={item}
              className="aspect-square rounded-lg"
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
              className="aspect-[4/3] rounded-lg md:aspect-auto md:min-h-[280px]"
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
