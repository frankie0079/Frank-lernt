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
import { ImagePlus, Loader2, X, AlertCircle } from "lucide-react";

interface CoverPhotoUploaderProps {
  eventName: string;
  currentCoverUrl: string | null;
  currentPosition: string;
  currentScale: number;
  onCoverChange: (url: string | null) => void;
  onPositionChange: (position: string) => void;
  onScaleChange: (scale: number) => void;
}

// Parse "50% 30%" → { x: 50, y: 30 }
function parsePosition(pos: string): { x: number; y: number } {
  const parts = pos.split(/\s+/);
  if (parts.length >= 2) {
    const x = parseFloat(parts[0]);
    const y = parseFloat(parts[1]);
    if (!isNaN(x) && !isNaN(y)) return { x, y };
  }
  return { x: 50, y: 50 };
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function distBetween(
  a: { x: number; y: number },
  b: { x: number; y: number }
) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function CoverPhotoUploader({
  eventName,
  currentCoverUrl,
  currentPosition,
  currentScale,
  onCoverChange,
  onPositionChange,
  onScaleChange,
}: CoverPhotoUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentCoverUrl);
  const [position, setPosition] = useState(currentPosition);
  const [scale, setScale] = useState(currentScale);

  // Refs for gesture tracking (avoids stale closures)
  const posRef = useRef(parsePosition(currentPosition));
  const scaleRef = useRef(currentScale);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Multi-pointer tracking for pinch + pan
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gestureStartRef = useRef<{
    pos: { x: number; y: number };
    scale: number;
    dist: number;
    center: { x: number; y: number };
  } | null>(null);

  const gradient = generateEventGradient(eventName || "event");

  const commitValues = useCallback(() => {
    const pos = `${Math.round(posRef.current.x)}% ${Math.round(posRef.current.y)}%`;
    setPosition(pos);
    setScale(scaleRef.current);
    onPositionChange(pos);
    onScaleChange(scaleRef.current);
  }, [onPositionChange, onScaleChange]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!previewUrl) return;
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      const pts = Array.from(pointersRef.current.values());
      if (pts.length === 1) {
        // Single finger — start pan
        gestureStartRef.current = {
          pos: { ...posRef.current },
          scale: scaleRef.current,
          dist: 0,
          center: pts[0],
        };
      } else if (pts.length === 2) {
        // Two fingers — start pinch+pan
        const dist = distBetween(pts[0], pts[1]);
        const center = {
          x: (pts[0].x + pts[1].x) / 2,
          y: (pts[0].y + pts[1].y) / 2,
        };
        gestureStartRef.current = {
          pos: { ...posRef.current },
          scale: scaleRef.current,
          dist,
          center,
        };
      }
    },
    [previewUrl]
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!gestureStartRef.current || !containerRef.current) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const pts = Array.from(pointersRef.current.values());
    const containerH = containerRef.current.clientHeight;
    const containerW = containerRef.current.clientWidth;
    const start = gestureStartRef.current;

    if (pts.length === 1) {
      // Single finger pan
      const dx = pts[0].x - start.center.x;
      const dy = pts[0].y - start.center.y;
      // Moving pointer right → show more of left side → decrease x%
      const pctX = clamp(start.pos.x + (dx / containerW) * -100, 0, 100);
      const pctY = clamp(start.pos.y + (dy / containerH) * -100, 0, 100);
      posRef.current = { x: pctX, y: pctY };
      setPosition(`${Math.round(pctX)}% ${Math.round(pctY)}%`);
    } else if (pts.length === 2) {
      // Pinch zoom + two-finger pan
      const dist = distBetween(pts[0], pts[1]);
      const center = {
        x: (pts[0].x + pts[1].x) / 2,
        y: (pts[0].y + pts[1].y) / 2,
      };
      // Scale
      const ratio = start.dist > 0 ? dist / start.dist : 1;
      scaleRef.current = clamp(start.scale * ratio, 0.5, 3);
      setScale(scaleRef.current);
      // Pan from center movement
      const dx = center.x - start.center.x;
      const dy = center.y - start.center.y;
      const pctX = clamp(start.pos.x + (dx / containerW) * -100, 0, 100);
      const pctY = clamp(start.pos.y + (dy / containerH) * -100, 0, 100);
      posRef.current = { x: pctX, y: pctY };
      setPosition(`${Math.round(pctX)}% ${Math.round(pctY)}%`);
    }
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      pointersRef.current.delete(e.pointerId);
      if (pointersRef.current.size === 0) {
        gestureStartRef.current = null;
        commitValues();
      } else {
        // One finger lifted — restart gesture with remaining pointer
        const pts = Array.from(pointersRef.current.values());
        gestureStartRef.current = {
          pos: { ...posRef.current },
          scale: scaleRef.current,
          dist: 0,
          center: pts[0],
        };
      }
    },
    [commitValues]
  );

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
        const compressed = await imageCompression(file, {
          maxWidthOrHeight: COVER_MAX_DIMENSION,
          maxSizeMB: COVER_MAX_COMPRESSED_SIZE_KB / 1024,
          useWebWorker: true,
          fileType: "image/jpeg",
        });

        const localPreview = URL.createObjectURL(compressed);
        setPreviewUrl(localPreview);
        setPosition("center");
        setScale(1);
        posRef.current = { x: 50, y: 50 };
        scaleRef.current = 1;
        onPositionChange("center");
        onScaleChange(1);

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
    [currentCoverUrl, onCoverChange, onPositionChange, onScaleChange]
  );

  const handleRemove = useCallback(() => {
    setPreviewUrl(null);
    setPosition("center");
    setScale(1);
    posRef.current = { x: 50, y: 50 };
    scaleRef.current = 1;
    setError(null);
    onCoverChange(null);
    onPositionChange("center");
    onScaleChange(1);
  }, [onCoverChange, onPositionChange, onScaleChange]);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">
        Cover-Foto (optional)
      </label>

      <div
        ref={containerRef}
        className="relative h-56 w-full overflow-hidden rounded-lg border border-border touch-none select-none"
        style={
          !previewUrl
            ? { background: gradient }
            : undefined
        }
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {previewUrl && (
          <img
            src={previewUrl}
            alt="Cover-Vorschau"
            className="h-full w-full object-cover pointer-events-none"
            style={{
              objectPosition: position,
              transform: scale !== 1 ? `scale(${scale})` : undefined,
            }}
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

        {previewUrl && !uploading && pointersRef.current.size === 0 && (
          <>
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-center pb-1.5 pointer-events-none">
              <span className="flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white/80">
                1 Finger verschieben · 2 Finger zoomen
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
