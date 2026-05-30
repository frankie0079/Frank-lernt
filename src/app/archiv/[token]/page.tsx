import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getCommunityArchiveEvents } from "@/lib/archive-data";
import { formatDateRange } from "@/lib/event-utils";

export const dynamic = "force-dynamic";

export default async function CommunityArchivePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const events = await getCommunityArchiveEvents(token);

  if (!events) notFound();

  return (
    <main className="min-h-dvh bg-background">
      <section className="border-b border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <p className="mb-2 text-sm uppercase tracking-wide text-muted-foreground">
            Event-Archiv
          </p>
          <h1 className="font-display text-5xl font-bold leading-none text-foreground sm:text-7xl">
            Die Wandervögel
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Reisen, Wanderungen und gemeinsame Erinnerungen als dauerhaftes
            Tagebuch.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {events.length === 0 ? (
          <Card className="p-10 text-center">
            <h2 className="text-lg font-semibold">Noch kein Event im Archiv</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Sobald ein Wandervögel-Event veröffentlicht ist, erscheint es hier.
            </p>
          </Card>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <Link
                key={event.id}
                href={`/archiv/${token}/${event.slug}`}
                className="group block"
              >
                <Card className="h-full overflow-hidden transition-transform group-hover:-translate-y-0.5">
                  <div className="aspect-[4/3] bg-muted">
                    {event.cover_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={event.cover_url}
                        alt={`Coverfoto von ${event.name}`}
                        className="h-full w-full object-cover"
                        style={{
                          objectPosition: event.cover_position ?? "center",
                          transform: `scale(${event.cover_scale ?? 1})`,
                        }}
                      />
                    ) : null}
                  </div>
                  <div className="space-y-3 p-4">
                    <h2 className="font-display text-2xl font-bold leading-tight text-foreground">
                      {event.name}
                    </h2>
                    {event.description ? (
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {event.description}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                        {formatDateRange(event.start_date, event.end_date)}
                      </span>
                      {typeof event.member_count === "number" ? (
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" aria-hidden="true" />
                          {event.member_count}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
