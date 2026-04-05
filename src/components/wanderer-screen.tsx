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
import { TextCommentSheet } from "@/components/text-comment-sheet";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useGeolocation } from "@/hooks/use-geolocation";
import {
  CONTENT_MAX_FILE_SIZE_BYTES,
  CONTENT_ALLOWED_IMAGE_TYPES,
} from "@/lib/validations/content";
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
  const [fileError, setFileError] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  // Sheet states
  const [photoSheetOpen, setPhotoSheetOpen] = useState(false);
  const [textSheetOpen, setTextSheetOpen] = useState(false);

  // Validate selected file
  const validateAndSetFile = useCallback((file: File | undefined) => {
    if (!file) return;

    setFileError(null);

    // Check file size
    if (file.size > CONTENT_MAX_FILE_SIZE_BYTES) {
      setFileError("Datei zu gross (max. 20 MB)");
      return;
    }

    // Check file type — allow images only for now
    const isImage = CONTENT_ALLOWED_IMAGE_TYPES.some(
      (type) => file.type === type || (file.type === "" && file.name.match(/\.(jpe?g|png|webp|heic|heif)$/i))
    );

    if (!isImage) {
      setFileError("Nur Bilder erlaubt (JPEG, PNG, WebP, HEIC)");
      return;
    }

    setSelectedFile(file);
    setPhotoSheetOpen(true);
  }, []);

  // Camera button handler — check permissions first
  const handleCamera = useCallback(async () => {
    setFileError(null);

    // Check camera permission if API is available
    if (navigator.permissions) {
      try {
        const result = await navigator.permissions.query({ name: "camera" as PermissionName });
        if (result.state === "denied") {
          setFileError(
            "Kamera-Zugriff blockiert. Bitte erlaube den Zugriff in den Einstellungen: Einstellungen > Safari > Kamera."
          );
          return;
        }
      } catch {
        // permissions.query not supported for camera — continue
      }
    }

    cameraInputRef.current?.click();
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

  // File input change handler
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      validateAndSetFile(file);
      // Reset input so the same file can be selected again
      e.target.value = "";
    },
    [validateAndSetFile]
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

      {/* Action Buttons */}
      <ActionButtonGrid
        onCamera={handleCamera}
        onUpload={handleUpload}
        onComment={handleComment}
      />

      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Foto mit Kamera aufnehmen"
      />
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Bild aus Galerie auswaehlen"
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
