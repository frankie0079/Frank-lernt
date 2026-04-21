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

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = slideshowUrl;
    a.download = `film-${title ?? "tag"}.${slideshowUrl.endsWith(".mp4") ? "mp4" : "webm"}`;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleShare = async () => {
    setSharing(true);
    try {
      // Fetch the remote blob so it can be shared as a file via navigator.share.
      const res = await fetch(slideshowUrl);
      const blob = await res.blob();
      const ext = slideshowUrl.endsWith(".mp4") ? "mp4" : "webm";
      const file = new File([blob], `film-${title ?? "tag"}.${ext}`, { type: blob.type });
      if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: title ?? "Film" });
      } else {
        toast.error("Teilen wird vom Browser nicht unterstützt — bitte herunterladen.");
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        /* user cancelled */
      } else {
        toast.error("Teilen fehlgeschlagen");
      }
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
