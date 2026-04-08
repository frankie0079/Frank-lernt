// PROJ-35: Single published day-report card on the public landing page.
// Server Component — embeds the client-side PublicPhotoGallery for the lightbox.

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Film, CalendarDays } from "lucide-react";
import { LazyVideo } from "@/components/lazy-video";
import {
  PublicPhotoGallery,
  type PublicGalleryItem,
} from "@/components/public-photo-gallery";

interface Props {
  eventId: string;
  reportId: string;
  agendaItemId: string;
  agendaTitle: string;
  agendaDate: string;
  slideshowUrl: string | null;
  durationSec: number | null;
  posterUrl: string | null;
  items: PublicGalleryItem[];
}

export function PublicDayReportCard({
  eventId,
  agendaItemId,
  agendaTitle,
  agendaDate,
  slideshowUrl,
  durationSec,
  posterUrl,
  items,
}: Props) {
  const date = new Date(agendaDate + "T00:00:00").toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <Card className="overflow-hidden">
      <CardHeader className="space-y-1 pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
              {date}
            </div>
            <h2 className="mt-1 truncate text-xl font-semibold sm:text-2xl">
              {agendaTitle}
            </h2>
          </div>
          <Badge variant="secondary" className="shrink-0">
            {items.length} {items.length === 1 ? "Beitrag" : "Beiträge"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        {slideshowUrl ? (
          <div className="relative overflow-hidden rounded-md bg-black">
            {/* BUG-4 fix: lazy-load via IntersectionObserver to avoid 30 parallel metadata fetches on long events. */}
            <LazyVideo
              src={slideshowUrl}
              poster={posterUrl ?? undefined}
              ariaLabel={`Slideshow von ${agendaTitle}`}
            />
            {durationSec ? (
              <span className="pointer-events-none absolute right-2 top-2 rounded bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white">
                {durationSec}s
              </span>
            ) : null}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-md border border-dashed border-muted-foreground/30 bg-muted/30 p-3 text-xs text-muted-foreground">
            <Film className="h-4 w-4" aria-hidden="true" />
            Slideshow in Kürze verfügbar
          </div>
        )}

        <PublicPhotoGallery
          items={items}
          eventId={eventId}
          agendaItemId={agendaItemId}
        />
      </CardContent>
    </Card>
  );
}
