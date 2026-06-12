"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { GpsStatusBadge } from "@/components/gps-status-badge";
import {
  AgendaSelector,
  findTodayAgendaItem,
} from "@/components/agenda-selector";
import { ActionButtonGrid } from "@/components/action-button-grid";
import { PhotoSheet } from "@/components/photo-sheet";
import { VideoSheet } from "@/components/video-sheet";
import { AudioSheet } from "@/components/audio-sheet";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useGeolocation } from "@/hooks/use-geolocation";
import {
  CONTENT_MAX_FILE_SIZE_BYTES,
  CONTENT_ALLOWED_IMAGE_TYPES,
  CONTENT_ALLOWED_VIDEO_TYPES,
} from "@/lib/validations/content";
import { VIDEO_MAX_FILE_SIZE_BYTES, processAndUploadImage } from "@/lib/content-upload";
import { startOnlineSync } from "@/lib/offline-queue";
import { computeSHA256, checkDuplicate } from "@/lib/file-hash";
import type { AgendaItem } from "@/lib/event-utils";
import { AlertCircle } from "lucide-react";

interface WandererScreenProps {
  eventId: string;
  userId: string;
  agendaItems: AgendaItem[];
}

/**
 * Main Wanderer Screen — the capture interface for event content.
 * Composes GPS badge, agenda selector, action buttons, and bottom sheets.
 */
export function WandererScreen({
  eventId,
  userId,
  agendaItems,
}: WandererScreenProps) {
  const { position, status: gpsStatus, refresh: refreshGps } = useGeolocation();

  // Start offline queue sync listener
  useEffect(() => {
    const cleanup = startOnlineSync((count) => {
      toast.success(
        `${count} offline Beitrag${count > 1 ? "\u00e4ge" : ""} nachtr\u00e4glich synchronisiert \u2713`,
        { duration: 4000 }
      );
    });
    return cleanup;
  }, []);

  // Agenda selection — default to today's item
  const [selectedAgendaId, setSelectedAgendaId] = useState<string | null>(
    () => findTodayAgendaItem(agendaItems)
  );

  // File handling
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  // Bulk upload state
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkTotal, setBulkTotal] = useState(0);
  const [bulkDone, setBulkDone] = useState(0);
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const [bulkDuplicates, setBulkDuplicates] = useState(0);

  // Sheet states
  const [photoSheetOpen, setPhotoSheetOpen] = useState(false);
  const [videoSheetOpen, setVideoSheetOpen] = useState(false);
  const [audioSheetOpen, setAudioSheetOpen] = useState(false);

  // Validate selected file — images open PhotoSheet, videos open VideoSheet
  const validateAndSetFile = useCallback((file: File | undefined) => {
    if (!file) return;

    setFileError(null);

    const isImage = CONTENT_ALLOWED_IMAGE_TYPES.some(
      (type) => file.type === type || (file.type === "" && file.name.match(/\.(jpe?g|png|webp|heic|heif)$/i))
    );

    const isVideo = CONTENT_ALLOWED_VIDEO_TYPES.some(
      (type) => file.type === type || (file.type === "" && file.name.match(/\.(mp4|webm|mov)$/i))
    );

    if (isImage) {
      if (file.size > CONTENT_MAX_FILE_SIZE_BYTES) {
        setFileError("Bild zu gross (max. 20 MB)");
        return;
      }
      setSelectedFile(file);
      setPhotoSheetOpen(true);
    } else if (isVideo) {
      if (file.size > VIDEO_MAX_FILE_SIZE_BYTES) {
        setFileError(`Video zu gross (max. ${Math.round(VIDEO_MAX_FILE_SIZE_BYTES / 1024 / 1024)} MB)`);
        return;
      }
      setSelectedVideoFile(file);
      setVideoSheetOpen(true);
    } else {
      setFileError("Nur Bilder und Videos erlaubt (JPEG, PNG, WebP, HEIC, MP4, WebM, MOV)");
    }
  }, []);

  // Note button handler — unified text/audio input
  const handleNote = useCallback(() => {
    setFileError(null);
    setAudioSheetOpen(true);
  }, []);

  // Upload button handler
  const handleUpload = useCallback(() => {
    setFileError(null);
    uploadInputRef.current?.click();
  }, []);

  // Bulk upload: process multiple images without preview/caption.
  // PROJ-39 flow:
  //   1) hash every file up front (5s timeout per file — silent fallback)
  //   2) drop duplicates WITHIN the picked batch (same hash twice)
  //   3) for each unique hash, probe the server — known duplicates are
  //      skipped without ever touching Storage
  //   4) only the survivors go through compress + upload + POST
  // Progress counter counts every picked file (processed = upload OR skipped
  // duplicate OR error) so the "X / N" reads monotonically.
  const handleBulkUpload = useCallback(
    async (files: File[]) => {
      if (!selectedAgendaId) {
        setFileError("Bitte zuerst einen Tages-Abschnitt auswählen.");
        return;
      }
      setBulkUploading(true);
      setBulkTotal(files.length);
      setBulkDone(0);
      setBulkErrors([]);
      setBulkDuplicates(0);
      const errors: string[] = [];

      // --- Phase 1: hash every file (parallel, each with its own timeout).
      const hashes = await Promise.all(files.map((f) => computeSHA256(f)));

      // --- Phase 2: in-batch dedup. If a hash appears more than once in
      // the batch, only the first occurrence goes through to upload; the
      // rest count as duplicates immediately.
      const seenHashes = new Set<string>();
      let duplicateCount = 0;
      let processed = 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const hash = hashes[i];

        try {
          // In-batch duplicate (same hash picked twice)?
          if (hash && seenHashes.has(hash)) {
            duplicateCount++;
            processed++;
            setBulkDone(processed);
            setBulkDuplicates(duplicateCount);
            continue;
          }

          // Server-side duplicate (already uploaded to this event)?
          if (hash) {
            const existing = await checkDuplicate(eventId, hash);
            if (existing) {
              duplicateCount++;
              processed++;
              setBulkDone(processed);
              setBulkDuplicates(duplicateCount);
              seenHashes.add(hash);
              continue;
            }
            seenHashes.add(hash);
          }

          // Genuinely new — compress + upload + POST.
          const result = await processAndUploadImage(file, eventId, userId);
          const latitude = result.exif.latitude ?? position?.latitude ?? null;
          const longitude = result.exif.longitude ?? position?.longitude ?? null;

          const res = await fetch(`/api/events/${eventId}/content`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "photo",
              agenda_item_id: selectedAgendaId,
              media_url: result.mediaUrl,
              thumbnail_url: result.thumbnailUrl,
              caption: null,
              latitude,
              longitude,
              exif_date: result.exif.exifDate,
              file_hash: hash,
            }),
          });

          if (!res.ok) {
            const data = await res.json().catch(() => null);
            throw new Error(data?.error || `HTTP ${res.status}`);
          }

          // PROJ-39 race-safety net — a second tab finished first.
          const resData = (await res.json().catch(() => null)) as
            | { content_item?: unknown; duplicate?: boolean }
            | null;
          if (resData?.duplicate) {
            duplicateCount++;
            setBulkDuplicates(duplicateCount);
          }
        } catch (err) {
          const name = file.name.length > 25 ? file.name.slice(0, 22) + "..." : file.name;
          const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
          errors.push(`${name}: ${msg}`);
        }
        processed++;
        setBulkDone(processed);
      }

      setBulkErrors(errors);
      setBulkUploading(false);
      const ok = files.length - errors.length - duplicateCount;
      if (ok > 0) {
        if (duplicateCount > 0) {
          toast.success(
            `${ok} hochgeladen, ${duplicateCount} Duplikat${duplicateCount === 1 ? "" : "e"} übersprungen ✓`,
            { duration: 5000 }
          );
        } else {
          toast.success(`${ok} von ${files.length} Fotos hochgeladen ✓`, {
            duration: 5000,
          });
        }
        refreshGps();
      } else if (duplicateCount > 0 && errors.length === 0) {
        // Nothing new, but nothing failed either — all were duplicates.
        toast.info(
          `Alle ${duplicateCount} Fotos waren bereits hochgeladen.`,
          { duration: 5000 }
        );
      }
      if (errors.length > 0) {
        toast.error(`${errors.length} Fotos fehlgeschlagen`, { duration: 5000 });
      }
    },
    [eventId, userId, selectedAgendaId, position, refreshGps]
  );

  // File input change handler — supports single + multi-select
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      // Multi-select: bulk upload all images without preview
      if (files.length > 1) {
        const imageFiles = Array.from(files).filter((f) =>
          CONTENT_ALLOWED_IMAGE_TYPES.some(
            (type) => f.type === type || (f.type === "" && f.name.match(/\.(jpe?g|png|webp|heic|heif)$/i))
          )
        );
        if (imageFiles.length === 0) {
          setFileError("Keine gültigen Bilddateien ausgewählt.");
        } else {
          handleBulkUpload(imageFiles);
        }
        e.target.value = "";
        return;
      }

      // Single file: existing flow with preview sheet
      validateAndSetFile(files[0]);
      e.target.value = "";
    },
    [validateAndSetFile, handleBulkUpload]
  );

  // Success callback — show toast, refresh GPS
  const handleSubmitSuccess = useCallback(() => {
    toast.success("Beitrag gespeichert \u2713", {
      duration: 3000,
    });
    refreshGps();
  }, [refreshGps]);

  return (
    <div className="space-y-4">
      {/* GPS Status + Agenda Selector */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <AgendaSelector
            agendaItems={agendaItems}
            value={selectedAgendaId}
            onChange={setSelectedAgendaId}
          />
        </div>
        <div className="pt-5">
          <GpsStatusBadge status={gpsStatus} onRetry={refreshGps} />
        </div>
      </div>

      {/* File validation error */}
      {fileError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>{fileError}</AlertDescription>
        </Alert>
      )}

      {/* Bulk upload progress */}
      {bulkUploading && (
        <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Fotos hochladen...</span>
            <span className="text-muted-foreground">{bulkDone} / {bulkTotal}</span>
          </div>
          <Progress value={bulkTotal > 0 ? (bulkDone / bulkTotal) * 100 : 0} className="h-2" />
        </div>
      )}

      {/* Bulk upload error summary */}
      {!bulkUploading && bulkErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>
            <p className="font-medium">{bulkErrors.length} Fotos fehlgeschlagen:</p>
            <ul className="mt-1 list-disc pl-4 text-xs">
              {bulkErrors.slice(0, 5).map((err, i) => (
                <li key={i}>{err}</li>
              ))}
              {bulkErrors.length > 5 && (
                <li>...und {bulkErrors.length - 5} weitere</li>
              )}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Action Buttons — disabled when any sheet or bulk upload is active */}
      <ActionButtonGrid
        onNote={handleNote}
        onUpload={handleUpload}
        disabled={
          bulkUploading ||
          photoSheetOpen ||
          videoSheetOpen ||
          audioSheetOpen
        }
      />

      {/* Hidden file inputs */}
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/webm,video/quicktime"
        multiple
        onChange={handleFileChange}
        className="hidden"
        aria-label="Dateien aus Galerie auswählen"
      />

      {/* Photo Sheet */}
      <PhotoSheet
        open={photoSheetOpen}
        onOpenChange={setPhotoSheetOpen}
        file={selectedFile}
        eventId={eventId}
        userId={userId}
        agendaItemId={selectedAgendaId}
        gpsPosition={position}
        onSubmitSuccess={handleSubmitSuccess}
      />

      {/* Video Sheet */}
      <VideoSheet
        open={videoSheetOpen}
        onOpenChange={setVideoSheetOpen}
        eventId={eventId}
        userId={userId}
        agendaItemId={selectedAgendaId}
        gpsPosition={position}
        onSubmitSuccess={handleSubmitSuccess}
        file={selectedVideoFile}
      />

      {/* Audio Sheet — unified text/audio note input */}
      <AudioSheet
        open={audioSheetOpen}
        onOpenChange={setAudioSheetOpen}
        eventId={eventId}
        userId={userId}
        agendaItemId={selectedAgendaId}
        gpsPosition={position}
        onSubmitSuccess={handleSubmitSuccess}
      />

    </div>
  );
}
