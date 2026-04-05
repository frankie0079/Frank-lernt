"use client";

import { useState, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CaptionTextarea } from "@/components/caption-textarea";
import { enqueue } from "@/lib/offline-queue";
import { CONTENT_MAX_CAPTION_LENGTH } from "@/lib/validations/content";
import { Loader2, AlertCircle, X } from "lucide-react";
import type { GpsPosition } from "@/hooks/use-geolocation";

interface TextCommentSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  agendaItemId: string | null;
  gpsPosition: GpsPosition | null;
  onSubmitSuccess: () => void;
}

/**
 * Bottom sheet for submitting a text-only comment.
 */
export function TextCommentSheet({
  open,
  onOpenChange,
  eventId,
  agendaItemId,
  gpsPosition,
  onSubmitSuccess,
}: TextCommentSheetProps) {
  const [caption, setCaption] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        setCaption("");
        setError(null);
      }
      onOpenChange(isOpen);
    },
    [onOpenChange]
  );

  const handleSubmit = useCallback(async () => {
    const trimmed = caption.trim();
    if (!trimmed) {
      setError("Bitte gib einen Kommentar ein.");
      return;
    }

    if (trimmed.length > CONTENT_MAX_CAPTION_LENGTH) {
      setError(`Kommentar zu lang (max. ${CONTENT_MAX_CAPTION_LENGTH} Zeichen)`);
      return;
    }

    setSubmitting(true);
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
        throw new Error(
          data?.error || "Kommentar konnte nicht gespeichert werden."
        );
      }

      // Haptic feedback on iOS
      if (navigator.vibrate) {
        navigator.vibrate([50]);
      }

      onSubmitSuccess();
      handleOpenChange(false);
    } catch (err) {
      // If network error, queue for offline retry
      if (err instanceof TypeError && err.message.includes("fetch")) {
        try {
          await enqueue(eventId, {
            type: "text",
            agenda_item_id: agendaItemId,
            caption: trimmed,
            latitude: gpsPosition?.latitude ?? null,
            longitude: gpsPosition?.longitude ?? null,
          });
          setError(
            "Kein Netz \u2014 Beitrag wird automatisch gesendet, sobald du wieder online bist."
          );
        } catch {
          setError("Kommentar konnte nicht gespeichert werden.");
        }
      } else {
        setError(
          err instanceof Error ? err.message : "Ein Fehler ist aufgetreten."
        );
      }
    } finally {
      setSubmitting(false);
    }
  }, [caption, eventId, agendaItemId, gpsPosition, onSubmitSuccess, handleOpenChange]);

  const isOverLimit = caption.length > CONTENT_MAX_CAPTION_LENGTH;
  const isEmpty = caption.trim().length === 0;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-w-lg rounded-t-2xl px-4 pb-6 pt-4 max-h-[90vh] overflow-y-auto"
      >
        <SheetHeader className="text-left">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg">Text-Beitrag</SheetTitle>
            {!submitting && (
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
          <CaptionTextarea
            value={caption}
            onChange={setCaption}
            placeholder="Was moechtest du teilen?"
            required
            disabled={submitting}
          />

          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <SheetFooter className="mt-4 flex-row gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            Abbrechen
          </Button>
          <Button
            className="flex-1"
            onClick={handleSubmit}
            disabled={submitting || isOverLimit || isEmpty}
          >
            {submitting ? (
              <>
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
                Speichern...
              </>
            ) : (
              "Absenden"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
