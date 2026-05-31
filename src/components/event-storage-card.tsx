"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
import { HardDrive, Loader2, RefreshCw, Trash2, AlertTriangle } from "lucide-react";

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
}

interface Props {
  eventId: string;
}

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

function formatBytes(bytes: number): string {
  if (!bytes) return "0 MB";
  const mb = bytes / 1024 / 1024;
  if (mb < 1) return `${Math.round(bytes / 1024)} KB`;
  return `${mb.toFixed(mb >= 100 ? 0 : 1)} MB`;
}

export function EventStorageCard({ eventId }: Props) {
  const [report, setReport] = useState<StorageReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

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

  const freeStoragePct = report
    ? Math.min(100, Math.round((report.totals.referencedBytes / (1024 * 1024 * 1024)) * 100))
    : 0;

  const runCleanup = useCallback(async (execute: boolean) => {
    setCleaning(true);
    try {
      const res = await fetch(`/api/events/${eventId}/storage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cleanup", execute }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Bereinigung fehlgeschlagen.");
      }
      const data = (await res.json()) as {
        cleanup: { execute: boolean; deleted: number; bytes: number; candidates: unknown[] };
      };
      if (execute) {
        toast.success(`${data.cleanup.deleted} Dateien gelöscht (${formatBytes(data.cleanup.bytes)} frei).`);
      } else {
        toast.info(`${data.cleanup.candidates.length} Dateien würden bereinigt (${formatBytes(data.cleanup.bytes)}).`);
      }
      await fetchReport();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bereinigung fehlgeschlagen.");
    } finally {
      setCleaning(false);
      setConfirmOpen(false);
    }
  }, [eventId, fetchReport]);

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
              Supabase bleibt vorerst Arbeits- und Archivspeicher. Hier siehst du,
              was gebraucht wird und was nach Dry-Run bereinigt werden kann.
            </p>
          </div>
        </div>
        <Button variant="outline" size="icon" onClick={fetchReport} disabled={loading || cleaning}>
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

          <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span>Bereinigbar</span>
              <span className="font-medium">{formatBytes(report.totals.cleanupBytes)}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Verwaiste Dateien und alte Speicherreste werden erst nach Bestätigung gelöscht.
              Fotos, Videos und Notizen mit Datenbankreferenz bleiben erhalten, weil Tagebuch
              und Archivlink sie weiterhin brauchen.
            </p>
          </div>

          {report.categories.slideshows.bytes > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>
                Slideshows sind WhatsApp-Tagesfilme und kein Pflichtteil des
                Tagebuch-Archivs. Sie belegen aktuell{" "}
                {formatBytes(report.categories.slideshows.bytes)}. Eine
                gezielte Slideshow-Bereinigung ist separat zu entscheiden.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => runCleanup(false)}
              disabled={cleaning || report.cleanupCandidates.length === 0}
            >
              {cleaning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Dry-Run
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirmOpen(true)}
              disabled={cleaning || report.cleanupCandidates.length === 0}
            >
              <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
              Speicher bereinigen
            </Button>
          </div>

          {report.largePhotos.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {report.largePhotos.length} ältere Fotos liegen über dem neuen Zielwert. Bestehende Medien werden hier nur
              gemeldet; eine echte Neu-Kompression braucht einen separaten, bestätigten Migrationslauf.
            </p>
          )}
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Speicher wirklich bereinigen?</AlertDialogTitle>
            <AlertDialogDescription>
              Es werden nur Dateien gelöscht, die für dieses Event keine Datenbankreferenz mehr haben. Erwartete
              Ersparnis: {formatBytes(report?.totals.cleanupBytes ?? 0)}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => runCleanup(true)}>Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
