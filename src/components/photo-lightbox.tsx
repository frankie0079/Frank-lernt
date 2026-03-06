"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight, Calendar, User } from "lucide-react";
import { Photo } from "@/lib/types";
import { ShareButton } from "@/components/share-button";

interface PhotoLightboxProps {
  photos: Photo[];
  tourName: string;
  initialIndex: number;
  onClose: () => void;
}

export function PhotoLightbox({ photos, tourName, initialIndex, onClose }: PhotoLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const touchStartX = useRef<number | null>(null);
  const photo = photos[currentIndex];

  const goNext = useCallback(() => {
    setCurrentIndex((i) => (i + 1) % photos.length);
  }, [photos.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => (i - 1 + photos.length) % photos.length);
  }, [photos.length]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, goNext, goPrev]);

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Swipe handling for mobile
  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(diff) > 50) {
      if (diff < 0) goNext();
      else goPrev();
    }
    touchStartX.current = null;
  }

  const formattedDate = photo.taken_at
    ? new Date(photo.taken_at).toLocaleDateString("de-CH", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/95"
      role="dialog"
      aria-label="Foto-Lightbox"
      aria-modal="true"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between p-3 text-white/80">
        <span className="text-sm">
          {currentIndex + 1} / {photos.length}
        </span>
        <div className="flex items-center gap-2">
          <ShareButton
            title={photo.caption || `Foto — ${tourName}`}
            text={`Schau dir dieses Foto an! — ${tourName}`}
            url={typeof window !== "undefined" ? window.location.href : ""}
          />
          <button
            onClick={onClose}
            className="rounded-md p-1.5 hover:bg-white/10 transition-colors"
            aria-label="Lightbox schliessen"
          >
            <X className="h-5 w-5 text-white" />
          </button>
        </div>
      </div>

      {/* Image area */}
      <div
        className="relative flex-1 flex items-center justify-center px-2"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Previous button */}
        {photos.length > 1 && (
          <button
            onClick={goPrev}
            className="absolute left-2 z-10 rounded-full bg-black/40 p-2 text-white hover:bg-black/60 transition-colors hidden sm:block"
            aria-label="Vorheriges Foto"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        <div className="relative w-full h-full max-h-[80vh]">
          <Image
            src={photo.full_url}
            alt={photo.caption || "Foto"}
            fill
            sizes="100vw"
            className="object-contain"
            priority
          />
        </div>

        {/* Next button */}
        {photos.length > 1 && (
          <button
            onClick={goNext}
            className="absolute right-2 z-10 rounded-full bg-black/40 p-2 text-white hover:bg-black/60 transition-colors hidden sm:block"
            aria-label="Nächstes Foto"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>

      {/* Info bar */}
      <div className="p-3 text-white/80">
        {photo.caption && (
          <p className="text-sm text-white mb-1">{photo.caption}</p>
        )}
        <div className="flex flex-wrap items-center gap-3 text-xs text-white/60">
          {formattedDate && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formattedDate}
            </span>
          )}
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {photo.author_name}
          </span>
        </div>
      </div>
    </div>
  );
}
