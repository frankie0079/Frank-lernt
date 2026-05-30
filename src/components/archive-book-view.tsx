import Link from "next/link";
import { BookOpen, CalendarDays, Download, Users } from "lucide-react";
import { BookPageLayout } from "@/components/book-page-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ArchiveEvent } from "@/lib/archive-data";
import type { BookPage } from "@/lib/book-types";
import { formatDateRange } from "@/lib/event-utils";

interface ArchiveBookViewProps {
  event: ArchiveEvent;
  pages: BookPage[];
  backHref?: string;
  backLabel?: string;
}

function formatDayHeader(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function ArchiveBookView({
  event,
  pages,
  backHref,
  backLabel = "Zum Archiv",
}: ArchiveBookViewProps) {
  return (
    <main className="min-h-dvh bg-background">
      <section className="border-b border-border bg-card">
        {event.cover_url ? (
          <div className="h-64 w-full overflow-hidden bg-muted sm:h-96">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={event.cover_url}
              alt={`Coverfoto von ${event.name}`}
              className="h-full w-full object-cover"
              style={{
                objectPosition: event.cover_position ?? "center",
                transform: `scale(${event.cover_scale ?? 1})`,
              }}
            />
          </div>
        ) : null}
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          {backHref ? (
            <Button asChild variant="ghost" size="sm" className="mb-4">
              <Link href={backHref}>{backLabel}</Link>
            </Button>
          ) : null}
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="mb-2 text-sm uppercase tracking-wide text-muted-foreground">
                Die Wandervögel
              </p>
              <h1 className="font-display text-5xl font-bold leading-none text-foreground sm:text-7xl">
                {event.name}
              </h1>
              {event.description ? (
                <p className="mt-4 max-w-3xl text-lg leading-relaxed text-muted-foreground">
                  {event.description}
                </p>
              ) : null}
              <div className="mt-5 flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" aria-hidden="true" />
                  {formatDateRange(event.start_date, event.end_date)}
                </span>
                {typeof event.member_count === "number" ? (
                  <span className="inline-flex items-center gap-2">
                    <Users className="h-4 w-4" aria-hidden="true" />
                    {event.member_count} Teilnehmer
                  </span>
                ) : null}
              </div>
            </div>
            <Button disabled variant="outline" className="gap-2">
              <Download className="h-4 w-4" aria-hidden="true" />
              PDF folgt
            </Button>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-4xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        {pages.length === 0 ? (
          <Card className="p-10 text-center">
            <BookOpen
              className="mx-auto mb-3 h-10 w-10 text-muted-foreground"
              aria-hidden="true"
            />
            <h2 className="text-lg font-semibold">Noch kein Tagebuch</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Dieses Event ist im Archiv, aber es wurden noch keine
              Tagebuchseiten veröffentlicht.
            </p>
          </Card>
        ) : (
          pages.map((page) => {
            const orderedSections = (page.sections ?? [])
              .slice()
              .sort((a, b) => a.sort_order - b.sort_order);
            return (
              <section
                key={page.id}
                className="space-y-4 border-t border-border pt-8 first:border-t-0 first:pt-0"
              >
                <header>
                  <p className="text-sm uppercase tracking-wide text-muted-foreground">
                    {formatDayHeader(page.agenda_date)}
                  </p>
                  <h2 className="mt-1 font-display text-4xl font-bold leading-tight text-foreground">
                    {page.agenda_title}
                  </h2>
                </header>
                <div className="space-y-6">
                  {orderedSections.map((section, idx) => (
                    <article
                      key={section.id}
                      className="relative mx-auto w-full max-w-[640px] space-y-4 rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6"
                    >
                      <span className="absolute right-3 top-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                        Seite {idx + 1} / {orderedSections.length}
                      </span>
                      <BookPageLayout
                        layout={section.layout}
                        items={section.items}
                        sideText={section.comment}
                      />
                      {section.layout !== "text-left" && section.comment ? (
                        <p className="whitespace-pre-wrap text-base leading-relaxed text-foreground">
                          {section.comment}
                        </p>
                      ) : null}
                    </article>
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>
    </main>
  );
}
