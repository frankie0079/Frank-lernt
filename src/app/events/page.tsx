"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/auth-provider";
import { EventCard } from "@/components/event-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { EventData } from "@/lib/event-utils";
import { Plus, User, CalendarDays, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function EventsPage() {
  const { member, loading: authLoading } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState<EventData[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check for pending redirect (e.g. from invite flow)
  useEffect(() => {
    const redirect = localStorage.getItem("post_login_redirect");
    if (redirect && redirect.startsWith("/")) {
      localStorage.removeItem("post_login_redirect");
      router.replace(redirect);
    }
  }, [router]);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/events");
      if (!res.ok) {
        throw new Error("Events konnten nicht geladen werden.");
      }
      const data = await res.json();
      setEvents(data.events || []);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ein Fehler ist aufgetreten."
      );
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && member) {
      fetchEvents();
    }
  }, [authLoading, member, fetchEvents]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background px-4 py-8">
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-10 w-10 rounded-full" />
          </div>
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!member) {
    return null; // Middleware redirects to /login
  }

  const displayName = member.name ?? "Anonym";
  const initials = member.name
    ? member.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : null;

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <h1 className="min-w-0 truncate font-display text-3xl font-bold text-foreground leading-none sm:text-4xl">
            Meine Events
          </h1>
          <div className="flex shrink-0 items-center gap-3">
            <Button size="icon" className="h-12 w-12 rounded-full shadow-md" asChild>
              <Link href="/events/new" aria-label="Neues Event erstellen">
                <Plus className="h-6 w-6" aria-hidden="true" />
              </Link>
            </Button>
            <Link href="/profile" aria-label="Profil bearbeiten">
              <Avatar className="h-12 w-12 cursor-pointer ring-2 ring-border hover:ring-primary transition-all">
                <AvatarImage
                  src={member.avatar_url ?? undefined}
                  alt={displayName}
                />
                <AvatarFallback className="bg-primary/10 text-primary text-base">
                  {initials ?? (
                    <User className="h-5 w-5" aria-hidden="true" />
                  )}
                </AvatarFallback>
              </Avatar>
            </Link>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Loading state */}
        {loadingEvents && (
          <div className="space-y-4">
            <Skeleton className="h-48 w-full rounded-lg" />
            <Skeleton className="h-48 w-full rounded-lg" />
          </div>
        )}

        {/* Event list */}
        {!loadingEvents && events.length > 0 && (
          <>
            <div className="space-y-4">
              {events.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
            <Button size="lg" className="w-full h-14 text-lg justify-start px-5 shadow-md [&_svg]:size-5" asChild>
              <Link href="/events/new">
                <Plus className="mr-2" aria-hidden="true" />
                Neues Event erstellen
              </Link>
            </Button>
          </>
        )}

        {/* Empty state */}
        {!loadingEvents && events.length === 0 && !error && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <CalendarDays
                  className="h-7 w-7 text-muted-foreground"
                  aria-hidden="true"
                />
              </div>
              <CardTitle className="mb-2 text-lg">
                Noch keine Events
              </CardTitle>
              <CardDescription className="mb-6 max-w-xs">
                Erstelle dein erstes Event oder warte auf eine Einladung von
                einem Organisator.
              </CardDescription>
              <Button asChild>
                <Link href="/events/new">
                  <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                  Event erstellen
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
