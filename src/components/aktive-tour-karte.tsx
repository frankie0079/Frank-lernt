import Image from "next/image";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TourNavigation } from "@/components/tour-navigation";
import { Tour } from "@/lib/types";

function TourCountdown({ tour }: { tour: Tour }) {
  if (tour.status === "active" && tour.current_stage) {
    return (
      <Badge className="absolute top-3 right-3 bg-accent text-accent-foreground text-sm px-4 py-1.5 shadow">
        Unterwegs — {tour.current_stage}
      </Badge>
    );
  }

  const start = new Date(tour.start_date);
  const now = new Date();
  const diffDays = Math.ceil(
    (start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays > 0) {
    return (
      <Badge className="absolute top-3 right-3 bg-white/90 text-foreground text-sm px-4 py-1.5 shadow">
        Startet in {diffDays} Tagen
      </Badge>
    );
  }

  return null;
}

interface AktiveTourKarteProps {
  tour: Tour;
}

export function AktiveTourKarte({ tour }: AktiveTourKarteProps) {
  const startDate = new Date(tour.start_date).toLocaleDateString("de-CH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const endDate = new Date(tour.end_date).toLocaleDateString("de-CH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <Card className="flex flex-col overflow-hidden shadow-md hover:shadow-lg transition-shadow">
      {/* Foto */}
      <div className="relative aspect-[3/2] w-full bg-muted">
        {tour.cover_photo_url && (
          <Image
            src={tour.cover_photo_url}
            alt={tour.name}
            fill
            className="object-cover"
          />
        )}
        <Badge className="absolute top-3 left-3 bg-primary text-primary-foreground text-sm px-4 py-1.5 shadow">
          {tour.status === "active"
            ? "Aktiv"
            : tour.status === "planned"
              ? "Geplant"
              : "Archiviert"}
        </Badge>
        <TourCountdown tour={tour} />
      </div>

      <CardContent className="flex flex-col gap-1.5 pt-4 pb-2">
        <h3 className="text-2xl font-bold leading-tight">{tour.name}</h3>
        <p className="text-base text-muted-foreground">{tour.subtitle}</p>
        <p className="text-sm text-muted-foreground">
          {startDate} — {endDate} · {tour.total_km} km · {tour.participants} Teilnehmer
        </p>
      </CardContent>

      <CardFooter className="pt-0">
        <TourNavigation
          tourId={tour.id}
          showPlanung={tour.status !== "archived"}
        />
      </CardFooter>
    </Card>
  );
}
