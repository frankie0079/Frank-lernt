"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowLeft,
  AlertCircle,
  CalendarDays,
  Shield,
  ChevronRight,
  FileText,
} from "lucide-react";

interface ReportRow {
  agenda_item_id: string;
  title: string;
  date: string;
  sort_order: number;
  admin_member_id: string | null;
  admin_name: string | null;
  report_id: string | null;
  status: "empty" | "draft" | "published";
  published_at: string | null;
  updated_at: string | null;
  item_count: number;
}

const statusConfig: Record<
  ReportRow["status"],
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  empty: { label: "Leer", variant: "outline" },
  draft: { label: "Entwurf", variant: "secondary" },
  published: { label: "Veröffentlicht", variant: "default" },
};

export default function AdminOverviewPage() {
  const params = useParams();
  const router = useRouter();
  const { member, loading: authLoading } = useAuth();
  const eventId = params.id as string;

  const [reports, setReports] = useState<ReportRow[]>([]);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const [reportsRes, eventRes] = await Promise.all([
        fetch(`/api/events/${eventId}/reports`),
        fetch(`/api/events/${eventId}`),
      ]);
      if (reportsRes.status === 403) {
        toast.error("Kein Zugriff auf Tages-Admin");
        router.push(`/events/${eventId}`);
        return;
      }
      if (!reportsRes.ok) {
        const data = await reportsRes.json().catch(() => ({}));
        throw new Error(data.error || "Berichte konnten nicht geladen werden.");
      }
      const data = await reportsRes.json();
      setReports((data.reports as ReportRow[]) || []);
      if (eventRes.ok) {
        const eventData = await eventRes.json();
        const organizerId =
          eventData?.event?.organizer_id ?? eventData?.organizer_id ?? null;
        setIsOrganizer(!!organizerId && organizerId === member?.id);
      }
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ein Fehler ist aufgetreten."
      );
    } finally {
      setLoading(false);
    }
  }, [eventId, router, member?.id]);

  useEffect(() => {
    if (!authLoading && member) {
      fetchReports();
    }
  }, [authLoading, member, fetchReports]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background px-4 py-6">
        <div className="mx-auto max-w-2xl space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  if (!member) return null;

  const canCurate = (r: ReportRow) =>
    isOrganizer || r.admin_member_id === member.id;

  // Client-side filter: show only cards curable by the current user, unless organizer
  // The server already enforces access, so on this page we show all and disable cards
  // that the current user can't curate.

  return (
    <div className="min-h-screen bg-background px-4 py-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/events/${eventId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            Zurück zum Event
          </Link>
        </Button>

        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-foreground">Tages-Admin</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Kuratiere die täglichen Berichte für dein Event.
        </p>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {reports.length === 0 && !error && (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <FileText
              className="mx-auto mb-3 h-10 w-10 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="text-sm font-medium text-foreground">
              Keine Agenda-Einträge
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Lege zuerst Tage in der Agenda an.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {reports.map((r) => {
            const cfg = statusConfig[r.status];
            const itemDate = new Date(r.date + "T00:00:00");
            const allowed = canCurate(r);
            const updated = r.updated_at
              ? new Date(r.updated_at).toLocaleString("de-DE", {
                  dateStyle: "short",
                  timeStyle: "short",
                })
              : null;

            const card = (
              <Card
                className={`transition-shadow ${
                  allowed ? "hover:shadow-md" : "opacity-60"
                }`}
              >
                <CardContent className="flex items-center gap-3 p-4">
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

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-medium text-foreground">
                        {r.title}
                      </h3>
                      <Badge
                        variant={cfg.variant}
                        className="shrink-0 text-[10px]"
                      >
                        {cfg.label}
                      </Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" aria-hidden="true" />
                        {r.item_count}{" "}
                        {r.item_count === 1 ? "Beitrag" : "Beiträge"}
                      </span>
                      {r.admin_name && (
                        <span>Admin: {r.admin_name}</span>
                      )}
                      {updated && (
                        <span className="flex items-center gap-1">
                          <CalendarDays
                            className="h-3 w-3"
                            aria-hidden="true"
                          />
                          {updated}
                        </span>
                      )}
                    </div>
                  </div>

                  {allowed && (
                    <ChevronRight
                      className="h-5 w-5 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  )}
                </CardContent>
              </Card>
            );

            return allowed ? (
              <Link
                key={r.agenda_item_id}
                href={`/events/${eventId}/admin/${r.agenda_item_id}`}
                className="block"
                aria-label={`Kuratieren: ${r.title}`}
              >
                {card}
              </Link>
            ) : (
              <div key={r.agenda_item_id} aria-disabled="true">
                {card}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
