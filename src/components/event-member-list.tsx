"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UserMinus, Users, AlertCircle, User } from "lucide-react";
import type { EventMember } from "@/lib/event-utils";

interface EventMemberListProps {
  members: EventMember[];
  currentMemberId: string;
  isOrganizer: boolean;
  loading: boolean;
  error: string | null;
  onRemoveMember: (memberId: string) => Promise<void>;
}

const roleConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  organizer: { label: "Organisator", variant: "default" },
  admin: { label: "Admin", variant: "secondary" },
  member: { label: "Mitglied", variant: "outline" },
};

function getInitials(name: string | null): string | null {
  if (!name) return null;
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatJoinedDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function EventMemberList({
  members,
  currentMemberId,
  isOrganizer,
  loading,
  error,
  onRemoveMember,
}: EventMemberListProps) {
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleRemove = useCallback(
    async (memberId: string) => {
      setRemovingId(memberId);
      try {
        await onRemoveMember(memberId);
      } finally {
        setRemovingId(null);
      }
    },
    [onRemoveMember]
  );

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5" aria-hidden="true" />
            Teilnehmer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const sortedMembers = [...members].sort((a, b) => {
    // Organizer first, then admin, then member
    const order = { organizer: 0, admin: 1, member: 2 };
    return (order[a.role] ?? 3) - (order[b.role] ?? 3);
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5" aria-hidden="true" />
          Teilnehmer
          <Badge variant="secondary" className="ml-1">
            {members.length}
          </Badge>
        </CardTitle>
        <CardDescription>
          {members.length >= 50
            ? "Maximale Teilnehmerzahl (50) erreicht"
            : `${50 - members.length} Plaetze verfügbar`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <div className="py-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Users
                className="h-6 w-6 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Noch keine Teilnehmer. Teile den Einladungslink!
            </p>
          </div>
        ) : (
          <div className="space-y-2" role="list" aria-label="Teilnehmerliste">
            {sortedMembers.map((m) => {
              const config = roleConfig[m.role] ?? roleConfig.member;
              const initials = getInitials(m.member_name);
              const isSelf = m.member_id === currentMemberId;
              const isOrganizerMember = m.role === "organizer";

              return (
                <div
                  key={m.id}
                  role="listitem"
                  className="flex items-center gap-3 rounded-lg border border-border p-3"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage
                      src={m.member_avatar_url ?? undefined}
                      alt={m.member_name ?? "Anonym"}
                    />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {initials ?? (
                        <User className="h-4 w-4" aria-hidden="true" />
                      )}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">
                        {m.member_name ?? "Anonym"}
                        {isSelf && (
                          <span className="ml-1 text-muted-foreground">
                            (Du)
                          </span>
                        )}
                      </p>
                      <Badge variant={config.variant} className="text-xs shrink-0">
                        {config.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Beigetreten: {formatJoinedDate(m.joined_at)}
                    </p>
                  </div>

                  {/* Remove button: only organizer can remove others, not self */}
                  {isOrganizer && !isOrganizerMember && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                          disabled={removingId === m.member_id}
                          aria-label={`${m.member_name ?? "Anonym"} entfernen`}
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Teilnehmer entfernen?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            <strong>{m.member_name ?? "Anonym"}</strong> wird
                            aus dem Event entfernt. Bisherige Beiträge bleiben
                            erhalten.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleRemove(m.member_id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Entfernen
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
