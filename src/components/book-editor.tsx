"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { BookDaySidebar } from "@/components/book-day-sidebar";
import { BookPageEditor } from "@/components/book-page-editor";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ArrowLeft, BookOpen, Eye } from "lucide-react";
import type { AgendaItem, EventData } from "@/lib/event-utils";
import type { BookGetResponse, BookPage } from "@/lib/book-types";

interface BookEditorProps {
  eventId: string;
}

export function BookEditor({ eventId }: BookEditorProps) {
  const router = useRouter();
  const { member, loading: authLoading } = useAuth();

  const [event, setEvent] = useState<EventData | null>(null);
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const [pages, setPages] = useState<BookPage[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const fetchAll = useCallback(async () => {
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
      if (!eventRes.ok) {
        const data = await eventRes.json().catch(() => ({}));
        throw new Error(data.error || "Event konnte nicht geladen werden.");
      }
      if (!bookRes.ok) {
        const data = await bookRes.json().catch(() => ({}));
        throw new Error(data.error || "Tagebuch konnte nicht geladen werden.");
      }

      const eventData = await eventRes.json();
      const bookData = (await bookRes.json()) as BookGetResponse;

      setEvent(eventData.event);
      setAgendaItems(eventData.agenda_items || []);
      setPages(bookData.pages || []);
      // Preselect first visible page, fallback to first page overall
      const first =
        (bookData.pages || []).find((p) => p.is_visible) ||
        (bookData.pages || [])[0] ||
        null;
      setActiveId(first ? first.agenda_item_id : null);
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
    if (!authLoading && member) fetchAll();
  }, [authLoading, member, fetchAll]);

  const activePage = useMemo(
    () => pages.find((p) => p.agenda_item_id === activeId) || null,
    [pages, activeId]
  );

  const isOrganizer = !!event && !!member && event.organizer_id === member.id;

  // Redirect non-organizers to the read-view (server RLS would also block the API).
  useEffect(() => {
    if (!loading && event && member && !isOrganizer) {
      toast.info("Nur der Organisator kann das Tagebuch bearbeiten");
      router.replace(`/events/${eventId}/book`);
    }
  }, [loading, event, member, isOrganizer, router, eventId]);

  const handleSaved = useCallback(
    (updated: BookPage) => {
      setPages((prev) =>
        prev.map((p) => (p.agenda_item_id === updated.agenda_item_id ? updated : p))
      );
    },
    []
  );

  const handleOpenPreview = useCallback(() => {
    router.push(
      `/events/${eventId}/book?preview=true${
        activeId ? `#day-${activeId}` : ""
      }`
    );
  }, [router, eventId, activeId]);

  // ---- render branches ----
  if (authLoading || loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-[240px_1fr]">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
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
        <Button onClick={fetchAll} variant="outline" size="sm">
          Erneut versuchen
        </Button>
      </div>
    );
  }

  if (!event) return null;

  if (pages.length === 0 || agendaItems.length === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/events/${eventId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            Zurück
          </Link>
        </Button>

        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <BookOpen
            className="mx-auto mb-3 h-10 w-10 text-muted-foreground"
            aria-hidden="true"
          />
          <h1 className="font-display text-3xl font-bold text-foreground">
            Tagebuch
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Lege zuerst Agenda-Tage im Event an — jeder Tag wird automatisch zu
            einer Tagebuch-Seite.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link href={`/events/${eventId}`}>Zum Event</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-3 overflow-x-hidden px-3 py-4 sm:space-y-4 sm:px-4 sm:py-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/events/${eventId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              Zurück
            </Link>
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenPreview}
            aria-label="Vorschau im neuen Tab öffnen"
          >
            <Eye className="mr-1 h-4 w-4" aria-hidden="true" />
            Vorschau
          </Button>
          <Button variant="secondary" size="sm" asChild>
            <Link href={`/events/${eventId}/book`}>
              <BookOpen className="mr-1 h-4 w-4" aria-hidden="true" />
              Leseansicht
            </Link>
          </Button>
        </div>
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground sm:font-display sm:text-4xl sm:font-bold">
          Tagebuch bearbeiten
        </h1>
        <p className="text-xs leading-snug text-muted-foreground sm:text-sm">
          Jeder Tag kann aus mehreren Seiten bestehen — wie in einem
          Fotobuch. Pro Seite wählst du ein Layout (1-5 Fotos oder ein
          Raster) und schreibst einen kurzen Kommentar. Alles wird
          automatisch gespeichert.
        </p>
      </div>

      {/* Layout: sidebar + editor */}
      <div className="grid min-w-0 gap-3 md:grid-cols-[260px_minmax(0,1fr)] md:gap-4">
        <BookDaySidebar
          pages={pages}
          activeAgendaItemId={activeId}
          onSelect={setActiveId}
        />

        <div className="min-w-0 max-w-full">
          {activePage ? (
            <BookPageEditor
              key={activePage.agenda_item_id}
              eventId={eventId}
              userId={member.id}
              isOrganizer={isOrganizer}
              agendaItems={agendaItems}
              page={activePage}
              onSaved={handleSaved}
              onOpenPreview={handleOpenPreview}
            />
          ) : (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Wähle einen Tag aus der Seitenleiste.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
