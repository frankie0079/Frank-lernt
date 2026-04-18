"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import imageCompression from "browser-image-compression";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  AVATAR_MAX_SIZE_BYTES,
  AVATAR_ALLOWED_TYPES,
  AVATAR_MAX_DIMENSION,
  AVATAR_MAX_COMPRESSED_SIZE_KB,
} from "@/lib/validations/profile";
import { Camera, Loader2, User, AlertCircle, Check, X } from "lucide-react";

interface AvatarUploadProps {
  memberId: string;
  currentAvatarUrl: string | null;
  displayName: string | null;
  onUploadComplete: (url: string) => void;
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// ---------------------------------------------------------------------------
// Crop overlay — pinch + drag on the selected image, then confirm to crop
// ---------------------------------------------------------------------------
function AvatarCropOverlay({
  imageUrl,
  onConfirm,
  onCancel,
}: {
  imageUrl: string;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  // Transform state: offset in px from center, scale multiplier
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [scale, setScale] = useState(1);
  // Natural image size (needed for canvas crop)
  const [naturalW, setNaturalW] = useState(0);
  const [naturalH, setNaturalH] = useState(0);

  const stateRef = useRef({ tx: 0, ty: 0, scale: 1 });
  useEffect(() => {
    stateRef.current = { tx, ty, scale };
  }, [tx, ty, scale]);

  // Gesture tracking
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gestureStartRef = useRef<{
    tx: number;
    ty: number;
    scale: number;
    dist: number;
    center: { x: number; y: number };
  } | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const pts = Array.from(pointersRef.current.values());
    const s = stateRef.current;
    if (pts.length === 1) {
      gestureStartRef.current = {
        tx: s.tx,
        ty: s.ty,
        scale: s.scale,
        dist: 0,
        center: pts[0],
      };
    } else if (pts.length === 2) {
      gestureStartRef.current = {
        tx: s.tx,
        ty: s.ty,
        scale: s.scale,
        dist: dist(pts[0], pts[1]),
        center: {
          x: (pts[0].x + pts[1].x) / 2,
          y: (pts[0].y + pts[1].y) / 2,
        },
      };
    }
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!gestureStartRef.current) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = Array.from(pointersRef.current.values());
    const start = gestureStartRef.current;

    if (pts.length === 1) {
      const dx = pts[0].x - start.center.x;
      const dy = pts[0].y - start.center.y;
      setTx(start.tx + dx);
      setTy(start.ty + dy);
    } else if (pts.length === 2) {
      const d = dist(pts[0], pts[1]);
      const center = {
        x: (pts[0].x + pts[1].x) / 2,
        y: (pts[0].y + pts[1].y) / 2,
      };
      const ratio = start.dist > 0 ? d / start.dist : 1;
      const newScale = clamp(start.scale * ratio, 0.5, 4);
      setScale(newScale);
      const dx = center.x - start.center.x;
      const dy = center.y - start.center.y;
      setTx(start.tx + dx);
      setTy(start.ty + dy);
    }
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size === 0) {
      gestureStartRef.current = null;
    } else {
      const pts = Array.from(pointersRef.current.values());
      const s = stateRef.current;
      gestureStartRef.current = {
        tx: s.tx,
        ty: s.ty,
        scale: s.scale,
        dist: 0,
        center: pts[0],
      };
    }
  }, []);

  const handleConfirm = useCallback(() => {
    if (!imgRef.current || !containerRef.current || !naturalW) return;

    const container = containerRef.current;
    const size = container.clientWidth; // square container
    const s = stateRef.current;

    // The image is rendered at container width × (naturalH/naturalW * container width)
    // then scaled and translated. We need to figure out which part of the
    // natural image maps to the visible square.
    const renderedW = size;
    const renderedH = (naturalH / naturalW) * size;
    const scaledW = renderedW * s.scale;
    const scaledH = renderedH * s.scale;

    // Image top-left in container coords:
    const imgLeft = (size - scaledW) / 2 + s.tx;
    const imgTop = (size - scaledH) / 2 + s.ty;

    // Visible square is (0,0)→(size,size) in container coords
    // Map to natural image coords:
    const cropX = ((0 - imgLeft) / scaledW) * naturalW;
    const cropY = ((0 - imgTop) / scaledH) * naturalH;
    const cropSize = (size / scaledW) * naturalW;

    const canvas = document.createElement("canvas");
    const outputSize = Math.min(AVATAR_MAX_DIMENSION, 512);
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(
      imgRef.current,
      clamp(cropX, 0, naturalW),
      clamp(cropY, 0, naturalH),
      clamp(cropSize, 1, naturalW),
      clamp(cropSize, 1, naturalH),
      0,
      0,
      outputSize,
      outputSize
    );

    canvas.toBlob(
      (blob) => {
        if (blob) onConfirm(blob);
      },
      "image/jpeg",
      0.85
    );
  }, [naturalW, naturalH, onConfirm]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80">
      <p className="mb-3 text-sm text-white/70">
        1 Finger verschieben · 2 Finger zoomen
      </p>

      <div
        ref={containerRef}
        className="relative h-64 w-64 overflow-hidden rounded-full border-2 border-white/40 touch-none select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <img
          ref={imgRef}
          src={imageUrl}
          alt="Zuschneiden"
          className="pointer-events-none absolute left-1/2 top-1/2 w-full"
          style={{
            transform: `translate(-50%, -50%) translate(${tx}px, ${ty}px) scale(${scale})`,
          }}
          draggable={false}
          onLoad={(e) => {
            const img = e.currentTarget;
            setNaturalW(img.naturalWidth);
            setNaturalH(img.naturalHeight);
          }}
        />
      </div>

      <div className="mt-4 flex gap-4">
        <Button
          variant="outline"
          size="icon"
          className="h-12 w-12 rounded-full border-white/40 text-white hover:bg-white/20"
          onClick={onCancel}
          aria-label="Abbrechen"
        >
          <X className="h-6 w-6" />
        </Button>
        <Button
          size="icon"
          className="h-12 w-12 rounded-full"
          onClick={handleConfirm}
          aria-label="Zuschnitt bestätigen"
        >
          <Check className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main avatar upload component
// ---------------------------------------------------------------------------
export function AvatarUpload({
  memberId,
  currentAvatarUrl,
  displayName,
  onUploadComplete,
}: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentAvatarUrl);
  const [cropImage, setCropImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initials = displayName
    ? displayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : null;

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setError(null);

      if (
        !AVATAR_ALLOWED_TYPES.includes(
          file.type as (typeof AVATAR_ALLOWED_TYPES)[number]
        )
      ) {
        setError("Nur JPEG, PNG und WebP erlaubt.");
        return;
      }

      if (file.size > AVATAR_MAX_SIZE_BYTES) {
        setError("Bild zu gross (max. 2 MB).");
        return;
      }

      // Show crop overlay with the raw image
      const url = URL.createObjectURL(file);
      setCropImage(url);
    },
    []
  );

  const handleCropConfirm = useCallback(
    async (blob: Blob) => {
      setCropImage(null);
      setUploading(true);

      try {
        // Compress the cropped blob
        const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
        const compressed = await imageCompression(file, {
          maxWidthOrHeight: AVATAR_MAX_DIMENSION,
          maxSizeMB: AVATAR_MAX_COMPRESSED_SIZE_KB / 1024,
          useWebWorker: true,
          fileType: "image/jpeg",
        });

        const supabase = createSupabaseBrowserClient();
        const filePath = `${memberId}/avatar.jpg`;

        const { error: uploadError } = await supabase.storage
          .from("avatars")
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
        } = supabase.storage.from("avatars").getPublicUrl(filePath);

        const urlWithCacheBuster = `${publicUrl}?t=${Date.now()}`;
        setPreviewUrl(urlWithCacheBuster);

        const res = await fetch("/api/members/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ avatar_url: publicUrl }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Profil konnte nicht aktualisiert werden");
        }

        onUploadComplete(publicUrl);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Upload fehlgeschlagen."
        );
      } finally {
        setUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [memberId, onUploadComplete]
  );

  const handleCropCancel = useCallback(() => {
    setCropImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <Avatar className="h-24 w-24">
          <AvatarImage
            src={previewUrl ?? undefined}
            alt={displayName ?? "Profilfoto"}
          />
          <AvatarFallback className="bg-primary/10 text-primary text-lg">
            {initials ?? <User className="h-8 w-8" aria-hidden="true" />}
          </AvatarFallback>
        </Avatar>

        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
            <Loader2
              className="h-6 w-6 animate-spin text-white"
              aria-hidden="true"
            />
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        aria-label="Profilfoto hochladen"
      />

      <Button
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
      >
        <Camera className="mr-2 h-4 w-4" aria-hidden="true" />
        {currentAvatarUrl ? "Foto ändern" : "Foto hochladen"}
      </Button>

      {error && (
        <Alert variant="destructive" className="mt-2 max-w-xs">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {cropImage && (
        <AvatarCropOverlay
          imageUrl={cropImage}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  );
}
