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
import { Badge } from "@/components/ui/badge";
import { CaptionTextarea } from "@/components/caption-textarea";
import {
  generateVideoThumbnail,
  uploadVideoToStorage,
  VIDEO_MAX_FILE_SIZE_BYTES,
} from "@/lib/content-upload";
import { isNetworkError } from "@/lib/network-utils";
import { CONTENT_MAX_CAPTION_LENGTH } from "@/lib/validations/content";
import { computeSHA256, checkDuplicate } from "@/lib/file-hash";
import {
  useVideoRecorder,
  type UseVideoRecorderReturn,
} from "@/hooks/use-video-recorder";
import { toast } from "sonner";
import {
  Loader2,
  AlertCircle,
  X,
  Circle,
  Square,
  RotateCcw,
  Video,
} from "lucide-react";
import type { GpsPosition } from "@/hooks/use-geolocation";

interface VideoSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  userId: string;
  agendaItemId: string | null;
  gpsPosition: GpsPosition | null;
  onSubmitSuccess: () => void;
  /** Optional video file from gallery upload (skips recording, goes straight to preview) */
  file?: File | null;
}

/** Format seconds as MM:SS */
function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/**
 * Bottom sheet for video recording, preview, and upload.
 * Three states: idle, recording (live preview + timer), preview (playback + upload).
 */
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
  const recorder: UseVideoRecorderReturn = useVideoRecorder({
    maxDurationSeconds: 90,
    onInterrupted: () => {
      toast.info("Aufnahme wurde unterbrochen. Du kannst das Video verwenden oder neu aufnehmen.", { duration: 5000 });
    },
  });

  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Gallery file state — when a file is provided, skip recording
  const [galleryBlob, setGalleryBlob] = useState<Blob | null>(null);
  const [galleryPreviewUrl, setGalleryPreviewUrl] = useState<string | null>(null);

  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const livePreviewRef = useRef<HTMLVideoElement>(null);

  // When a gallery file is provided, set it as the blob for preview
  useEffect(() => {
    if (file && open) {
      setGalleryBlob(file);
      const url = URL.createObjectURL(file);
      setGalleryPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setGalleryBlob(null);
      setGalleryPreviewUrl(null);
    }
  }, [file, open]);

  // Attach stream to live preview video element
  useEffect(() => {
    if (livePreviewRef.current && recorder.stream) {
      livePreviewRef.current.srcObject = recorder.stream;
    }
  }, [recorder.stream]);

  // Handle sheet close — confirm if recording is active
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        if (recorder.isRecording) {
          const confirmed = window.confirm("Aufnahme abbrechen? Das aufgenommene Video geht verloren.");
          if (!confirmed) return;
          recorder.stop();
        }
        recorder.cleanup();
        setGalleryBlob(null);
        setGalleryPreviewUrl(null);
        setCaption("");
        setProgress(0);
        setError(null);
      }
      onOpenChange(isOpen);
    },
    [onOpenChange, recorder]
  );

  // Start recording
  const handleStartRecording = useCallback(async () => {
    setError(null);
    await recorder.start();
    if (recorder.error) {
      setError(recorder.error);
    }
  }, [recorder]);

  // Stop recording
  const handleStopRecording = useCallback(() => {
    recorder.stop();
  }, [recorder]);

  // Discard and re-record
  const handleReRecord = useCallback(() => {
    recorder.discard();
    setError(null);
  }, [recorder]);

  // Submit video
  const handleSubmit = useCallback(async () => {
    const blobToUpload = galleryBlob || recorder.blob;
    const mimeToUse = galleryBlob ? (file?.type || "video/mp4") : recorder.mimeType;
    if (!blobToUpload || !mimeToUse) return;

    const isOverLimit = caption.length > CONTENT_MAX_CAPTION_LENGTH;
    if (isOverLimit) {
      setError(
        `Kommentar zu lang (max. ${CONTENT_MAX_CAPTION_LENGTH} Zeichen)`
      );
      return;
    }

    // Check file size (100 MB limit)
    if (blobToUpload.size > VIDEO_MAX_FILE_SIZE_BYTES) {
      setError(
        `Video zu gross (${Math.round(blobToUpload.size / 1024 / 1024)} MB). Maximal ${Math.round(VIDEO_MAX_FILE_SIZE_BYTES / 1024 / 1024)} MB erlaubt.`
      );
      return;
    }

    setUploading(true);
    setError(null);
    setProgress(0);

    try {
      // PROJ-39: pre-upload dedup probe. Works on both gallery uploads
      // (File) and in-app recordings (Blob) since computeSHA256 accepts Blob.
      const fileHash = await computeSHA256(blobToUpload);
      if (fileHash) {
        const existing = await checkDuplicate(eventId, fileHash);
        if (existing) {
          toast.info("Dieses Video wurde bereits hochgeladen.", {
            duration: 5000,
          });
          if (navigator.vibrate) navigator.vibrate([30]);
          onSubmitSuccess();
          handleOpenChange(false);
          return;
        }
      }

      // Generate thumbnail from first frame
      setProgress(5);
      const thumbnailBlob = await generateVideoThumbnail(blobToUpload);
      setProgress(15);

      // Upload video + thumbnail to storage
      const { mediaUrl, thumbnailUrl } = await uploadVideoToStorage(
        eventId,
        userId,
        blobToUpload,
        thumbnailBlob,
        mimeToUse,
        (p) => setProgress(15 + Math.round(p * 0.6))
      );

      setProgress(80);

      // Save content item via API
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
        throw new Error(
          data?.error || "Beitrag konnte nicht gespeichert werden."
        );
      }

      // PROJ-39: server race-safety net — if another client won the INSERT
      // race, the server returns 200 + { duplicate: true } instead of 201.
      const resData = (await res.json().catch(() => null)) as
        | { content_item?: unknown; duplicate?: boolean }
        | null;
      if (resData?.duplicate) {
        toast.info("Dieses Video wurde bereits hochgeladen.", {
          duration: 5000,
        });
      }

      setProgress(100);

      // Haptic feedback on iOS
      if (navigator.vibrate) {
        navigator.vibrate([50]);
      }

      onSubmitSuccess();
      handleOpenChange(false);
    } catch (err) {
      if (isNetworkError(err)) {
        setError(
          "Kein Netz. Bitte versuche es erneut, wenn du wieder online bist."
        );
      } else {
        setError(
          err instanceof Error ? err.message : "Upload fehlgeschlagen."
        );
      }
    } finally {
      setUploading(false);
    }
  }, [
    recorder.blob,
    recorder.mimeType,
    galleryBlob,
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

  // Resolve effective blob/preview (gallery file takes precedence)
  const effectiveBlob = galleryBlob || recorder.blob;
  const effectivePreviewUrl = galleryPreviewUrl || recorder.previewUrl;
  const effectiveMimeType = galleryBlob ? (file?.type || "video/mp4") : recorder.mimeType;

  // Determine current phase
  const hasBlob = !!effectiveBlob;
  const isGalleryMode = !!galleryBlob;
  const isIdle = !recorder.isRecording && !hasBlob;
  const isRecordingPhase = recorder.isRecording;
  const isPreviewPhase = hasBlob && !recorder.isRecording;

  // Timer warning at 75 seconds (15 seconds remaining)
  const timerWarning = recorder.elapsedSeconds >= 75;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-w-lg rounded-t-2xl px-4 pb-6 pt-4 max-h-[90vh] overflow-y-auto"
      >
        <SheetHeader className="text-left">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg">Video-Beitrag</SheetTitle>
            {!uploading && !isRecordingPhase && (
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
          {/* === IDLE STATE === */}
          {isIdle && !recorder.error && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                <Video
                  className="h-10 w-10 text-muted-foreground"
                  aria-hidden="true"
                />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Nimm ein Video auf (max. 90 Sekunden)
              </p>
              <Button
                size="lg"
                className="gap-2 bg-red-600 hover:bg-red-700 text-white"
                onClick={handleStartRecording}
              >
                <Circle className="h-5 w-5 fill-current" aria-hidden="true" />
                Aufnahme starten
              </Button>
            </div>
          )}

          {/* === RECORDING STATE === */}
          {isRecordingPhase && (
            <div className="flex flex-col items-center gap-4">
              {/* Live preview */}
              <div className="relative w-full overflow-hidden rounded-lg border border-border bg-black">
                <video
                  ref={livePreviewRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full aspect-[4/3] object-cover"
                  aria-label="Live-Vorschau"
                />
                {/* Timer badge */}
                <Badge
                  variant="secondary"
                  className={`absolute top-3 right-3 font-mono text-sm px-3 py-1 ${
                    timerWarning
                      ? "bg-red-600 text-white border-red-600"
                      : "bg-black/60 text-white border-transparent"
                  }`}
                >
                  {formatTimer(recorder.elapsedSeconds)} / 01:30
                </Badge>
                {/* Recording indicator */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs font-medium text-white drop-shadow">
                    REC
                  </span>
                </div>
              </div>

              {/* Stop button */}
              <Button
                size="lg"
                variant="destructive"
                className="gap-2"
                onClick={handleStopRecording}
              >
                <Square
                  className="h-4 w-4 fill-current"
                  aria-hidden="true"
                />
                Aufnahme stoppen
              </Button>
            </div>
          )}

          {/* === PREVIEW STATE === */}
          {isPreviewPhase && (
            <>
              {/* Video preview */}
              <div className="overflow-hidden rounded-lg border border-border bg-black">
                <video
                  ref={videoPreviewRef}
                  src={effectivePreviewUrl || undefined}
                  controls
                  playsInline
                  className="w-full max-h-60 object-contain"
                  aria-label="Video-Vorschau"
                />
              </div>

              {/* Duration info */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                {!isGalleryMode && (
                  <span>Dauer: {formatTimer(recorder.elapsedSeconds)}</span>
                )}
                <span>
                  {effectiveBlob
                    ? `${(effectiveBlob.size / 1024 / 1024).toFixed(1)} MB`
                    : ""}
                </span>
              </div>

              {/* Re-record button (not shown for gallery uploads) */}
              {!isGalleryMode && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={handleReRecord}
                  disabled={uploading}
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Neu aufnehmen
                </Button>
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
            </>
          )}

          {/* Error display (from recorder or upload) */}
          {(error || recorder.error) && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription className="flex items-center justify-between gap-2">
                <span>{error || recorder.error}</span>
                {isPreviewPhase && error && (
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

        {/* Footer with submit button (only in preview phase) */}
        {isPreviewPhase && (
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
              disabled={uploading || isOverLimit || !effectiveBlob}
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
                "Verwenden"
              )}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
