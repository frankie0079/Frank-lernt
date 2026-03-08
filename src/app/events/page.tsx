"use client";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, User, CalendarDays } from "lucide-react";
import Link from "next/link";

export default function EventsPage() {
  const { user, profile, loading } = useAuth();

  if (loading) {
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

  if (!user) {
    return null; // Middleware redirects to /login
  }

  const displayName = profile?.display_name ?? "Anonym";
  const initials = profile?.display_name
    ? profile.display_name
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
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Meine Events</h1>
          <Link href="/profile" aria-label="Profil bearbeiten">
            <Avatar className="h-10 w-10 cursor-pointer ring-2 ring-border hover:ring-primary transition-all">
              <AvatarImage
                src={profile?.avatar_url ?? undefined}
                alt={displayName}
              />
              <AvatarFallback className="bg-primary/10 text-primary text-sm">
                {initials ?? (
                  <User className="h-4 w-4" aria-hidden="true" />
                )}
              </AvatarFallback>
            </Avatar>
          </Link>
        </div>

        {/* Empty state — events will be implemented in PROJ-25 */}
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
            <Button disabled>
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Event erstellen
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              Kommt bald (PROJ-25)
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
