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
import { TextCommentSheet } from "@/components/text-comment-sheet";
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
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  // Bulk upload state
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkTotal, setBulkTotal] = useState(0);
  const [bulkDone, setBulkDone] = useState(0);
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);

  // Sheet states
  const [photoSheetOpen, setPhotoSheetOpen] = useState(false);
  const [videoSheetOpen, setVideoSheetOpen] = useState(false);
  const [textSheetOpen, setTextSheetOpen] = useState(false);
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

  // Camera button handler — file inputs don't need navigator.permissions;
  // iOS handles camera access itself via the system picker.
  const handleCamera = useCallback(() => {
    setFileError(null);
    cameraInputRef.current?.click();
  }, []);

  // Video button handler
  const handleVideo = useCallback(() => {
    setFileError(null);
    setVideoSheetOpen(true);
  }, []);

  // Audio button handler
  const handleAudio = useCallback(() => {
    setFileError(null);
    setAudioSheetOpen(true);
  }, []);

  // Upload button handler
  const handleUpload = useCallback(() => {
    setFileError(null);
    uploadInputRef.current?.click();
  }, []);

  // Comment button handler
  const handleComment = useCallback(() => {
    setFileError(null);
    setTextSheetOpen(true);
  }, []);

  // Bulk upload: process multiple images without preview/caption
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
      const errors: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
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
            }),
          });

          if (!res.ok) {
            const data = await res.json().catch(() => null);
            throw new Error(data?.error || `HTTP ${res.status}`);
          }
        } catch (err) {
          const name = file.name.length > 25 ? file.name.slice(0, 22) + "..." : file.name;
          const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
          errors.push(`${name}: ${msg}`);
        }
        setBulkDone(i + 1);
      }

      setBulkErrors(errors);
      setBulkUploading(false);
      const ok = files.length - errors.length;
      if (ok > 0) {
        toast.success(`${ok} von ${files.length} Fotos hochgeladen ✓`, { duration: 5000 });
        refreshGps();
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
        onCamera={handleCamera}
        onVideo={handleVideo}
        onAudio={handleAudio}
        onUpload={handleUpload}
        onComment={handleComment}
        disabled={bulkUploading || photoSheetOpen || videoSheetOpen || textSheetOpen || audioSheetOpen}
      />

      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Foto aufnehmen oder auswaehlen"
      />
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/webm,video/quicktime"
        multiple
        onChange={handleFileChange}
        className="hidden"
        aria-label="Dateien aus Galerie auswaehlen"
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

      {/* Audio Sheet */}
      <AudioSheet
        open={audioSheetOpen}
        onOpenChange={setAudioSheetOpen}
        eventId={eventId}
        userId={userId}
        agendaItemId={selectedAgendaId}
        gpsPosition={position}
        onSubmitSuccess={handleSubmitSuccess}
      />

      {/* Text Comment Sheet */}
      <TextCommentSheet
        open={textSheetOpen}
        onOpenChange={setTextSheetOpen}
        eventId={eventId}
        userId={userId}
        agendaItemId={selectedAgendaId}
        gpsPosition={position}
        onSubmitSuccess={handleSubmitSuccess}
      />
    </div>
  );
}
