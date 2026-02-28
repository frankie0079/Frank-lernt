import Link from "next/link";
import { AktiveTourKarte } from "@/components/aktive-tour-karte";
import { TourKompaktKarte } from "@/components/tour-kompakt-karte";
import { Tour } from "@/lib/types";

interface TourenBereichProps {
  activeTour: Tour | undefined;
  pastTours: Tour[];
}

export function TourenBereich({ activeTour, pastTours }: TourenBereichProps) {
  if (!activeTour && pastTours.length === 0) {
    return (
      <section className="py-8 text-center text-muted-foreground">
        <p>Noch keine Touren vorhanden.</p>
      </section>
    );
  }

  return (
    <section className="py-6">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-2xl font-bold text-foreground">
          Unsere Touren
        </h2>
        {pastTours.length > 0 && (
          <Link
            href="/archiv"
            className="text-lg font-semibold text-primary hover:text-primary/80 transition-colors"
          >
            Weitere &rarr;
          </Link>
        )}
      </div>

      {/* 3 Karten in einer Reihe, volle Breite */}
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr_1fr] lg:items-stretch">
        {activeTour && <AktiveTourKarte tour={activeTour} />}

        {pastTours.slice(0, 2).map((tour) => (
          <TourKompaktKarte key={tour.id} tour={tour} />
        ))}
      </div>
    </section>
  );
}
