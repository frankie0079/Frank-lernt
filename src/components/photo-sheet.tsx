"use client";

import { useState, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CaptionTextarea } from "@/components/caption-textarea";
import { processAndUploadImage } from "@/lib/content-upload";
import { enqueue, OfflineQuotaError } from "@/lib/offline-queue";
import { isNetworkError } from "@/lib/network-utils";
import { CONTENT_MAX_CAPTION_LENGTH } from "@/lib/validations/content";
import { Loader2, AlertCircle, X } from "lucide-react";
import type { GpsPosition } from "@/hooks/use-geolocation";

interface PhotoSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: File | null;
  eventId: string;
  userId: string;
  agendaItemId: string | null;
  gpsPosition: GpsPosition | null;
  onSubmitSuccess: () => void;
}

/**
 * Bottom sheet for photo preview, optional caption, and upload.
 * Handles the full pipeline: EXIF extraction, compression, upload, API call.
 */
export function PhotoSheet({
  open,
  onOpenChange,
  file,
  eventId,
  userId,
  agendaItemId,
  gpsPosition,
  onSubmitSuccess,
}: PhotoSheetProps) {
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Generate preview URL when file changes
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen && file) {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
      } else {
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
        }
        setPreviewUrl(null);
        setCaption("");
        setProgress(0);
        setError(null);
      }
      onOpenChange(isOpen);
    },
    [file, onOpenChange, previewUrl]
  );

  const handleSubmit = useCallback(async () => {
    if (!file) return;

    const isOverLimit = caption.length > CONTENT_MAX_CAPTION_LENGTH;
    if (isOverLimit) {
      setError(`Kommentar zu lang (max. ${CONTENT_MAX_CAPTION_LENGTH} Zeichen)`);
      return;
    }

    setUploading(true);
    setError(null);
    setProgress(0);

    try {
      // Process: EXIF -> compress -> upload to storage
      const result = await processAndUploadImage(
        file,
        eventId,
        userId,
        (p) => setProgress(p)
      );

      // Use GPS from EXIF if available, otherwise from device GPS
      const latitude = result.exif.latitude ?? gpsPosition?.latitude ?? null;
      const longitude = result.exif.longitude ?? gpsPosition?.longitude ?? null;

      // Save content item via API
      const res = await fetch(`/api/events/${eventId}/content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "photo",
          agenda_item_id: agendaItemId,
          media_url: result.mediaUrl,
          thumbnail_url: result.thumbnailUrl,
          caption: caption.trim() || null,
          latitude,
          longitude,
          exif_date: result.exif.exifDate,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          data?.error || "Beitrag konnte nicht gespeichert werden."
        );
      }

      // Haptic feedback on iOS
      if (navigator.vibrate) {
        navigator.vibrate([50]);
      }

      onSubmitSuccess();
      handleOpenChange(false);
    } catch (err) {
      // If network error, queue for offline retry (with original file blob)
      if (isNetworkError(err)) {
        try {
          await enqueue(
            eventId,
            userId,
            {
              type: "photo",
              agenda_item_id: agendaItemId,
              caption: caption.trim() || null,
              latitude: gpsPosition?.latitude ?? null,
              longitude: gpsPosition?.longitude ?? null,
            },
            file
          );
          setError(
            "Kein Netz \u2014 Beitrag wird automatisch gesendet, sobald du wieder online bist."
          );
        } catch (queueErr) {
          if (queueErr instanceof OfflineQuotaError) {
            setError(queueErr.message);
          } else {
            setError("Upload fehlgeschlagen. Bitte versuche es erneut.");
          }
        }
      } else {
        setError(
          err instanceof Error ? err.message : "Upload fehlgeschlagen."
        );
      }
    } finally {
      setUploading(false);
    }
  }, [
    file,
    caption,
    eventId,
    userId,
    agendaItemId,
    gpsPosition,
    onSubmitSuccess,
    handleOpenChange,
  ]);

  const isOverLimit = caption.length > CONTENT_MAX_CAPTION_LENGTH;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-w-lg rounded-t-2xl px-4 pb-6 pt-4 max-h-[90vh] overflow-y-auto"
      >
        <SheetHeader className="text-left">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg">Foto-Beitrag</SheetTitle>
            {!uploading && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => handleOpenChange(false)}
                aria-label="Abbrechen"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Photo Preview */}
          {previewUrl && (
            <div className="overflow-hidden rounded-lg border border-border">
              <img
                src={previewUrl}
                alt="Foto-Vorschau"
                className="max-h-60 w-full object-contain bg-muted"
              />
            </div>
          )}

          {/* Caption */}
          <CaptionTextarea
            value={caption}
            onChange={setCaption}
            disabled={uploading}
          />

          {/* Upload Progress */}
          {uploading && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-center text-muted-foreground">
                Wird hochgeladen... {progress}%
              </p>
            </div>
          )}

          {/* Error with retry */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription className="flex items-center justify-between gap-2">
                <span>{error}</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 border-destructive text-destructive hover:bg-destructive/10"
                  onClick={handleSubmit}
                  disabled={uploading}
                >
                  Erneut versuchen
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <SheetFooter className="mt-4 flex-row gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => handleOpenChange(false)}
            disabled={uploading}
          >
            Abbrechen
          </Button>
          <Button
            className="flex-1"
            onClick={handleSubmit}
            disabled={uploading || isOverLimit || !file}
          >
            {uploading ? (
              <>
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
                Hochladen...
              </>
            ) : (
              "Absenden"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
