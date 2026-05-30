"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { InvitationLinkCard } from "@/components/invitation-link-card";
import { EventMemberList } from "@/components/event-member-list";
import { EventStorageCard } from "@/components/event-storage-card";
import { EventArchiveCard } from "@/components/event-archive-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, AlertCircle, Settings } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import type { EventData, EventMember, Invitation } from "@/lib/event-utils";

export default function EventSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const { member, loading: authLoading } = useAuth();

  const eventId = params.id as string;

  const [event, setEvent] = useState<EventData | null>(null);
  const [members, setMembers] = useState<EventMember[]>([]);
  const [invitation, setInvitation] = useState<Invitation | null>(null);

  const [loadingEvent, setLoadingEvent] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loadingInvitation, setLoadingInvitation] = useState(true);

  const [eventError, setEventError] = useState<string | null>(null);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [invitationError, setInvitationError] = useState<string | null>(null);

  // Fetch event details (to verify organizer status)
  const fetchEvent = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}`);
      if (res.status === 403) {
        router.push("/events");
        return;
      }
      if (res.status === 404) {
        setEventError("Event nicht gefunden.");
        return;
      }
      if (!res.ok) throw new Error("Event konnte nicht geladen werden.");

      const data = await res.json();
      setEvent(data.event);
      setEventError(null);
    } catch (err) {
      setEventError(
        err instanceof Error ? err.message : "Ein Fehler ist aufgetreten."
      );
    } finally {
      setLoadingEvent(false);
    }
  }, [eventId, router]);

  // Fetch event members
  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/members`);
      if (!res.ok) throw new Error("Teilnehmer konnten nicht geladen werden.");

      const data = await res.json();
      setMembers(data.members || []);
      setMembersError(null);
    } catch (err) {
      setMembersError(
        err instanceof Error ? err.message : "Ein Fehler ist aufgetreten."
      );
    } finally {
      setLoadingMembers(false);
    }
  }, [eventId]);

  // Fetch current invitation
  const fetchInvitation = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/invitations`);
      if (res.status === 404) {
        // No invitation yet -- that's fine
        setInvitation(null);
        setInvitationError(null);
        return;
      }
      if (!res.ok)
        throw new Error("Einladungslink konnte nicht geladen werden.");

      const data = await res.json();
      setInvitation(data.invitation || null);
      setInvitationError(null);
    } catch (err) {
      setInvitationError(
        err instanceof Error ? err.message : "Ein Fehler ist aufgetreten."
      );
    } finally {
      setLoadingInvitation(false);
    }
  }, [eventId]);

  // Generate new invitation link
  const handleGenerateInvitation = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/invitations`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          data?.error || "Einladungslink konnte nicht erstellt werden."
        );
      }

      const data = await res.json();
      setInvitation(data.invitation);
      toast.success("Neuer Einladungslink erstellt!");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Ein Fehler ist aufgetreten."
      );
    }
  }, [eventId]);

  // Remove member
  const handleRemoveMember = useCallback(
    async (memberId: string) => {
      try {
        const res = await fetch(
          `/api/events/${eventId}/members/${memberId}`,
          { method: "DELETE" }
        );
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(
            data?.error || "Teilnehmer konnte nicht entfernt werden."
          );
        }

        setMembers((prev) => prev.filter((m) => m.member_id !== memberId));
        toast.success("Teilnehmer entfernt.");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Ein Fehler ist aufgetreten."
        );
      }
    },
    [eventId]
  );

  useEffect(() => {
    if (!authLoading && member) {
      fetchEvent();
      fetchMembers();
      fetchInvitation();
    }
  }, [authLoading, member, fetchEvent, fetchMembers, fetchInvitation]);

  // Check organizer access
  const isOrganizer = event ? event.organizer_id === member?.id : false;

  // Loading state
  if (authLoading || loadingEvent) {
    return (
      <div className="min-h-screen bg-background px-4 py-8">
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9" />
            <Skeleton className="h-8 w-48" />
          </div>
          <Skeleton className="h-48 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (!member) return null;

  // Error state
  if (eventError) {
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
            <AlertDescription>{eventError}</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  if (!event) return null;

  // Only organizer can access settings
  if (!isOrganizer) {
    return (
      <div className="min-h-screen bg-background px-4 py-8">
        <div className="mx-auto max-w-2xl space-y-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/events/${eventId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              Zurück zum Event
            </Link>
          </Button>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>
              Nur der Organisator kann die Einstellungen bearbeiten.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link
              href={`/events/${eventId}`}
              aria-label="Zurück zum Event"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
              <Settings className="h-5 w-5" aria-hidden="true" />
              Einstellungen
            </h1>
            <p className="text-sm text-muted-foreground">{event.name}</p>
          </div>
        </div>

        {/* Invitation Link Card */}
        <InvitationLinkCard
          eventId={eventId}
          eventName={event.name}
          invitation={invitation}
          loading={loadingInvitation}
          error={invitationError}
          onGenerate={handleGenerateInvitation}
        />

        <EventArchiveCard eventId={eventId} />

        <EventStorageCard eventId={eventId} />

        {/* Member List */}
        <EventMemberList
          members={members}
          currentMemberId={member.id}
          isOrganizer={isOrganizer}
          loading={loadingMembers}
          error={membersError}
          onRemoveMember={handleRemoveMember}
        />
      </div>
    </div>
  );
}
