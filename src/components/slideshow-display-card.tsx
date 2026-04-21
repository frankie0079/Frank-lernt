"use client";

// PROJ-34 (2026-04-21): Display view for a section that already has a
// rendered slideshow. Appears at the top of the curation page when
// slideshow_url is set. Two actions:
//   - "Editieren": switches the curation page to edit mode (keeps current
//      selection + storyboard as template, allows re-render).
//   - "Löschen": hard-resets the section (clears slideshow + storyboard +
//      report_items), confirmed via AlertDialog.

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { SlideshowPreviewPlayer } from "@/components/slideshow-preview-player";
import { Film, Pencil, Trash2, Download, Share2, Loader2 } from "lucide-react";

interface Props {
  eventId: string;
  agendaItemId: string;
  slideshowUrl: string;
  durationSec: number | null;
  title: string | null;
  onEdit: () => void;
  onDeleted: () => void;
}

export function SlideshowDisplayCard({
  eventId,
  agendaItemId,
  slideshowUrl,
  durationSec,
  title,
  onEdit,
  onDeleted,
}: Props) {
  const [deleting, setDeleting] = useState(false);
  const [sharing, setSharing] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/events/${eventId}/reports/${agendaItemId}/slideshow`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Löschen fehlgeschlagen");
      }
      toast.success("Slideshow gelöscht");
      onDeleted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Löschen fehlgeschlagen");
    } finally {
      setDeleting(false);
    }
  };

  // Strip the cache-buster query string before extracting the extension —
  // the URL looks like `.../video.mp4?v=1713744000000`, so `endsWith(".mp4")`
  // on the full URL returns false and we'd mistakenly treat MP4 files as
  // webm. That's what broke WhatsApp-Teilen.
  const pathOnly = slideshowUrl.split("?")[0];
  const extension: "mp4" | "webm" = pathOnly.endsWith(".mp4") ? "mp4" : "webm";
  const mimeType = extension === "mp4" ? "video/mp4" : "video/webm";
  // Sanitize filename: strip anything that isn't alphanumeric, space, dash,
  // underscore. iOS Share Sheet + WhatsApp refuse filenames with certain
  // characters (colons, slashes).
  const safeTitle = (title ?? "film")
    .replace(/[^\p{L}\p{N} _-]/gu, "")
    .trim()
    .slice(0, 80) || "film";
  const filename = `${safeTitle}.${extension}`;

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = slideshowUrl;
    a.download = filename;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleShare = async () => {
    setSharing(true);
    try {
      const res = await fetch(slideshowUrl);
      if (!res.ok) {
        throw new Error(`Download fehlgeschlagen (${res.status})`);
      }
      const remoteBlob = await res.blob();
      // Force the MIME type we know is correct — remote CDN sometimes
      // returns octet-stream which WhatsApp rejects.
      const typedBlob = new Blob([remoteBlob], { type: mimeType });
      const file = new File([typedBlob], filename, { type: mimeType });

      if (typeof navigator === "undefined" || !navigator.share) {
        toast.error("Teilen wird von diesem Browser nicht unterstützt — nutze Herunterladen.");
        return;
      }
      // Some browsers implement `share` but not `canShare`; only call
      // canShare if available, otherwise attempt share + catch.
      if (navigator.canShare && !navigator.canShare({ files: [file] })) {
        toast.error("Dateityp wird nicht unterstützt — nutze Herunterladen.");
        return;
      }
      await navigator.share({ files: [file], title: safeTitle });
    } catch (err) {
      // AbortError = user dismissed the share sheet; not an error.
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("[slideshow] share failed:", err);
      const msg = err instanceof Error ? err.message : "Teilen fehlgeschlagen";
      toast.error(`Teilen fehlgeschlagen: ${msg}`, { duration: 10000 });
    } finally {
      setSharing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Film className="h-5 w-5 text-primary" aria-hidden="true" />
          {title ?? "Slideshow"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-center">
          <SlideshowPreviewPlayer src={slideshowUrl} format="portrait" />
        </div>
        {durationSec != null && (
          <div className="text-center text-xs text-muted-foreground">
            Dauer: {durationSec}s
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleDownload} variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Herunterladen
          </Button>
          <Button onClick={handleShare} variant="outline" size="sm" disabled={sharing}>
            {sharing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Share2 className="mr-2 h-4 w-4" />
            )}
            Teilen
          </Button>
        </div>
        <div className="flex gap-2 pt-2 border-t">
          <Button onClick={onEdit} variant="default" size="sm" className="flex-1">
            <Pencil className="mr-2 h-4 w-4" />
            Editieren
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={deleting} className="flex-1">
                {deleting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Löschen
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Slideshow wirklich löschen?</AlertDialogTitle>
                <AlertDialogDescription>
                  Der Film wird entfernt, das Storyboard und die Foto-Auswahl
                  dieses Tages werden zurückgesetzt. Beim nächsten Öffnen
                  startest du mit einer leeren Auswahl.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>
                  Löschen
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
