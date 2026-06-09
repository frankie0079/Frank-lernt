"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ReportEditor } from "@/components/report-editor";
import type { EventData, AgendaItem } from "@/lib/event-utils";
import { ArrowLeft, AlertCircle } from "lucide-react";

export default function CurationPage() {
  const params = useParams();
  const router = useRouter();
  const { member, loading: authLoading } = useAuth();

  const eventId = params.id as string;
  const agendaItemId = params.agendaItemId as string;

  const [event, setEvent] = useState<EventData | null>(null);
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvent = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}`);
      if (res.status === 403) {
        toast.error("Kein Zugriff auf dieses Event");
        router.push(`/events`);
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
      <div className="min-h-screen bg-background px-4 py-6">
        <div className="mx-auto max-w-2xl space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!member) return null;

  if (error) {
    return (
      <div className="min-h-screen bg-background px-4 py-6">
        <div className="mx-auto max-w-2xl space-y-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/events/${eventId}/admin`}>
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

  const isOrganizer = event.organizer_id === member.id;
  const agendaItem = agendaItems.find((a) => a.id === agendaItemId);

  return (
    <div className="min-h-screen bg-background px-4 py-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/events/${eventId}/admin`}>
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            Zurück zur Übersicht
          </Link>
        </Button>

        <ReportEditor
          eventId={eventId}
          agendaItemId={agendaItemId}
          userId={member.id}
          isOrganizer={isOrganizer}
          agendaItems={agendaItems}
          agendaTitle={agendaItem?.title}
          eventCoverUrl={event.cover_url}
        />
      </div>
    </div>
  );
}
