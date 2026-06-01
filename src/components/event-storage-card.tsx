"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Film, HardDrive, Loader2, RefreshCw, Trash2, Video } from "lucide-react";

type StorageCategory =
  | "photos"
  | "videos"
  | "audios"
  | "slideshows"
  | "covers"
  | "avatars"
  | "orphaned"
  | "other";

interface StorageSummary {
  files: number;
  bytes: number;
}

interface StorageReport {
  totals: {
    files: number;
    bytes: number;
    referencedBytes: number;
    cleanupBytes: number;
  };
  categories: Record<StorageCategory, StorageSummary>;
  warnings: string[];
  cleanupCandidates: Array<{ bucket: string; path: string; size: number; reason?: string }>;
  largePhotos: Array<{ bucket: string; path: string; size: number }>;
  actions: {
    cleanup: StorageSummary;
    slideshows: StorageSummary;
    videos: StorageSummary & {
      protectedFiles: number;
      protectedBytes: number;
    };
  };
}

interface Props {
  eventId: string;
}

type StorageAction = "cleanup" | "delete_slideshows" | "delete_videos";

const categoryLabels: Record<StorageCategory, string> = {
  photos: "Fotos",
  videos: "Videos",
  audios: "Audio",
  slideshows: "Slideshows",
  covers: "Cover",
  avatars: "Avatare",
  orphaned: "Bereinigbar",
  other: "Sonstiges",
};

const actionCopy: Record<
  StorageAction,
  {
    title: string;
    button: string;
    confirmTitle: string;
    confirmDescription: (bytes: string) => string;
    success: (deleted: number, bytes: string) => string;
  }
> = {
  cleanup: {
    title: "Bereinigbare Dateien",
    button: "Bereinigbare löschen",
    confirmTitle: "Bereinigbare Dateien löschen?",
    confirmDescription: (bytes) =>
      `Es werden nur Dateien gelöscht, die keine Datenbankreferenz mehr haben. Erwartete Ersparnis: ${bytes}.`,
    success: (deleted, bytes) => `${deleted} Dateien gelöscht (${bytes} frei).`,
  },
  delete_slideshows: {
    title: "Slideshows",
    button: "Slideshows löschen",
    confirmTitle: "Slideshows löschen?",
    confirmDescription: (bytes) =>
      `Die WhatsApp-Tagesfilme werden entfernt. Tagebuch, Fotos, Notizen und Kuratierung bleiben erhalten. Erwartete Ersparnis: ${bytes}.`,
    success: (deleted, bytes) => `${deleted} Slideshow-Dateien gelöscht (${bytes} frei).`,
  },
  delete_videos: {
    title: "Videos",
    button: "Videos löschen",
    confirmTitle: "Videos löschen?",
    confirmDescription: (bytes) =>
      `Es werden nur Video-Uploads gelöscht, die nicht im Tagebuch verwendet werden. Fotos, Notizen und Tagebuch-Videos bleiben erhalten. Erwartete Ersparnis: ${bytes}.`,
    success: (deleted, bytes) => `${deleted} Videos gelöscht (${bytes} frei).`,
  },
};

function formatBytes(bytes: number): string {
  if (!bytes) return "0 MB";
  const mb = bytes / 1024 / 1024;
  if (mb < 1) return `${Math.round(bytes / 1024)} KB`;
  return `${mb.toFixed(mb >= 100 ? 0 : 1)} MB`;
}

export function EventStorageCard({ eventId }: Props) {
  const [report, setReport] = useState<StorageReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningAction, setRunningAction] = useState<StorageAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<StorageAction | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/storage`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Speicherbericht konnte nicht geladen werden.");
      }
      const data = (await res.json()) as { report: StorageReport };
      setReport(data.report);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speicherbericht konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const categories = useMemo(() => {
    if (!report) return [];
    return (Object.keys(categoryLabels) as StorageCategory[])
      .map((key) => ({ key, ...report.categories[key] }))
      .filter((item) => item.files > 0 || item.bytes > 0);
  }, [report]);

  const actionCards = useMemo(() => {
    if (!report) return [];
    return [
      {
        action: "cleanup" as const,
        icon: Trash2,
        title: actionCopy.cleanup.title,
        bytes: report.actions.cleanup.bytes,
        files: report.actions.cleanup.files,
        description: "Verwaiste Dateien ohne Datenbankreferenz.",
      },
      {
        action: "delete_slideshows" as const,
        icon: Film,
        title: actionCopy.delete_slideshows.title,
        bytes: report.actions.slideshows.bytes,
        files: report.actions.slideshows.files,
        description: "Generierte WhatsApp-Tagesfilme. Das Tagebuch bleibt erhalten.",
      },
      {
        action: "delete_videos" as const,
        icon: Video,
        title: actionCopy.delete_videos.title,
        bytes: report.actions.videos.bytes,
        files: report.actions.videos.files,
        description:
          report.actions.videos.protectedFiles > 0
            ? `${report.actions.videos.protectedFiles} Tagebuch-Dateien bleiben geschützt.`
            : "Video-Uploads, die nicht im Tagebuch stecken.",
      },
    ];
  }, [report]);

  const freeStoragePct = report
    ? Math.min(100, Math.round((report.totals.referencedBytes / (1024 * 1024 * 1024)) * 100))
    : 0;

  const confirmBytes =
    confirmAction === "cleanup"
      ? report?.actions.cleanup.bytes ?? 0
      : confirmAction === "delete_slideshows"
        ? report?.actions.slideshows.bytes ?? 0
        : confirmAction === "delete_videos"
          ? report?.actions.videos.bytes ?? 0
          : 0;

  const runAction = useCallback(
    async (action: StorageAction) => {
      setRunningAction(action);
      try {
        const res = await fetch(`/api/events/${eventId}/storage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || "Bereinigung fehlgeschlagen.");
        }
        const data = (await res.json()) as { result: { deleted: number; bytes: number } };
        toast.success(actionCopy[action].success(data.result.deleted, formatBytes(data.result.bytes)));
        await fetchReport();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Bereinigung fehlgeschlagen.");
      } finally {
        setRunningAction(null);
        setConfirmAction(null);
      }
    },
    [eventId, fetchReport]
  );

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <HardDrive className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold text-foreground">Speicher</h2>
            <p className="text-sm text-muted-foreground">
              Supabase bleibt Arbeits- und Archivspeicher. Hier kannst du gezielt Platz freimachen,
              ohne das Tagebuch zu zerlegen.
            </p>
          </div>
        </div>
        <Button variant="outline" size="icon" onClick={fetchReport} disabled={loading || !!runningAction}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          )}
          <span className="sr-only">Aktualisieren</span>
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && !report && (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Speicher wird analysiert...
        </div>
      )}

      {report && (
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Event-Speicher</span>
              <span className="text-muted-foreground">
                {formatBytes(report.totals.referencedBytes)} / 1 GB Free Storage
              </span>
            </div>
            <Progress value={freeStoragePct} className="h-2" />
          </div>

          {report.warnings.length > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>
                <ul className="list-disc space-y-1 pl-4">
                  {report.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-2">
            {categories.map((item) => (
              <div key={item.key} className="rounded-md border border-border bg-background p-3">
                <p className="text-xs text-muted-foreground">{categoryLabels[item.key]}</p>
                <p className="text-lg font-semibold text-foreground">{formatBytes(item.bytes)}</p>
                <p className="text-xs text-muted-foreground">{item.files} Dateien</p>
              </div>
            ))}
          </div>

          <div className="grid gap-2">
            {actionCards.map((item) => {
              const Icon = item.icon;
              const disabled = item.files === 0 || !!runningAction;
              return (
                <div
                  key={item.action}
                  className="flex flex-col gap-3 rounded-md border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{item.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatBytes(item.bytes)} · {item.files} Dateien
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setConfirmAction(item.action)}
                    disabled={disabled}
                    className="shrink-0"
                  >
                    {runningAction === item.action ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                    )}
                    {actionCopy[item.action].button}
                  </Button>
                </div>
              );
            })}
          </div>

          {report.largePhotos.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {report.largePhotos.length} ältere Fotos liegen über dem neuen Zielwert. Bestehende Medien werden hier nur
              gemeldet; eine echte Neu-Kompression braucht einen separaten, bestätigten Migrationslauf.
            </p>
          )}
        </div>
      )}

      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction ? actionCopy[confirmAction].confirmTitle : ""}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction ? actionCopy[confirmAction].confirmDescription(formatBytes(confirmBytes)) : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmAction && runAction(confirmAction)}>Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
