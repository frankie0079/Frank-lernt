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
import { Textarea } from "@/components/ui/textarea";
import {
  uploadAudioToStorage,
  AUDIO_MAX_FILE_SIZE_BYTES,
} from "@/lib/content-upload";
import { isNetworkError } from "@/lib/network-utils";
import { enqueue, OfflineQuotaError } from "@/lib/offline-queue";
import { CONTENT_MAX_CAPTION_LENGTH } from "@/lib/validations/content";
import { computeSHA256, checkDuplicate } from "@/lib/file-hash";
import {
  useAudioRecorder,
  type UseAudioRecorderReturn,
} from "@/hooks/use-audio-recorder";
import { toast } from "sonner";
import {
  Loader2,
  AlertCircle,
  X,
  Mic,
  Square,
  RotateCcw,
} from "lucide-react";
import type { GpsPosition } from "@/hooks/use-geolocation";

interface AudioSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  userId: string;
  agendaItemId: string | null;
  gpsPosition: GpsPosition | null;
  onSubmitSuccess: () => void;
}

const MAX_DURATION = 180;
const WARN_AT = 165;
const TRANSCRIPT_MAX = 2000;
const COMMENT_MAX = 500;

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Inline waveform canvas — draws live amplitude bars from AnalyserNode data.
 */
function WaveformCanvas({ data }: { data: Uint8Array | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cssWidth = canvas.clientWidth;
    const cssHeight = canvas.clientHeight;
    if (canvas.width !== cssWidth * dpr) {
      canvas.width = cssWidth * dpr;
      canvas.height = cssHeight * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, cssWidth, cssHeight);
    ctx.fillStyle = "rgb(168 85 247)"; // purple-500

    if (!data || data.length === 0) {
      // Idle baseline
      ctx.fillRect(0, cssHeight / 2 - 1, cssWidth, 2);
      return;
    }

    const bars = 48;
    const step = Math.floor(data.length / bars);
    const barWidth = cssWidth / bars;
    const gap = 2;
    for (let i = 0; i < bars; i++) {
      let max = 0;
      for (let j = 0; j < step; j++) {
        const dev = Math.abs(data[i * step + j] - 128);
        if (dev > max) max = dev;
      }
      const norm = Math.min(1, max / 128);
      const barHeight = Math.max(2, norm * cssHeight);
      const x = i * barWidth;
      const y = (cssHeight - barHeight) / 2;
      ctx.fillRect(x, y, barWidth - gap, barHeight);
    }
  }, [data]);

  return (
    <canvas
      ref={canvasRef}
      className="h-20 w-full rounded-md bg-purple-50"
      aria-label="Waveform"
    />
  );
}

export function AudioSheet({
  open,
  onOpenChange,
  eventId,
  userId,
  agendaItemId,
  gpsPosition,
  onSubmitSuccess,
}: AudioSheetProps) {
  const recorder: UseAudioRecorderReturn = useAudioRecorder({
    maxDurationSeconds: MAX_DURATION,
    onInterrupted: () => {
      // Spec edge case: phone call interruption — ask user to keep or discard.
      const keep = window.confirm(
        "Aufnahme wurde unterbrochen. OK = Sprachmemo behalten, Abbrechen = verwerfen."
      );
      if (!keep) {
        // Discard happens after onstop has populated the blob; defer.
        setTimeout(() => recorder.discard(), 0);
      }
    },
    onSilenceDetected: () => {
      toast.warning("Zu leise — bitte naeher ans Mikrofon", { duration: 4000 });
    },
  });

  const [comment, setComment] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        if (recorder.isRecording) {
          const confirmed = window.confirm(
            "Aufnahme abbrechen? Die Sprachmemo geht verloren."
          );
          if (!confirmed) return;
          recorder.stop();
        }
        recorder.cleanup();
        setComment("");
        setProgress(0);
        setError(null);
      }
      onOpenChange(isOpen);
    },
    [onOpenChange, recorder]
  );

  const handleStart = useCallback(async () => {
    setError(null);
    await recorder.start();
  }, [recorder]);

  const handleStop = useCallback(() => {
    recorder.stop();
  }, [recorder]);

  const handleReRecord = useCallback(() => {
    recorder.discard();
    setComment("");
    setError(null);
  }, [recorder]);

  // Text-only submit (no audio recording)
  const handleTextSubmit = useCallback(async () => {
    const trimmed = comment.trim();
    if (!trimmed) return;
    if (trimmed.length > COMMENT_MAX) {
      setError(`Text zu lang (max. ${COMMENT_MAX} Zeichen)`);
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const res = await fetch(`/api/events/${eventId}/content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "text",
          agenda_item_id: agendaItemId,
          caption: trimmed,
          latitude: gpsPosition?.latitude ?? null,
          longitude: gpsPosition?.longitude ?? null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Notiz konnte nicht gespeichert werden.");
      }

      if (navigator.vibrate) navigator.vibrate([50]);

      onSubmitSuccess();
      handleOpenChange(false);
    } catch (err) {
      if (isNetworkError(err)) {
        try {
          await enqueue(eventId, userId, {
            type: "text",
            agenda_item_id: agendaItemId,
            caption: trimmed,
            latitude: gpsPosition?.latitude ?? null,
            longitude: gpsPosition?.longitude ?? null,
          });
          setError("Kein Netz — Notiz wird automatisch gesendet, sobald du wieder online bist.");
        } catch (queueErr) {
          if (queueErr instanceof OfflineQuotaError) {
            setError(queueErr.message);
          } else {
            setError("Notiz konnte nicht gespeichert werden.");
          }
        }
      } else {
        setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.");
      }
    } finally {
      setUploading(false);
    }
  }, [comment, eventId, userId, agendaItemId, gpsPosition, onSubmitSuccess, handleOpenChange]);

  const handleSubmit = useCallback(async () => {
    if (!recorder.blob || !recorder.mimeType) return;

    const trimmedTranscript = recorder.transcript.trim();
    const trimmedComment = comment.trim();

    if (trimmedTranscript.length > TRANSCRIPT_MAX) {
      setError(`Transkription zu lang (max. ${TRANSCRIPT_MAX} Zeichen)`);
      return;
    }
    if (trimmedComment.length > COMMENT_MAX) {
      setError(`Kommentar zu lang (max. ${COMMENT_MAX} Zeichen)`);
      return;
    }

    if (!trimmedTranscript && !trimmedComment) {
      const confirmed = window.confirm(
        "Keine Transkription vorhanden — moechtest du trotzdem absenden?"
      );
      if (!confirmed) return;
    }

    // Combine transcript + optional comment into the caption field
    // (backend now allows up to 2500 chars, fits transcript 2000 + comment 500).
    let combinedCaption = trimmedTranscript;
    if (trimmedComment) {
      combinedCaption = combinedCaption
        ? `${combinedCaption}\n\n— ${trimmedComment}`
        : trimmedComment;
    }
    if (combinedCaption.length > CONTENT_MAX_CAPTION_LENGTH) {
      setError(
        `Text zu lang (max. ${CONTENT_MAX_CAPTION_LENGTH} Zeichen kombiniert).`
      );
      return;
    }

    if (recorder.blob.size > AUDIO_MAX_FILE_SIZE_BYTES) {
      setError(
        `Audio zu gross (${Math.round(recorder.blob.size / 1024 / 1024)} MB). Maximal ${Math.round(AUDIO_MAX_FILE_SIZE_BYTES / 1024 / 1024)} MB erlaubt.`
      );
      return;
    }

    setUploading(true);
    setError(null);
    setProgress(0);

    try {
      // PROJ-39: pre-upload dedup probe. MediaRecorder blobs are unlikely
      // to collide (every recording session is unique), but replays from
      // the offline queue or a user tapping "Absenden" twice can land the
      // same bytes twice — probe guards against that.
      const fileHash = await computeSHA256(recorder.blob);
      if (fileHash) {
        const existing = await checkDuplicate(eventId, fileHash);
        if (existing) {
          toast.info("Diese Sprachmemo wurde bereits hochgeladen.", {
            duration: 5000,
          });
          if (navigator.vibrate) navigator.vibrate([30]);
          onSubmitSuccess();
          handleOpenChange(false);
          return;
        }
      }

      const { mediaUrl } = await uploadAudioToStorage(
        eventId,
        userId,
        recorder.blob,
        recorder.mimeType,
        (p) => setProgress(Math.round(p * 0.85))
      );

      setProgress(90);

      const res = await fetch(`/api/events/${eventId}/content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "audio",
          agenda_item_id: agendaItemId,
          media_url: mediaUrl,
          thumbnail_url: null,
          caption: combinedCaption || null,
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
        toast.info("Diese Sprachmemo wurde bereits hochgeladen.", {
          duration: 5000,
        });
      }

      setProgress(100);

      if (navigator.vibrate) navigator.vibrate([50]);

      onSubmitSuccess();
      handleOpenChange(false);
    } catch (err) {
      // BUG-2 fix: enqueue audio for offline retry (mirror PhotoSheet pattern)
      if (isNetworkError(err)) {
        try {
          await enqueue(
            eventId,
            userId,
            {
              type: "audio",
              agenda_item_id: agendaItemId,
              caption: combinedCaption || null,
              latitude: gpsPosition?.latitude ?? null,
              longitude: gpsPosition?.longitude ?? null,
              audio_mime_type: recorder.mimeType,
            },
            recorder.blob
          );
          setError(
            "Kein Netz \u2014 Sprachmemo wird automatisch gesendet, sobald du wieder online bist."
          );
        } catch (queueErr) {
          if (queueErr instanceof OfflineQuotaError) {
            setError(queueErr.message);
          } else {
            setError("Upload fehlgeschlagen. Bitte versuche es erneut.");
          }
        }
      } else {
        setError(err instanceof Error ? err.message : "Upload fehlgeschlagen.");
      }
    } finally {
      setUploading(false);
    }
  }, [
    recorder.blob,
    recorder.mimeType,
    recorder.transcript,
    comment,
    eventId,
    userId,
    agendaItemId,
    gpsPosition,
    onSubmitSuccess,
    handleOpenChange,
  ]);

  const hasBlob = !!recorder.blob;
  const isIdle = !recorder.isRecording && !hasBlob;
  const isRecordingPhase = recorder.isRecording;
  const isPreviewPhase = hasBlob && !recorder.isRecording;
  const timerWarning = recorder.elapsedSeconds >= WARN_AT;

  const transcriptOver = recorder.transcript.length > TRANSCRIPT_MAX;
  const commentOver = comment.length > COMMENT_MAX;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-w-lg rounded-t-2xl px-4 pb-6 pt-4 max-h-[90vh] overflow-y-auto"
      >
        <SheetHeader className="text-left">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg">Notiz</SheetTitle>
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
          {/* === IDLE — text-first note input === */}
          {isIdle && !recorder.error && (
            <div className="flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Notiz schreiben oder mit Mikrofon aufnehmen
                </label>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Was möchtest du teilen?"
                  className="min-h-[120px]"
                  maxLength={COMMENT_MAX}
                />
                <div className="mt-1 flex justify-end">
                  <span
                    className={`text-xs ${commentOver ? "text-destructive" : "text-muted-foreground"}`}
                  >
                    {comment.length}/{COMMENT_MAX}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  size="lg"
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={handleStart}
                >
                  <Mic className="h-5 w-5 text-purple-600" aria-hidden="true" />
                  Aufnahme starten
                </Button>
              </div>

              {!recorder.speechSupported && (
                <p className="text-xs text-muted-foreground text-center">
                  Hinweis: Automatische Transkription ist in diesem Browser nicht verfügbar.
                </p>
              )}
            </div>
          )}

          {/* === RECORDING === */}
          {isRecordingPhase && (
            <div className="flex flex-col gap-4">
              <div className="relative">
                <WaveformCanvas data={recorder.amplitudeData} />
                <Badge
                  variant="secondary"
                  className={`absolute top-2 right-2 font-mono text-sm px-3 py-1 ${
                    timerWarning
                      ? "bg-red-600 text-white border-red-600"
                      : "bg-black/60 text-white border-transparent"
                  }`}
                >
                  {formatTimer(recorder.elapsedSeconds)} / 3:00
                </Badge>
                <div className="absolute top-2 left-2 flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs font-medium text-purple-900">
                    REC
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {recorder.speechSupported
                    ? "Live-Transkription"
                    : "Transkription nicht verfügbar"}
                </label>
                <Textarea
                  value={recorder.transcript}
                  onChange={(e) => recorder.setTranscript(e.target.value)}
                  placeholder={
                    recorder.speechSupported
                      ? "Wird automatisch transkribiert..."
                      : "Bitte Text manuell eingeben"
                  }
                  className="mt-1 min-h-[80px] resize-none"
                  maxLength={TRANSCRIPT_MAX}
                />
              </div>

              <Button
                size="lg"
                variant="destructive"
                className="gap-2"
                onClick={handleStop}
              >
                <Square className="h-4 w-4 fill-current" aria-hidden="true" />
                Aufnahme stoppen
              </Button>
            </div>
          )}

          {/* === PREVIEW === */}
          {isPreviewPhase && (
            <>
              <div className="overflow-hidden rounded-lg border border-border bg-purple-50 p-3">
                <audio
                  src={recorder.previewUrl || undefined}
                  controls
                  preload="metadata"
                  className="w-full"
                  aria-label="Audio-Vorschau"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Dauer: {formatTimer(recorder.elapsedSeconds)}</span>
                <span>
                  {recorder.blob
                    ? `${(recorder.blob.size / 1024 / 1024).toFixed(2)} MB`
                    : ""}
                </span>
              </div>

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

              <div>
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="audio-transcript"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Transkription (editierbar)
                  </label>
                  <span
                    className={`text-xs ${transcriptOver ? "text-destructive" : "text-muted-foreground"}`}
                  >
                    {recorder.transcript.length}/{TRANSCRIPT_MAX}
                  </span>
                </div>
                <Textarea
                  id="audio-transcript"
                  value={recorder.transcript}
                  onChange={(e) => recorder.setTranscript(e.target.value)}
                  placeholder="Transkription bearbeiten oder eingeben..."
                  className="mt-1 min-h-[100px]"
                  disabled={uploading}
                  maxLength={TRANSCRIPT_MAX}
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="audio-comment"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Kommentar (optional)
                  </label>
                  <span
                    className={`text-xs ${commentOver ? "text-destructive" : "text-muted-foreground"}`}
                  >
                    {comment.length}/{COMMENT_MAX}
                  </span>
                </div>
                <Textarea
                  id="audio-comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Optionaler Kommentar..."
                  className="mt-1 min-h-[60px]"
                  disabled={uploading}
                  maxLength={COMMENT_MAX}
                />
              </div>

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

        {isIdle && (
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
              onClick={handleTextSubmit}
              disabled={uploading || commentOver || comment.trim().length === 0}
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Speichern...
                </>
              ) : (
                "Absenden"
              )}
            </Button>
          </SheetFooter>
        )}

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
              disabled={
                uploading || transcriptOver || commentOver || !recorder.blob
              }
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
