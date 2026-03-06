"use client";

import { useState } from "react";
import { MapPin, Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DiaryEntry } from "@/lib/types";

interface DiaryEntryFormProps {
  tourId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onOptimisticAdd: (tempEntry: DiaryEntry) => void;
  onServerConfirm: (tempId: string, serverEntry: DiaryEntry) => void;
  onServerError: (tempId: string, errorMessage: string) => void;
}

function todayDateString(): string {
  return new Date().toISOString().split("T")[0];
}

export function DiaryEntryForm({
  tourId,
  isOpen,
  onOpenChange,
  onOptimisticAdd,
  onServerConfirm,
  onServerError,
}: DiaryEntryFormProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [entryDate, setEntryDate] = useState(todayDateString);
  const [authorName, setAuthorName] = useState("");
  const [gpsLat, setGpsLat] = useState<number | null>(null);
  const [gpsLng, setGpsLng] = useState<number | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setTitle("");
    setContent("");
    setEntryDate(todayDateString());
    setAuthorName("");
    setGpsLat(null);
    setGpsLng(null);
    setError(null);
  }

  function handleOpenChange(open: boolean) {
    if (!open && !isSaving) {
      resetForm();
    }
    onOpenChange(open);
  }

  async function handleLocate() {
    if (!navigator.geolocation) {
      setError("GPS ist auf diesem Gerät nicht verfügbar.");
      return;
    }

    setIsLocating(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsLat(position.coords.latitude);
        setGpsLng(position.coords.longitude);
        setIsLocating(false);
      },
      (err) => {
        setError(
          err.code === 1
            ? "GPS-Zugriff wurde verweigert."
            : "GPS-Position konnte nicht ermittelt werden."
        );
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim()) {
      setError("Bitte einen Titel eingeben.");
      return;
    }

    setIsSaving(true);
    setError(null);

    const resolvedAuthor = authorName.trim() || "Anonym";
    const resolvedDate = entryDate || todayDateString();

    // Create optimistic entry with a temporary ID
    const tempId = `temp-${crypto.randomUUID()}`;
    const optimisticEntry: DiaryEntry = {
      id: tempId,
      tour_id: tourId,
      title: title.trim(),
      content: content.trim(),
      entry_date: resolvedDate,
      author_name: resolvedAuthor,
      gps_lat: gpsLat,
      gps_lng: gpsLng,
      created_at: new Date().toISOString(),
    };

    // Immediately show entry in list and close the sheet
    onOptimisticAdd(optimisticEntry);
    onOpenChange(false);
    resetForm();
    setIsSaving(false);

    // Persist to server in the background
    try {
      const body = {
        title: optimisticEntry.title,
        content: optimisticEntry.content,
        author_name: optimisticEntry.author_name,
        entry_date: optimisticEntry.entry_date,
        gps_lat: optimisticEntry.gps_lat,
        gps_lng: optimisticEntry.gps_lng,
      };

      const res = await fetch(`/api/tours/${tourId}/diary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Fehler beim Speichern.");
      }

      const serverEntry: DiaryEntry = await res.json();
      onServerConfirm(tempId, serverEntry);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unbekannter Fehler.";
      onServerError(tempId, message);
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Neuer Eintrag</SheetTitle>
          <SheetDescription>
            Halte deine Erlebnisse im Tagebuch fest.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4 px-1">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="diary-title">Titel *</Label>
            <Input
              id="diary-title"
              placeholder='z.B. "Tag 3: Von Zambujeira nach Odeceixe"'
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              required
              autoFocus
            />
          </div>

          {/* Content */}
          <div className="space-y-1.5">
            <Label htmlFor="diary-content">Text</Label>
            <Textarea
              id="diary-content"
              placeholder="Was habt ihr heute erlebt?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              className="resize-none"
            />
          </div>

          {/* Entry date */}
          <div className="space-y-1.5">
            <Label htmlFor="diary-date">Datum</Label>
            <Input
              id="diary-date"
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
            />
          </div>

          {/* Author */}
          <div className="space-y-1.5">
            <Label htmlFor="diary-author">Dein Name (optional)</Label>
            <Input
              id="diary-author"
              placeholder="Anonym"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              maxLength={100}
            />
          </div>

          {/* GPS */}
          <div className="space-y-1.5">
            <Label>Standort</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleLocate}
                disabled={isLocating}
                className="gap-1.5"
              >
                {isLocating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MapPin className="h-4 w-4" />
                )}
                {gpsLat != null ? "Aktualisieren" : "GPS erfassen"}
              </Button>
              {gpsLat != null && gpsLng != null && (
                <span className="text-xs text-muted-foreground">
                  {gpsLat.toFixed(4)}, {gpsLng.toFixed(4)}
                </span>
              )}
            </div>
          </div>

          {/* Error message */}
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={isSaving} className="flex-1 gap-1.5">
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Speichern
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSaving}
            >
              Abbrechen
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
