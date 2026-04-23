// PROJ-35: Public Event Page — /e/[slug]
//
// Server Component. Reads everything via the SECURITY DEFINER RPC
// `get_public_event(p_slug)`. Cached for 5 minutes via unstable_cache.

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { Card } from "@/components/ui/card";
import { PublicEventHeader } from "@/components/public-event-header";
import { PublicCountdown } from "@/components/public-countdown";
import { PublicDayReportCard } from "@/components/public-day-report-card";
import { PublicEventMap, type MapMarker } from "@/components/public-event-map";
import type { PublicGalleryItem } from "@/components/public-photo-gallery";

interface PublicEventData {
  event: {
    id: string;
    name: string;
    description: string | null;
    start_date: string;
    end_date: string;
    cover_url: string | null;
    cover_position: string | null;
    cover_scale: number | null;
    slug: string;
    member_count: number;
  };
  agenda: Array<{
    id: string;
    date: string;
    title: string;
    sort_order: number;
  }>;
  reports: Array<{
    report_id: string;
    agenda_item_id: string;
    agenda_title: string;
    agenda_date: string;
    agenda_sort: number;
    slideshow_url: string | null;
    slideshow_published_at: string | null;
    slideshow_duration_sec: number | null;
    published_at: string | null;
    items: PublicGalleryItem[];
  }>;
}

function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

async function fetchPublicEventUncached(
  slug: string,
): Promise<PublicEventData | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("get_public_event", {
    p_slug: slug,
  });
  if (error) {
    console.error("[public-event] RPC error", error);
    return null;
  }
  const payload = data as { ok: boolean; error?: string } & PublicEventData;
  if (!payload?.ok) return null;
  return {
    event: payload.event,
    agenda: payload.agenda ?? [],
    reports: payload.reports ?? [],
  };
}

// BUG-2 fix: wrap unstable_cache in React.cache() for per-request dedupe.
// Without react.cache, generateMetadata() and the page body would each build a
// fresh unstable_cache factory and potentially hit the DB twice per cold request.
const getPublicEvent = cache(async (slug: string) => {
  return unstable_cache(
    () => fetchPublicEventUncached(slug),
    ["public-event", slug],
    { revalidate: 300, tags: [`public-event:${slug}`] },
  )();
});

function siteUrl(): string {
  const env =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  return env.replace(/\/$/, "");
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPublicEvent(slug);
  if (!data) {
    return { title: "Event nicht gefunden — EventDocs" };
  }
  const { event } = data;
  const dateLabel = new Date(event.start_date + "T00:00:00").toLocaleDateString(
    "de-DE",
    { day: "numeric", month: "long", year: "numeric" },
  );
  // BUG-3 fix: collapse whitespace/newlines so WhatsApp link previews don't
  // render raw line breaks from event.description.
  const description = (
    event.description?.replace(/\s+/g, " ").trim().slice(0, 160) ??
    `Gemeinsame Event-Dokumentation ab ${dateLabel}.`
  );
  const url = `${siteUrl()}/e/${event.slug}`;

  return {
    title: `${event.name} — EventDocs`,
    description,
    openGraph: {
      title: event.name,
      description,
      url,
      type: "website",
      images: event.cover_url ? [{ url: event.cover_url }] : undefined,
    },
    twitter: {
      card: event.cover_url ? "summary_large_image" : "summary",
      title: event.name,
      description,
      images: event.cover_url ? [event.cover_url] : undefined,
    },
  };
}

export default async function PublicEventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getPublicEvent(slug);

  if (!data) notFound();

  const { event, reports } = data;

  // Reports are already sorted ASC by date in the RPC
  const sortedReports = reports;

  // Build flat marker list across all reports for the map
  const markers: MapMarker[] = sortedReports.flatMap((r) =>
    r.items
      .filter(
        (it): it is PublicGalleryItem & { latitude: number; longitude: number } =>
          typeof it.latitude === "number" && typeof it.longitude === "number",
      )
      .map((it) => ({
        id: it.content_item_id,
        latitude: it.latitude,
        longitude: it.longitude,
        thumbnailUrl: it.thumbnail_url ?? it.media_url ?? null,
        authorName: it.author_name,
        agendaTitle: r.agenda_title,
      })),
  );

  const startTs = new Date(event.start_date + "T00:00:00").getTime();
  // eslint-disable-next-line react-hooks/purity
  const nowTs = Date.now();
  const isFuture = startTs > nowTs;

  const shareUrl = `${siteUrl()}/e/${event.slug}`;

  return (
    <main className="min-h-dvh bg-background">
      <PublicEventHeader
        name={event.name}
        description={event.description}
        coverUrl={event.cover_url}
        coverPosition={event.cover_position || "center"}
        coverScale={event.cover_scale || 1}
        startDate={event.start_date}
        endDate={event.end_date}
        memberCount={event.member_count}
        shareUrl={shareUrl}
      />

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        {isFuture ? (
          <PublicCountdown startDate={event.start_date} targetHour={0} />
        ) : null}

        {sortedReports.length === 0 ? (
          <Card className="p-8 text-center">
            <h2 className="text-lg font-semibold">
              Noch nichts veröffentlicht
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Schau bald wieder vorbei — die ersten Tagesberichte kommen in
              Kürze.
            </p>
          </Card>
        ) : (
          <div className="space-y-6">
            {sortedReports.map((r) => {
              const firstPhoto = r.items.find((it) => it.type === "photo");
              const posterUrl =
                firstPhoto?.thumbnail_url ?? firstPhoto?.media_url ?? null;
              return (
                <PublicDayReportCard
                  key={r.report_id}
                  eventId={event.id}
                  reportId={r.report_id}
                  agendaItemId={r.agenda_item_id}
                  agendaTitle={r.agenda_title}
                  agendaDate={r.agenda_date}
                  slideshowUrl={r.slideshow_url}
                  durationSec={r.slideshow_duration_sec}
                  posterUrl={posterUrl}
                  items={r.items}
                />
              );
            })}
          </div>
        )}

        {markers.length > 0 ? <PublicEventMap markers={markers} /> : null}
      </div>

      <footer className="border-t border-border bg-muted/30 py-6 text-center text-xs text-muted-foreground">
        {/* BUG-8 fix: footer no longer links to /, which redirects to /login and is a dead end for public followers. */}
        Erstellt mit <span className="font-medium text-foreground">EventDocs</span>
      </footer>
    </main>
  );
}
