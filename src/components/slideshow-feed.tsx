"use client";

// PROJ-34: Feed of all published slideshow films for an event.
// Visible to every event member in the "Buch" tab.

import { useCallback, useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Film, AlertCircle } from "lucide-react";
import { SlideshowCard, type PublishedSlideshow } from "@/components/slideshow-card";

interface Props {
  eventId: string;
}

export function SlideshowFeed({ eventId }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slideshows, setSlideshows] = useState<PublishedSlideshow[]>([]);

  const fetchSlideshows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/slideshows`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Filme konnten nicht geladen werden.");
      }
      const data = (await res.json()) as { slideshows: PublishedSlideshow[] };
      setSlideshows(data.slideshows ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchSlideshows();
  }, [fetchSlideshows]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (slideshows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <Film className="mx-auto mb-3 h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-medium text-foreground">Noch keine Filme</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Sobald der Tages-Admin einen Film veröffentlicht, erscheint er hier.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {slideshows.map((s) => (
        <SlideshowCard key={s.agenda_item_id} slideshow={s} />
      ))}
    </div>
  );
}
