"use client";

// PROJ-35: Curated photo/video/audio/text grid for the public landing page.
// Uses the existing ContentLightbox from PROJ-28 for full-screen viewing.

import { useState } from "react";
import Image from "next/image";
import { Play, Mic, FileText, ImageOff } from "lucide-react";
import { ContentLightbox } from "@/components/content-lightbox";
import type { ContentItem } from "@/components/content-card";

export interface PublicGalleryItem {
  content_item_id: string;
  type: "photo" | "video" | "text" | "audio";
  media_url: string | null;
  thumbnail_url: string | null;
  caption: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  author_id: string | null;
  author_name: string | null;
  author_avatar_url: string | null;
}

interface Props {
  items: PublicGalleryItem[];
  eventId: string;
  agendaItemId: string;
}

function toContentItem(
  it: PublicGalleryItem,
  eventId: string,
  agendaItemId: string,
): ContentItem {
  return {
    id: it.content_item_id,
    event_id: eventId,
    agenda_item_id: agendaItemId,
    author_id: it.author_id ?? "",
    type: it.type,
    media_url: it.media_url,
    thumbnail_url: it.thumbnail_url,
    caption: it.caption,
    latitude: it.latitude,
    longitude: it.longitude,
    exif_date: null,
    created_at: it.created_at,
    author_name: it.author_name,
    author_avatar_url: it.author_avatar_url,
  };
}

export function PublicPhotoGallery({ items, eventId, agendaItemId }: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (items.length === 0) return null;

  const lightboxItems = items.map((it) => toContentItem(it, eventId, agendaItemId));

  return (
    <>
      <div
        className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-5"
        role="list"
        aria-label="Kuratierte Beiträge"
      >
        {items.map((item, idx) => (
          <button
            key={item.content_item_id}
            type="button"
            role="listitem"
            onClick={() => setLightboxIndex(idx)}
            className="group relative aspect-square overflow-hidden rounded-md bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label={`${item.type === "photo" ? "Foto" : item.type === "video" ? "Video" : item.type === "audio" ? "Sprachmemo" : "Text"} von ${item.author_name ?? "Unbekannt"}${item.caption ? ": " + item.caption.slice(0, 80) : ""}`}
          >
            {item.type === "photo" && (item.thumbnail_url || item.media_url) ? (
              <Image
                src={item.thumbnail_url || item.media_url || ""}
                alt={item.caption || "Foto"}
                fill
                sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, 20vw"
                className="object-cover transition-transform group-hover:scale-105"
                loading="lazy"
              />
            ) : item.type === "video" && (item.thumbnail_url || item.media_url) ? (
              <>
                {item.thumbnail_url ? (
                  <Image
                    src={item.thumbnail_url}
                    alt={item.caption || "Video"}
                    fill
                    sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, 20vw"
                    className="object-cover"
                    loading="lazy"
                  />
                ) : (
                  <video
                    src={item.media_url ?? undefined}
                    className="h-full w-full object-cover"
                    preload="metadata"
                    muted
                    playsInline
                  />
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <Play className="h-8 w-8 text-white drop-shadow" aria-hidden="true" />
                </span>
              </>
            ) : item.type === "audio" ? (
              <div className="flex h-full w-full items-center justify-center bg-purple-500/20">
                <Mic className="h-8 w-8 text-purple-700" aria-hidden="true" />
              </div>
            ) : item.type === "text" ? (
              <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-amber-100 p-2 text-center">
                <FileText className="h-5 w-5 text-amber-700" aria-hidden="true" />
                <span className="line-clamp-3 text-[10px] leading-tight text-amber-900">
                  {item.caption ?? ""}
                </span>
              </div>
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <ImageOff className="h-6 w-6" aria-hidden="true" />
              </div>
            )}
          </button>
        ))}
      </div>

      <ContentLightbox
        items={lightboxItems}
        currentIndex={lightboxIndex ?? 0}
        open={lightboxIndex !== null}
        onOpenChange={(o) => {
          if (!o) setLightboxIndex(null);
        }}
        onIndexChange={setLightboxIndex}
      />
    </>
  );
}
