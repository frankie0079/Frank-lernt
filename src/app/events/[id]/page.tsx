"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { EventEditSheet } from "@/components/event-edit-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  type EventData,
  type AgendaItem,
  computeEventStatus,
  generateEventGradient,
  formatDateRange,
} from "@/lib/event-utils";
import { WandererScreen } from "@/components/wanderer-screen";
import { ContentPool } from "@/components/content-pool";
import { SlideshowFeed } from "@/components/slideshow-feed";
import {
  ArrowLeft,
  CalendarDays,
  Users,
  Pencil,
  AlertCircle,
  Camera,
  LayoutGrid,
  Shield,
  BookOpen,
  Settings,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  planned: { label: "Geplant", variant: "secondary" },
  active: { label: "Aktiv", variant: "default" },
  archived: { label: "Archiviert", variant: "outline" },
};

export default function EventDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const { member, loading: authLoading } = useAuth();

  const [event, setEvent] = useState<EventData | null>(null);
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const eventId = params.id as string;

  const fetchEvent = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}`);
      if (res.status === 403) {
        router.push("/events");
        return;
      }
      if (res.status === 404) {
        setError("Event nicht gefunden.");
        return;
      }
      if (!res.ok) {
        throw new Error("Event konnte nicht geladen werden.");
      }

      const data = await res.json();
      setEvent(data.event);
      setAgendaItems(data.agenda_items || []);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ein Fehler ist aufgetreten."
      );
    } finally {
      setLoading(false);
    }
  }, [eventId, router]);

  useEffect(() => {
    if (!authLoading && member) {
      fetchEvent();
    }
  }, [authLoading, member, fetchEvent]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Skeleton className="h-48 w-full" />
        <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!member) return null;

  if (error) {
    return (
      <div className="min-h-screen bg-background px-4 py-8">
        <div className="mx-auto max-w-2xl space-y-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/events">
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              Zurück
            </Link>
          </Button>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  if (!event) return null;

  const status = computeEventStatus(event.start_date, event.end_date);
  const config = statusConfig[status];
  const gradient = generateEventGradient(event.name);
  const dateRange = formatDateRange(event.start_date, event.end_date);
  const isOrganizer = event.organizer_id === member.id;

  return (
    <div className="min-h-screen bg-background">
      {/* Cover / Header */}
      <div
        className="relative h-64 w-full overflow-hidden md:h-80"
        style={!event.cover_url ? { background: gradient } : undefined}
      >
        {event.cover_url && (
          <img
            src={event.cover_url}
            alt={`Cover von ${event.name}`}
            className="h-full w-full object-cover"
            style={{
              objectPosition: event.cover_position || "center",
              transform: event.cover_scale != null && event.cover_scale !== 1 ? `scale(${event.cover_scale})` : undefined,
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

        {/* Back button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-3 top-3 h-9 w-9 rounded-full bg-black/30 text-white hover:bg-black/50"
          asChild
        >
          <Link href="/events" aria-label="Zurück zu Meine Events">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>

        {/* Organizer actions */}
        {isOrganizer && (
          <div className="absolute right-3 top-3 flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full bg-black/30 text-white hover:bg-black/50"
              asChild
            >
              <Link
                href={`/events/${eventId}/settings`}
                aria-label="Event-Einstellungen"
              >
                <Settings className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full bg-black/30 text-white hover:bg-black/50"
              onClick={() => setEditOpen(true)}
              aria-label="Event bearbeiten"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        )}

      </div>

      {/* Event Title + Meta */}
      <div className="mx-auto max-w-2xl px-4 py-4">
        <h1 className="mb-2 font-[family-name:var(--font-caveat)] text-3xl font-bold text-foreground leading-tight">
          {event.name}
        </h1>
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            {dateRange}
          </span>
          {event.member_count != null && (
            isOrganizer ? (
              <Link
                href={`/events/${eventId}/settings`}
                className="flex items-center gap-1 hover:text-foreground transition-colors"
              >
                <Users className="h-4 w-4" aria-hidden="true" />
                {event.member_count} Teilnehmer
              </Link>
            ) : (
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" aria-hidden="true" />
                {event.member_count} Teilnehmer
              </span>
            )
          )}
        </div>
        {event.description && (
          <p className="mt-2 text-sm text-muted-foreground">
            {event.description}
          </p>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="mx-auto max-w-2xl px-4 pb-8">
        <Tabs defaultValue="capture" className="w-full">
          <TabsList className="w-full grid grid-cols-4 h-auto p-1">
            <TabsTrigger value="capture" className="flex flex-col items-center gap-0.5 py-2 text-[10px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md sm:flex-row sm:gap-1 sm:text-sm">
              <Camera className="h-4 w-4" aria-hidden="true" />
              <span>Erfassen</span>
            </TabsTrigger>
            <TabsTrigger value="pool" className="flex flex-col items-center gap-0.5 py-2 text-[10px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md sm:flex-row sm:gap-1 sm:text-sm">
              <LayoutGrid className="h-4 w-4" aria-hidden="true" />
              <span>Sammlung</span>
            </TabsTrigger>
            <TabsTrigger value="admin" className="flex flex-col items-center gap-0.5 py-2 text-[10px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md sm:flex-row sm:gap-1 sm:text-sm">
              <Shield className="h-4 w-4" aria-hidden="true" />
              <span>Kuratieren</span>
            </TabsTrigger>
            <TabsTrigger value="book" className="flex flex-col items-center gap-0.5 py-2 text-[10px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md sm:flex-row sm:gap-1 sm:text-sm">
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              <span>Tagebuch</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="capture" className="mt-6">
            <WandererScreen
              eventId={eventId}
              userId={member.id}
              agendaItems={agendaItems}
            />
          </TabsContent>

          <TabsContent value="pool" className="mt-6">
            <Suspense fallback={<Skeleton className="h-64 w-full" />}>
              <ContentPool
                eventId={eventId}
                userId={member.id}
                isOrganizer={isOrganizer}
                agendaItems={agendaItems}
              />
            </Suspense>
          </TabsContent>

          <TabsContent value="admin" className="mt-6">
            {agendaItems.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center">
                <Shield className="mx-auto mb-3 h-8 w-8 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm font-medium text-foreground">Keine Tages-Abschnitte</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Lege zuerst Agenda-Punkte unter &quot;Bearbeiten&quot; an.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Wähle einen Tag zum Kuratieren und zur Slideshow-Erstellung:
                </p>
                {agendaItems
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((item) => {
                    const itemDate = new Date(item.date + "T00:00:00");
                    return (
                      <Link
                        key={item.id}
                        href={`/events/${eventId}/admin/${item.id}`}
                        className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        <div className="flex flex-col items-center justify-center rounded-md bg-muted px-3 py-1 text-center">
                          <span className="text-xs font-medium text-muted-foreground">
                            {itemDate.toLocaleDateString("de-DE", { weekday: "short" })}
                          </span>
                          <span className="text-lg font-bold text-foreground">{itemDate.getDate()}</span>
                          <span className="text-xs text-muted-foreground">
                            {itemDate.toLocaleDateString("de-DE", { month: "short" })}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-foreground">{item.title}</h3>
                          {item.description && (
                            <p className="mt-0.5 text-sm text-muted-foreground line-clamp-1">
                              {item.description}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                      </Link>
                    );
                  })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="book" className="mt-6">
            <SlideshowFeed eventId={eventId} />
          </TabsContent>
        </Tabs>

        {/* Agenda Section */}
        {agendaItems.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-4 font-[family-name:var(--font-caveat)] text-4xl font-bold text-foreground leading-none">
              Agenda
            </h2>
            <div className="space-y-3">
              {agendaItems
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((item) => {
                  const itemDate = new Date(item.date + "T00:00:00");
                  return (
                    <div
                      key={item.id}
                      className="flex gap-3 rounded-lg border border-border p-3"
                    >
                      <div className="flex flex-col items-center justify-center rounded-md bg-muted px-3 py-1 text-center">
                        <span className="text-xs font-medium text-muted-foreground">
                          {itemDate.toLocaleDateString("de-DE", {
                            weekday: "short",
                          })}
                        </span>
                        <span className="text-lg font-bold text-foreground">
                          {itemDate.getDate()}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {itemDate.toLocaleDateString("de-DE", {
                            month: "short",
                          })}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-[family-name:var(--font-caveat)] text-2xl font-bold text-foreground leading-tight">
                          {item.title}
                        </h3>
                        {item.description && (
                          <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {/* Edit Sheet */}
      {isOrganizer && (
        <EventEditSheet
          open={editOpen}
          onOpenChange={setEditOpen}
          event={event}
          agendaItems={agendaItems}
          onEventUpdated={fetchEvent}
        />
      )}
    </div>
  );
}
