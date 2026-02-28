import Image from "next/image";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TourNavigation } from "@/components/tour-navigation";
import { Tour } from "@/lib/types";

interface TourKompaktKarteProps {
  tour: Tour;
}

export function TourKompaktKarte({ tour }: TourKompaktKarteProps) {
  const dateRange = new Date(tour.start_date).toLocaleDateString("de-CH", {
    month: "short",
    year: "numeric",
  });

  return (
    <Card className="flex flex-col h-full overflow-hidden shadow-md hover:shadow-lg transition-shadow">
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
          Gemacht
        </Badge>
      </div>

      <CardContent className="flex flex-col gap-1 pt-3 pb-2">
        <h3 className="text-xl font-bold leading-tight">{tour.name}</h3>
        <p className="text-sm text-muted-foreground">{dateRange}</p>
      </CardContent>

      <CardFooter className="mt-auto pt-0">
        <TourNavigation tourId={tour.id} showPlanung={false} />
      </CardFooter>
    </Card>
  );
}
