"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  type EventData,
  computeEventStatus,
  generateEventGradient,
  formatDateRange,
} from "@/lib/event-utils";
import { CalendarDays, Users } from "lucide-react";

interface EventCardProps {
  event: EventData;
}

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  planned: { label: "Geplant", variant: "secondary" },
  active: { label: "Aktiv", variant: "default" },
  archived: { label: "Archiviert", variant: "outline" },
};

export function EventCard({ event }: EventCardProps) {
  const status = computeEventStatus(event.start_date, event.end_date);
  const config = statusConfig[status];
  const gradient = generateEventGradient(event.name);
  const dateRange = formatDateRange(event.start_date, event.end_date);

  return (
    <Link
      href={`/events/${event.id}`}
      className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg"
      aria-label={`Event: ${event.name}`}
    >
      <Card className="overflow-hidden transition-shadow hover:shadow-md">
        {/* Cover Image or Gradient */}
        <div
          className="relative h-32 w-full overflow-hidden"
          style={!event.cover_url ? { background: gradient } : undefined}
        >
          {event.cover_url && (
            <img
              src={event.cover_url}
              alt={`Cover von ${event.name}`}
              className="h-full w-full object-cover"
              style={{
                objectPosition: event.cover_position || "center",
                transform: event.cover_scale != null && event.cover_scale !== 1 ? `scale(${event.cover_scale})` : undefined,
              }}
            />
          )}
          <Badge
            variant={config.variant}
            className="absolute right-2 top-2"
          >
            {config.label}
          </Badge>
        </div>

        <CardContent className="p-4">
          <h3 className="mb-1 text-lg font-semibold text-foreground line-clamp-1">
            {event.name}
          </h3>
          {event.description && (
            <p className="mb-3 text-sm text-muted-foreground line-clamp-2">
              {event.description}
            </p>
          )}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              {dateRange}
            </span>
            {event.member_count != null && (
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" aria-hidden="true" />
                {event.member_count}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
