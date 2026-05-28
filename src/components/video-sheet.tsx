"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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
import {
  generateVideoThumbnail,
  uploadVideoToStorage,
  VIDEO_MAX_FILE_SIZE_BYTES,
} from "@/lib/content-upload";
import { isNetworkError } from "@/lib/network-utils";
import { CONTENT_MAX_CAPTION_LENGTH } from "@/lib/validations/content";
import { computeSHA256, checkDuplicate } from "@/lib/file-hash";
import { toast } from "sonner";
import { Loader2, AlertCircle, X, Video } from "lucide-react";
import type { GpsPosition } from "@/hooks/use-geolocation";

interface VideoSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  userId: string;
  agendaItemId: string | null;
  gpsPosition: GpsPosition | null;
  onSubmitSuccess: () => void;
  /** Video file picked from the device library. Recording is intentionally not supported. */
  file?: File | null;
}

export function VideoSheet({
  open,
  onOpenChange,
  eventId,
  userId,
  agendaItemId,
  gpsPosition,
  onSubmitSuccess,
  file,
}: VideoSheetProps) {
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!file || !open) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, open]);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        setCaption("");
        setProgress(0);
        setError(null);
      }
      onOpenChange(isOpen);
    },
    [onOpenChange]
  );

  const handleSubmit = useCallback(async () => {
    if (!file) return;

    if (caption.length > CONTENT_MAX_CAPTION_LENGTH) {
      setError(`Kommentar zu lang (max. ${CONTENT_MAX_CAPTION_LENGTH} Zeichen)`);
      return;
    }

    if (file.size > VIDEO_MAX_FILE_SIZE_BYTES) {
      setError(
        `Video zu gross (${Math.round(file.size / 1024 / 1024)} MB). Maximal ${Math.round(
          VIDEO_MAX_FILE_SIZE_BYTES / 1024 / 1024
        )} MB erlaubt.`
      );
      return;
    }

    setUploading(true);
    setError(null);
    setProgress(0);

    try {
      const fileHash = await computeSHA256(file);
      if (fileHash) {
        const existing = await checkDuplicate(eventId, fileHash);
        if (existing) {
          toast.info("Dieses Video wurde bereits hochgeladen.", { duration: 5000 });
          if (navigator.vibrate) navigator.vibrate([30]);
          onSubmitSuccess();
          handleOpenChange(false);
          return;
        }
      }

      setProgress(5);
      const thumbnailBlob = await generateVideoThumbnail(file);
      setProgress(15);

      const { mediaUrl, thumbnailUrl } = await uploadVideoToStorage(
        eventId,
        userId,
        file,
        thumbnailBlob,
        file.type || "video/mp4",
        (p) => setProgress(15 + Math.round(p * 0.6))
      );

      setProgress(80);

      const res = await fetch(`/api/events/${eventId}/content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "video",
          agenda_item_id: agendaItemId,
          media_url: mediaUrl,
          thumbnail_url: thumbnailUrl,
          caption: caption.trim() || null,
          latitude: gpsPosition?.latitude ?? null,
          longitude: gpsPosition?.longitude ?? null,
          file_hash: fileHash,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Beitrag konnte nicht gespeichert werden.");
      }

      const resData = (await res.json().catch(() => null)) as
        | { content_item?: unknown; duplicate?: boolean }
        | null;
      if (resData?.duplicate) {
        toast.info("Dieses Video wurde bereits hochgeladen.", { duration: 5000 });
      }

      setProgress(100);
      if (navigator.vibrate) navigator.vibrate([50]);
      onSubmitSuccess();
      handleOpenChange(false);
    } catch (err) {
      if (isNetworkError(err)) {
        setError("Kein Netz. Bitte versuche es erneut, wenn du wieder online bist.");
      } else {
        setError(err instanceof Error ? err.message : "Upload fehlgeschlagen.");
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
  const sizeMb = file ? (file.size / 1024 / 1024).toFixed(1) : null;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-w-lg rounded-t-2xl px-4 pb-6 pt-4 max-h-[90vh] overflow-y-auto"
      >
        <SheetHeader className="text-left">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg">Video-Beitrag</SheetTitle>
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
          {!file && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                <Video className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
              </div>
              <p className="text-center text-sm text-muted-foreground">
                Nimm Videos mit der Handy-Kamera auf und lade sie danach hier hoch.
              </p>
            </div>
          )}

          {file && (
            <>
              <div className="overflow-hidden rounded-lg border border-border bg-black">
                <video
                  ref={videoPreviewRef}
                  src={previewUrl || undefined}
                  controls
                  playsInline
                  className="w-full max-h-60 object-contain"
                  aria-label="Video-Vorschau"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Max. {Math.round(VIDEO_MAX_FILE_SIZE_BYTES / 1024 / 1024)} MB</span>
                <span>{sizeMb} MB</span>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                <AlertDescription>
                  Videos verbrauchen viel Speicher. Kurze Clips funktionieren am besten.
                </AlertDescription>
              </Alert>

              <CaptionTextarea value={caption} onChange={setCaption} disabled={uploading} />

              {uploading && (
                <div className="space-y-2">
                  <Progress value={progress} className="h-2" />
                  <p className="text-center text-xs text-muted-foreground">
                    Wird hochgeladen... {progress}%
                  </p>
                </div>
              )}
            </>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription className="flex items-center justify-between gap-2">
                <span>{error}</span>
                {file && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 border-destructive text-destructive hover:bg-destructive/10"
                    onClick={handleSubmit}
                    disabled={uploading}
                  >
                    Erneut versuchen
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>

        {file && (
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
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Hochladen...
                </>
              ) : (
                "Hochladen"
              )}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
