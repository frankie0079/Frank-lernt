"use client";

import { useState, useRef, useCallback } from "react";
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
import { Camera, Loader2, User, AlertCircle } from "lucide-react";

interface AvatarUploadProps {
  userId: string;
  currentAvatarUrl: string | null;
  displayName: string | null;
  onUploadComplete: (url: string) => void;
}

export function AvatarUpload({
  userId,
  currentAvatarUrl,
  displayName,
  onUploadComplete,
}: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentAvatarUrl);
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
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setError(null);

      // Validate file type
      if (
        !AVATAR_ALLOWED_TYPES.includes(
          file.type as (typeof AVATAR_ALLOWED_TYPES)[number]
        )
      ) {
        setError("Nur JPEG, PNG und WebP erlaubt.");
        return;
      }

      // Validate file size (before compression)
      if (file.size > AVATAR_MAX_SIZE_BYTES) {
        setError("Bild zu gross (max. 2 MB).");
        return;
      }

      setUploading(true);

      try {
        // Compress image client-side
        const compressed = await imageCompression(file, {
          maxWidthOrHeight: AVATAR_MAX_DIMENSION,
          maxSizeMB: AVATAR_MAX_COMPRESSED_SIZE_KB / 1024,
          useWebWorker: true,
          fileType: "image/jpeg",
        });

        // Upload to Supabase Storage
        const supabase = createSupabaseBrowserClient();
        const filePath = `${userId}/avatar.jpg`;

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

        // Get public URL
        const {
          data: { publicUrl },
        } = supabase.storage.from("avatars").getPublicUrl(filePath);

        // Add cache buster to force refresh
        const urlWithCacheBuster = `${publicUrl}?t=${Date.now()}`;
        setPreviewUrl(urlWithCacheBuster);

        // Update profile in database
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ avatar_url: publicUrl })
          .eq("id", userId);

        if (updateError) {
          throw new Error(
            `Profil konnte nicht aktualisiert werden: ${updateError.message}`
          );
        }

        onUploadComplete(publicUrl);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Upload fehlgeschlagen."
        );
      } finally {
        setUploading(false);
        // Reset file input so the same file can be selected again
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [userId, onUploadComplete]
  );

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
        accept="image/jpeg,image/png,image/webp"
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
        {currentAvatarUrl ? "Foto aendern" : "Foto hochladen"}
      </Button>

      {error && (
        <Alert variant="destructive" className="mt-2 max-w-xs">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
