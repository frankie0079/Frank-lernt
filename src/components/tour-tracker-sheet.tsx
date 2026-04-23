"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  AlertCircle,
  Info,
  Loader2,
  MapPinOff,
  Pause,
  Play,
  Route,
  Save,
  X,
} from "lucide-react";
import { useTourTracker } from "@/hooks/use-tour-tracker";
import {
  formatDistance,
  formatDuration,
  formatSpeed,
  formatTourCaption,
  renderTourReport,
} from "@/lib/tour-report";
import { processAndUploadImage } from "@/lib/content-upload";
import { computeSHA256, checkDuplicate } from "@/lib/file-hash";

interface TourTrackerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventName: string;
  agendaItemId: string | null;
  userId: string;
}

const MIN_DISTANCE_M_TO_SAVE = 50;
const MIN_POINTS_TO_SAVE = 5;

interface WakeLockSentinelLike {
  release: () => Promise<void>;
  addEventListener?: (type: string, listener: () => void) => void;
}

function formatHHMMSS(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function TourTrackerSheet({
  open,
  onOpenChange,
  eventId,
  eventName,
  agendaItemId,
  userId,
}: TourTrackerSheetProps) {
  const tracker = useTourTracker(eventId);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [resumeDialogOpen, setResumeDialogOpen] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [startedAt, setStartedAt] = useState<Date | null>(null);

  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  const wakeLockWarnedRef = useRef(false);
  const snapshotPromptedRef = useRef(false);

  // ── Resume-from-snapshot prompt ────────────────────────────────────
  useEffect(() => {
    if (!open) {
      snapshotPromptedRef.current = false;
      return;
    }
    if (
      open &&
      tracker.status === "idle" &&
      tracker.hasSnapshot &&
      !snapshotPromptedRef.current
    ) {
      snapshotPromptedRef.current = true;
      setResumeDialogOpen(true);
    }
  }, [open, tracker.status, tracker.hasSnapshot]);

  // ── Wake-Lock acquire on open / release on close or status=idle ────
  const requestWakeLock = useCallback(async () => {
    if (typeof navigator === "undefined") return;
    const wakeLock = (
      navigator as Navigator & {
        wakeLock?: {
          request: (type: "screen") => Promise<WakeLockSentinelLike>;
        };
      }
    ).wakeLock;
    if (!wakeLock?.request) {
      if (!wakeLockWarnedRef.current) {
        wakeLockWarnedRef.current = true;
        toast.warning(
          "Bildschirm bitte aktiv halten — Aufnahme pausiert wenn der Bildschirm sperrt.",
          { duration: 6000 }
        );
      }
      return;
    }
    try {
      const sentinel = await wakeLock.request("screen");
      wakeLockRef.current = sentinel;
      setWakeLockActive(true);
      sentinel.addEventListener?.("release", () => {
        setWakeLockActive(false);
        wakeLockRef.current = null;
      });
    } catch {
      // Graceful — behave like the unsupported case.
      if (!wakeLockWarnedRef.current) {
        wakeLockWarnedRef.current = true;
        toast.warning(
          "Bildschirm bitte aktiv halten — Aufnahme pausiert wenn der Bildschirm sperrt.",
          { duration: 6000 }
        );
      }
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    const sentinel = wakeLockRef.current;
    wakeLockRef.current = null;
    setWakeLockActive(false);
    if (sentinel) {
      try {
        await sentinel.release();
      } catch {
        // ignore
      }
    }
  }, []);

  // Acquire when recording starts; release on status leaves recording.
  useEffect(() => {
    if (tracker.status === "recording") {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }
  }, [tracker.status, requestWakeLock, releaseWakeLock]);

  // Release on unmount / sheet close.
  useEffect(() => {
    if (!open) {
      releaseWakeLock();
    }
    return () => {
      releaseWakeLock();
    };
  }, [open, releaseWakeLock]);

  // Re-acquire wake lock after visibility change (iOS releases it on backgrounding).
  useEffect(() => {
    if (typeof document === "undefined") return;
    const handler = () => {
      if (
        document.visibilityState === "visible" &&
        tracker.status === "recording" &&
        !wakeLockRef.current
      ) {
        requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [tracker.status, requestWakeLock]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next && tracker.status === "recording") {
        const confirmed = window.confirm(
          "Aufnahme läuft noch. Sheet schließen? Die Tour wird automatisch gesichert und kann fortgesetzt werden."
        );
        if (!confirmed) return;
      }
      if (!next) {
        setSaveError(null);
        setSaving(false);
      }
      onOpenChange(next);
    },
    [onOpenChange, tracker.status]
  );

  const handleStart = useCallback(() => {
    if (tracker.gpsStatus === "denied") {
      toast.error(
        "GPS ist blockiert. Bitte erlaube Standort-Zugriff in den Geräte-Einstellungen."
      );
      return;
    }
    if (tracker.gpsStatus === "unavailable") {
      toast.error("GPS ist auf diesem Gerät nicht verfügbar.");
      return;
    }
    setStartedAt(new Date());
    tracker.start();
  }, [tracker]);

  const handleResumeSnapshot = useCallback(() => {
    const ok = tracker.resumeFromSnapshot();
    if (ok) {
      setStartedAt(new Date());
      toast.success("Tour fortgesetzt", { duration: 3000 });
    } else {
      toast.error("Snapshot konnte nicht geladen werden");
    }
    setResumeDialogOpen(false);
  }, [tracker]);

  const handleDiscardSnapshot = useCallback(() => {
    tracker.clearSnapshot();
    setResumeDialogOpen(false);
  }, [tracker]);

  const handleSave = useCallback(async () => {
    if (saving) return;
    if (
      tracker.stats.distanceM < MIN_DISTANCE_M_TO_SAVE ||
      tracker.points.length < MIN_POINTS_TO_SAVE
    ) {
      setSaveError(
        "Mindestens einige Sekunden Aufnahme notwendig (>50 m / 5 GPS-Punkte)."
      );
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      // 1. Render report PNG.
      const blob = await renderTourReport({
        eventName,
        date: startedAt ?? new Date(),
        stats: tracker.stats,
        points: tracker.points.map((p) => ({ lat: p.lat, lng: p.lng })),
      });

      // 2. Wrap as File so it flows through the existing photo pipeline.
      const filename = `tour-${Date.now()}.png`;
      const file = new File([blob], filename, { type: "image/png" });

      // 3. Dedup probe (PROJ-39). Silent-fallback if hashing fails.
      const fileHash = await computeSHA256(file);
      if (fileHash) {
        const existing = await checkDuplicate(eventId, fileHash);
        if (existing) {
          toast.info("Dieser Tour-Report wurde bereits hochgeladen.", {
            duration: 5000,
          });
          tracker.reset();
          tracker.clearSnapshot();
          onOpenChange(false);
          return;
        }
      }

      // 4. Upload + post.
      const result = await processAndUploadImage(file, eventId, userId);
      const startPoint = tracker.points[0];
      const latitude = startPoint?.lat ?? null;
      const longitude = startPoint?.lng ?? null;

      const res = await fetch(`/api/events/${eventId}/content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "photo",
          agenda_item_id: agendaItemId,
          media_url: result.mediaUrl,
          thumbnail_url: result.thumbnailUrl,
          caption: formatTourCaption(tracker.stats),
          latitude,
          longitude,
          exif_date: (startedAt ?? new Date()).toISOString(),
          file_hash: fileHash,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          data?.error || "Tour-Report konnte nicht gespeichert werden."
        );
      }

      if (navigator.vibrate) navigator.vibrate([50]);

      toast.success("Tour gespeichert ✓", { duration: 4000 });
      tracker.reset();
      tracker.clearSnapshot();
      onOpenChange(false);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Upload fehlgeschlagen."
      );
    } finally {
      setSaving(false);
    }
  }, [
    saving,
    tracker,
    eventId,
    eventName,
    userId,
    agendaItemId,
    startedAt,
    onOpenChange,
  ]);

  const { status, stats, signalLost, gpsStatus } = tracker;
  const canSave =
    stats.distanceM >= MIN_DISTANCE_M_TO_SAVE &&
    tracker.points.length >= MIN_POINTS_TO_SAVE;

  const gpsBlocked = gpsStatus === "denied" || gpsStatus === "unavailable";

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="bottom"
          className="mx-auto max-w-lg rounded-t-2xl px-4 pb-6 pt-4 max-h-[90vh] overflow-y-auto"
        >
          <SheetHeader className="text-left">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-lg flex items-center gap-2">
                <Route className="h-5 w-5 text-primary" aria-hidden="true" />
                Tour-Tracker
              </SheetTitle>
              {!saving && status !== "recording" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleOpenChange(false)}
                  aria-label="Schließen"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            {/* GPS status banner */}
            {gpsBlocked && (
              <Alert variant="destructive">
                <MapPinOff className="h-4 w-4" aria-hidden="true" />
                <AlertDescription>
                  {gpsStatus === "denied"
                    ? "GPS ist blockiert. Bitte erlaube Standort-Zugriff in den Geräte-Einstellungen und öffne das Sheet erneut."
                    : "GPS ist auf diesem Gerät nicht verfügbar."}
                </AlertDescription>
              </Alert>
            )}

            {signalLost && status === "recording" && (
              <Alert>
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                <AlertDescription>
                  GPS-Signal verloren. Aufnahme läuft weiter, sobald das Signal
                  zurückkehrt.
                </AlertDescription>
              </Alert>
            )}

            {/* === IDLE ===================================================== */}
            {status === "idle" && (
              <div className="flex flex-col gap-4">
                <Alert>
                  <Info className="h-4 w-4" aria-hidden="true" />
                  <AlertDescription>
                    Bildschirm bitte aktiv halten — Aufnahme pausiert, wenn
                    dein iPhone sich sperrt. Wir fordern beim Start automatisch
                    Wake-Lock an.
                  </AlertDescription>
                </Alert>

                <Button
                  size="lg"
                  variant="destructive"
                  className="h-16 gap-2 text-base font-semibold"
                  onClick={handleStart}
                  disabled={gpsBlocked}
                >
                  <Route className="h-5 w-5" aria-hidden="true" />
                  Starte die Aufnahme
                </Button>
              </div>
            )}

            {/* === RECORDING + PAUSED ====================================== */}
            {status !== "idle" && (
              <>
                {/* Timer */}
                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
                  <div className="flex items-center gap-2">
                    {status === "recording" ? (
                      <span className="relative flex h-3 w-3">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
                        <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
                      </span>
                    ) : (
                      <Pause
                        className="h-4 w-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                    )}
                    <span className="text-xs font-medium text-muted-foreground">
                      {status === "recording" ? "Läuft" : "Pausiert"}
                    </span>
                    {wakeLockActive && status === "recording" && (
                      <Badge variant="secondary" className="ml-1 text-[10px]">
                        Wake-Lock aktiv
                      </Badge>
                    )}
                  </div>
                  <span className="font-mono text-2xl font-bold tabular-nums text-foreground">
                    {formatHHMMSS(stats.activeDurationMs)}
                  </span>
                </div>

                {/* Stats grid */}
                <div
                  className={`grid grid-cols-2 gap-3 ${status === "paused" ? "opacity-70" : ""}`}
                >
                  <StatCard
                    label="Geschwindigkeit"
                    value={
                      status === "paused" || signalLost
                        ? "0.0 km/h"
                        : formatSpeed(stats.currentSpeedKmh)
                    }
                  />
                  <StatCard
                    label="Ø-Geschwindigkeit"
                    value={formatSpeed(stats.avgSpeedKmh)}
                  />
                  <StatCard
                    label="Distanz"
                    value={formatDistance(stats.distanceM)}
                    highlight
                  />
                  <StatCard
                    label="Dauer"
                    value={formatDuration(stats.activeDurationMs)}
                  />
                  <StatCard
                    label="↑ Aufstieg"
                    value={`${Math.round(stats.elevationGainM)} m`}
                    colorClass="text-green-600"
                  />
                  <StatCard
                    label="↓ Abstieg"
                    value={`${Math.round(stats.elevationLossM)} m`}
                    colorClass="text-red-600"
                  />
                </div>

                {/* Controls */}
                {status === "recording" && (
                  <div className="flex flex-col gap-2">
                    <Button
                      size="lg"
                      variant="outline"
                      className="h-14 gap-2"
                      onClick={tracker.pause}
                      disabled={saving}
                    >
                      <Pause className="h-5 w-5" aria-hidden="true" />
                      Pausieren
                    </Button>
                    <Button
                      size="lg"
                      className="h-14 gap-2"
                      onClick={handleSave}
                      disabled={saving || !canSave}
                    >
                      {saving ? (
                        <>
                          <Loader2
                            className="h-5 w-5 animate-spin"
                            aria-hidden="true"
                          />
                          Speichern...
                        </>
                      ) : (
                        <>
                          <Save className="h-5 w-5" aria-hidden="true" />
                          Speichern
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {status === "paused" && (
                  <div className="flex flex-col gap-2">
                    <Button
                      size="lg"
                      variant="destructive"
                      className="h-14 gap-2"
                      onClick={tracker.resume}
                      disabled={saving || gpsBlocked}
                    >
                      <Play className="h-5 w-5" aria-hidden="true" />
                      Fortsetzen
                    </Button>
                    <Button
                      size="lg"
                      className="h-14 gap-2"
                      onClick={handleSave}
                      disabled={saving || !canSave}
                    >
                      {saving ? (
                        <>
                          <Loader2
                            className="h-5 w-5 animate-spin"
                            aria-hidden="true"
                          />
                          Speichern...
                        </>
                      ) : (
                        <>
                          <Save className="h-5 w-5" aria-hidden="true" />
                          Speichern
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {!canSave && (
                  <p className="text-center text-xs text-muted-foreground">
                    Mindestens {MIN_DISTANCE_M_TO_SAVE} m Distanz und{" "}
                    {MIN_POINTS_TO_SAVE} GPS-Punkte nötig.
                  </p>
                )}
              </>
            )}

            {saveError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                <AlertDescription className="flex items-center justify-between gap-2">
                  <span>{saveError}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 border-destructive text-destructive hover:bg-destructive/10"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    Erneut versuchen
                  </Button>
                </AlertDescription>
              </Alert>
            )}
          </div>

          {status !== "recording" && (
            <SheetFooter className="mt-4 flex-row gap-2">
              {status === "paused" && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    const ok = window.confirm(
                      "Tour verwerfen? Alle bisherigen Daten gehen verloren."
                    );
                    if (ok) {
                      tracker.reset();
                      tracker.clearSnapshot();
                      onOpenChange(false);
                    }
                  }}
                  disabled={saving}
                >
                  Verwerfen
                </Button>
              )}
              {status === "idle" && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => onOpenChange(false)}
                  disabled={saving}
                >
                  Schließen
                </Button>
              )}
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={resumeDialogOpen}
        onOpenChange={setResumeDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tour fortsetzen?</AlertDialogTitle>
            <AlertDialogDescription>
              Wir haben eine unterbrochene Tour-Aufnahme gefunden. Möchtest du
              sie fortsetzen oder verwerfen und neu beginnen?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDiscardSnapshot}>
              Verwerfen
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleResumeSnapshot}>
              Fortsetzen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  highlight?: boolean;
  colorClass?: string;
}

function StatCard({ label, value, highlight, colorClass }: StatCardProps) {
  return (
    <div
      className={`rounded-lg border ${
        highlight
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-muted/20"
      } px-3 py-3 text-center`}
    >
      <div
        className={`text-xl font-bold tabular-nums ${colorClass ?? "text-foreground"}`}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
