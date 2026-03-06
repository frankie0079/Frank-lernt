"use client";

import { useState, useCallback } from "react";
import { Plus, MapPin, Calendar, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DiaryEntry } from "@/lib/types";
import { DiaryEntryForm } from "@/components/diary-entry-form";
import { ShareButton } from "@/components/share-button";

interface TagebuchClientProps {
  tourId: string;
  tourName: string;
  initialEntries: DiaryEntry[];
}

export function TagebuchClient({ tourId, tourName, initialEntries }: TagebuchClientProps) {
  const [entries, setEntries] = useState<DiaryEntry[]>(initialEntries);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);

  // Show a temporary toast notification
  const showToast = useCallback((message: string, type: "error" | "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Optimistic: add entry immediately to the list
  const handleOptimisticAdd = useCallback((tempEntry: DiaryEntry) => {
    setPendingIds((prev) => new Set(prev).add(tempEntry.id));
    setEntries((prev) => {
      // Insert in correct position (sorted by entry_date descending)
      const updated = [tempEntry, ...prev];
      updated.sort((a, b) => b.entry_date.localeCompare(a.entry_date));
      return updated;
    });
  }, []);

  // Server confirmed: swap temp ID with real server entry
  const handleServerConfirm = useCallback((tempId: string, serverEntry: DiaryEntry) => {
    setPendingIds((prev) => {
      const next = new Set(prev);
      next.delete(tempId);
      return next;
    });
    setEntries((prev) =>
      prev.map((e) => (e.id === tempId ? serverEntry : e))
    );
  }, []);

  // Server error: remove optimistic entry and show error
  const handleServerError = useCallback((tempId: string, errorMessage: string) => {
    setPendingIds((prev) => {
      const next = new Set(prev);
      next.delete(tempId);
      return next;
    });
    setEntries((prev) => prev.filter((e) => e.id !== tempId));
    showToast(errorMessage, "error");
  }, [showToast]);

  return (
    <>
      {/* Entry list or empty state */}
      {entries.length === 0 ? (
        <EmptyState onAdd={() => setIsFormOpen(true)} />
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <DiaryEntryCard
              key={entry.id}
              entry={entry}
              tourName={tourName}
              isPending={pendingIds.has(entry.id)}
            />
          ))}
        </div>
      )}

      {/* FAB for new entry */}
      {entries.length > 0 && (
        <button
          onClick={() => setIsFormOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
          aria-label="Neuer Tagebuch-Eintrag"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      {/* New entry form (Sheet) */}
      <DiaryEntryForm
        tourId={tourId}
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
        onOptimisticAdd={handleOptimisticAdd}
        onServerConfirm={handleServerConfirm}
        onServerError={handleServerError}
      />

      {/* Toast notification for errors */}
      {toast && (
        <div
          role="alert"
          className={`fixed bottom-22 left-1/2 -translate-x-1/2 z-50 rounded-lg px-4 py-3 text-sm font-medium shadow-lg transition-opacity ${
            toast.type === "error"
              ? "bg-destructive text-destructive-foreground"
              : "bg-primary text-primary-foreground"
          }`}
        >
          {toast.message}
        </div>
      )}
    </>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <BookIcon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold text-foreground mb-1">
        Noch keine Einträge
      </h2>
      <p className="text-muted-foreground mb-6 max-w-xs">
        Starte dein Tagebuch und halte eure Erlebnisse fest!
      </p>
      <Button onClick={onAdd} className="gap-2">
        <Plus className="h-4 w-4" />
        Erster Eintrag
      </Button>
    </div>
  );
}

function BookIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
    </svg>
  );
}

interface DiaryEntryCardProps {
  entry: DiaryEntry;
  tourName: string;
  isPending?: boolean;
}

function DiaryEntryCard({ entry, tourName, isPending }: DiaryEntryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLong = entry.content.length > 200;
  const displayText = isExpanded || !isLong
    ? entry.content
    : entry.content.slice(0, 200) + "...";

  const formattedDate = new Date(entry.entry_date).toLocaleDateString("de-CH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Card className={isPending ? "opacity-70" : undefined}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg leading-snug">{entry.title}</CardTitle>
            {isPending && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" aria-label="Wird gespeichert" />
            )}
          </div>
          {!isPending && (
            <ShareButton
              title={`${entry.title} — ${tourName}`}
              text={`${entry.title} — Tagebuch von ${tourName}`}
              url={typeof window !== "undefined" ? window.location.href : ""}
            />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formattedDate}
          </span>
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {entry.author_name}
          </span>
          {entry.gps_lat != null && entry.gps_lng != null && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0">
              <MapPin className="h-3 w-3 mr-0.5" />
              GPS
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
          {displayText}
        </p>
        {isLong && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-2 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
          >
            {isExpanded ? "Weniger anzeigen" : "Mehr lesen"}
          </button>
        )}
      </CardContent>
    </Card>
  );
}
