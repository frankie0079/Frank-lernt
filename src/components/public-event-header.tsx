// PROJ-35: Hero header for /e/[slug] — Server Component.

import Image from "next/image";
import { Users, CalendarDays } from "lucide-react";
import { ShareButton } from "@/components/share-button";

interface Props {
  name: string;
  description: string | null;
  coverUrl: string | null;
  coverPosition?: string | null;
  startDate: string;
  endDate: string;
  memberCount: number;
  shareUrl: string;
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const sameYear = s.getFullYear() === e.getFullYear();
  const sameMonth = sameYear && s.getMonth() === e.getMonth();
  const sameDay = sameMonth && s.getDate() === e.getDate();
  if (sameDay) {
    return s.toLocaleDateString("de-DE", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
  if (sameMonth) {
    return `${s.getDate()}.–${e.toLocaleDateString("de-DE", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })}`;
  }
  if (sameYear) {
    return `${s.toLocaleDateString("de-DE", {
      day: "numeric",
      month: "long",
    })} – ${e.toLocaleDateString("de-DE", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })}`;
  }
  return `${s.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })} – ${e.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })}`;
}

export function PublicEventHeader({
  name,
  description,
  coverUrl,
  coverPosition,
  startDate,
  endDate,
  memberCount,
  shareUrl,
}: Props) {
  const dateLabel = formatDateRange(startDate, endDate);

  return (
    <header className="relative overflow-hidden">
      <div className="relative h-64 w-full sm:h-80 md:h-[420px]">
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt={`Coverfoto von ${name}`}
            fill
            priority
            sizes="100vw"
            className="object-cover"
            style={{ objectPosition: coverPosition || "center" }}
          />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background:
                "linear-gradient(135deg, #25918a 0%, #f59e0b 100%)",
            }}
            aria-hidden="true"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />

        <div className="absolute inset-x-0 bottom-0 px-4 pb-6 sm:px-8 sm:pb-10">
          <div className="mx-auto max-w-4xl space-y-3 text-white">
            <h1 className="text-3xl font-bold leading-tight drop-shadow-md sm:text-4xl md:text-5xl">
              {name}
            </h1>
            {description ? (
              <p className="max-w-2xl text-sm text-white/90 drop-shadow sm:text-base">
                {description}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/90">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                {dateLabel}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4" aria-hidden="true" />
                {memberCount} Teilnehmer
              </span>
              <div className="ml-auto">
                <ShareButton
                  variant="button"
                  title={name}
                  text={`Schau dir ${name} an`}
                  url={shareUrl}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
