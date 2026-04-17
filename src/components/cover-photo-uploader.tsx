"use client";

import { useState, useRef, useCallback } from "react";
import imageCompression from "browser-image-compression";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  COVER_MAX_SIZE_BYTES,
  COVER_ALLOWED_TYPES,
  COVER_MAX_DIMENSION,
  COVER_MAX_COMPRESSED_SIZE_KB,
} from "@/lib/validations/event";
import { generateEventGradient } from "@/lib/event-utils";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ImagePlus, Loader2, X, AlertCircle, Move } from "lucide-react";

interface CoverPhotoUploaderProps {
  eventName: string;
  currentCoverUrl: string | null;
  currentPosition: string;
  onCoverChange: (url: string | null) => void;
  onPositionChange: (position: string) => void;
}

export function CoverPhotoUploader({
  eventName,
  currentCoverUrl,
  currentPosition,
  onCoverChange,
  onPositionChange,
}: CoverPhotoUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentCoverUrl);
  const [position, setPosition] = useState(currentPosition);
  const positionRef = useRef(currentPosition);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ y: number; startPct: number } | null>(null);

  const gradient = generateEventGradient(eventName || "event");

  // Parse "50% 30%" → 30 (vertical %)
  const parseYPercent = (pos: string): number => {
    const parts = pos.split(/\s+/);
    if (parts.length >= 2) {
      const val = parseFloat(parts[1]);
      if (!isNaN(val)) return val;
    }
    if (pos === "center" || pos === "top" || pos === "bottom") {
      if (pos === "top") return 0;
      if (pos === "bottom") return 100;
      return 50;
    }
    return 50;
  };

  const handleDragStart = useCallback(
    (e: React.PointerEvent) => {
      if (!previewUrl) return;
      e.preventDefault();
      setDragging(true);
      dragStartRef.current = {
        y: e.clientY,
        startPct: parseYPercent(position),
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [previewUrl, position]
  );

  const handleDragMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragStartRef.current || !containerRef.current) return;
      const containerH = containerRef.current.clientHeight;
      const dy = e.clientY - dragStartRef.current.y;
      // Moving pointer down → show higher part of image → decrease %
      const pctDelta = (dy / containerH) * -100;
      const newPct = Math.max(
        0,
        Math.min(100, dragStartRef.current.startPct + pctDelta)
      );
      const newPos = `50% ${Math.round(newPct)}%`;
      setPosition(newPos);
      positionRef.current = newPos;
    },
    []
  );

  const handleDragEnd = useCallback(() => {
    if (!dragStartRef.current) return;
    setDragging(false);
    dragStartRef.current = null;
    onPositionChange(positionRef.current);
  }, [onPositionChange]);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setError(null);

      if (
        !COVER_ALLOWED_TYPES.includes(
          file.type as (typeof COVER_ALLOWED_TYPES)[number]
        )
      ) {
        setError("Nur JPEG, PNG und WebP erlaubt.");
        return;
      }

      if (file.size > COVER_MAX_SIZE_BYTES) {
        setError("Bild zu gross (max. 5 MB). Bitte ein kleineres Bild waehlen.");
        return;
      }

      setUploading(true);

      try {
        // Compress image client-side
        const compressed = await imageCompression(file, {
          maxWidthOrHeight: COVER_MAX_DIMENSION,
          maxSizeMB: COVER_MAX_COMPRESSED_SIZE_KB / 1024,
          useWebWorker: true,
          fileType: "image/jpeg",
        });

        // Create local preview
        const localPreview = URL.createObjectURL(compressed);
        setPreviewUrl(localPreview);
        // Reset position for new image
        setPosition("center");
        positionRef.current = "center";
        onPositionChange("center");

        // Upload to Supabase Storage
        const supabase = createSupabaseBrowserClient();
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(2, 10);
        const filePath = `temp/${timestamp}-${randomId}-cover.jpg`;

        const { error: uploadError } = await supabase.storage
          .from("covers")
          .upload(filePath, compressed, {
            contentType: "image/jpeg",
            cacheControl: "3600",
            upsert: true,
          });

        if (uploadError) {
          throw new Error(`Upload fehlgeschlagen: ${uploadError.message}`);
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from("covers").getPublicUrl(filePath);

        onCoverChange(publicUrl);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Upload fehlgeschlagen."
        );
        setPreviewUrl(currentCoverUrl);
      } finally {
        setUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [currentCoverUrl, onCoverChange, onPositionChange]
  );

  const handleRemove = useCallback(() => {
    setPreviewUrl(null);
    setPosition("center");
    positionRef.current = "center";
    setError(null);
    onCoverChange(null);
    onPositionChange("center");
  }, [onCoverChange, onPositionChange]);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">
        Cover-Foto (optional)
      </label>

      <div
        ref={containerRef}
        className="relative h-40 w-full overflow-hidden rounded-lg border border-border touch-none select-none"
        style={
          !previewUrl
            ? { background: gradient }
            : undefined
        }
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        onPointerCancel={handleDragEnd}
      >
        {previewUrl && (
          <img
            src={previewUrl}
            alt="Cover-Vorschau"
            className="h-full w-full object-cover pointer-events-none"
            style={{ objectPosition: position }}
            draggable={false}
          />
        )}

        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Loader2 className="h-8 w-8 animate-spin text-white" aria-hidden="true" />
          </div>
        )}

        {!previewUrl && !uploading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/80">
            <ImagePlus className="mb-2 h-8 w-8" aria-hidden="true" />
            <span className="text-sm">Gradient-Vorschau</span>
          </div>
        )}

        {previewUrl && !uploading && !dragging && (
          <>
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-center pb-1.5 pointer-events-none">
              <span className="flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white/80">
                <Move className="h-3 w-3" aria-hidden="true" />
                Ziehen zum Verschieben
              </span>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute right-2 top-2 h-8 w-8 rounded-full bg-black/50 hover:bg-black/70 text-white"
              onClick={(e) => {
                e.stopPropagation();
                handleRemove();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="Cover-Foto entfernen"
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        aria-label="Cover-Foto hochladen"
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="w-full"
      >
        <ImagePlus className="mr-2 h-4 w-4" aria-hidden="true" />
        {previewUrl ? "Cover aendern" : "Cover hochladen"}
      </Button>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
