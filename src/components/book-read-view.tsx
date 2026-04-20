"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { BookPageLayout } from "@/components/book-page-layout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Eye,
  Pencil,
} from "lucide-react";
import type { BookGetResponse, BookPage } from "@/lib/book-types";

interface BookReadViewProps {
  eventId: string;
  /** If true, renders _all_ pages including hidden ones (editor preview). */
  preview?: boolean;
}

function formatDayHeader(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function BookReadView({ eventId, preview = false }: BookReadViewProps) {
  const { member, loading: authLoading } = useAuth();

  const [pages, setPages] = useState<BookPage[]>([]);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [eventName, setEventName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const fetchBook = useCallback(async () => {
    setLoading(true);
    try {
      const [eventRes, bookRes] = await Promise.all([
        fetch(`/api/events/${eventId}`),
        fetch(`/api/events/${eventId}/book`),
      ]);

      if (eventRes.status === 403 || bookRes.status === 403) {
        setForbidden(true);
        return;
      }
      if (!bookRes.ok) {
        const data = await bookRes.json().catch(() => ({}));
        throw new Error(data.error || "Tagebuch konnte nicht geladen werden.");
      }

      const bookData = (await bookRes.json()) as BookGetResponse;
      setPages(bookData.pages || []);
      setIsOrganizer(!!bookData.is_organizer);

      if (eventRes.ok) {
        const eventData = await eventRes.json();
        setEventName(eventData.event?.name || "");
      }

      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ein Fehler ist aufgetreten."
      );
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (!authLoading && member) fetchBook();
  }, [authLoading, member, fetchBook]);

  if (authLoading || loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!member) return null;

  if (forbidden) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/events/${eventId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            Zurück zum Event
          </Link>
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>
            Du hast keinen Zugriff auf das Tagebuch dieses Events.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/events/${eventId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            Zurück
          </Link>
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={fetchBook} variant="outline" size="sm">
          Erneut versuchen
        </Button>
      </div>
    );
  }

  // Hide invisible pages in the live read view; show them in preview mode.
  const visiblePages = preview ? pages : pages.filter((p) => p.is_visible);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/events/${eventId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            Zurück zum Event
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          {preview && (
            <Badge variant="outline" className="gap-1">
              <Eye className="h-3 w-3" aria-hidden="true" />
              Vorschau
            </Badge>
          )}
          {isOrganizer && !preview && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/events/${eventId}/book/edit`}>
                <Pencil className="mr-1 h-4 w-4" aria-hidden="true" />
                Bearbeiten
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Title */}
      <div>
        <h1 className="font-[family-name:var(--font-caveat)] text-5xl font-bold leading-tight text-foreground">
          Tagebuch
        </h1>
        {eventName && (
          <p className="mt-1 text-base text-muted-foreground">{eventName}</p>
        )}
      </div>

      {/* Empty state */}
      {visiblePages.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <BookOpen
            className="mx-auto mb-3 h-10 w-10 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="text-sm font-medium text-foreground">
            Das Tagebuch ist noch leer.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {isOrganizer
              ? "Starte mit der ersten Seite im Editor."
              : "Der Organisator hat noch keine Seiten veröffentlicht."}
          </p>
          {isOrganizer && (
            <Button asChild variant="default" size="sm" className="mt-4">
              <Link href={`/events/${eventId}/book/edit`}>
                <Pencil className="mr-1 h-4 w-4" aria-hidden="true" />
                Tagebuch starten
              </Link>
            </Button>
          )}
        </div>
      )}

      {/* Day sections */}
      {visiblePages.map((page) => {
        const dayLabel = formatDayHeader(page.agenda_date);
        return (
          <section
            key={page.id}
            id={`day-${page.agenda_item_id}`}
            className="space-y-3 border-t border-border pt-6 first:border-t-0 first:pt-0"
            aria-labelledby={`day-title-${page.agenda_item_id}`}
          >
            <header className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {dayLabel}
              </p>
              <h2
                id={`day-title-${page.agenda_item_id}`}
                className="font-[family-name:var(--font-caveat)] text-3xl font-bold leading-tight text-foreground"
              >
                {page.agenda_title}
              </h2>
              {preview && !page.is_visible && (
                <Badge variant="outline" className="mt-1 text-[10px]">
                  versteckt — nur in der Vorschau sichtbar
                </Badge>
              )}
            </header>

            <BookPageLayout
              layout={page.layout}
              items={page.items}
              sideText={page.comment}
            />

            {/* Only the text-left layout renders the comment inside the layout
                itself; for other layouts we render it as a caption below. */}
            {page.layout !== "text-left" && page.comment && (
              <p className="whitespace-pre-wrap text-base leading-relaxed text-foreground">
                {page.comment}
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}
