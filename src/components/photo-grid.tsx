"use client";

import Image from "next/image";
import { Photo } from "@/lib/types";

interface PhotoGridProps {
  photos: Photo[];
  onPhotoClick: (index: number) => void;
}

export function PhotoGrid({ photos, onPhotoClick }: PhotoGridProps) {
  return (
    <div
      className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
      role="list"
      aria-label="Fotogalerie"
    >
      {photos.map((photo, index) => (
        <button
          key={photo.id}
          onClick={() => onPhotoClick(index)}
          className="group relative aspect-square overflow-hidden rounded-lg bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          role="listitem"
          aria-label={photo.caption || `Foto ${index + 1}`}
        >
          <Image
            src={photo.thumbnail_url || photo.full_url}
            alt={photo.caption || "Foto"}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-200 group-hover:scale-105"
            loading="lazy"
          />
          {/* Caption overlay on hover */}
          {photo.caption && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <p className="text-xs text-white line-clamp-2">{photo.caption}</p>
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
