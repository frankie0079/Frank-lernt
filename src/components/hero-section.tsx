import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Tour } from "@/lib/types";

function TourStatusBadge({ tour }: { tour: Tour | undefined }) {
  if (!tour) {
    return (
      <Badge variant="secondary" className="text-base px-5 py-2">
        Keine aktive Tour
      </Badge>
    );
  }

  if (tour.status === "active" && tour.current_stage) {
    return (
      <Badge className="bg-accent text-accent-foreground text-base px-5 py-2 shadow-md">
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
      <Badge className="bg-primary text-primary-foreground text-base px-5 py-2 shadow-md">
        Startet in {diffDays} Tagen
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="text-base px-5 py-2">
      {tour.name}
    </Badge>
  );
}

interface HeroSectionProps {
  activeTour: Tour | undefined;
}

export function HeroSection({ activeTour }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden rounded-2xl mt-4">
      {/* Hintergrundbild */}
      <Image
        src="https://images.unsplash.com/photo-1551632811-561732d1e306?w=1600&h=600&fit=crop"
        alt="Wanderer auf einem Küstenpfad"
        width={1600}
        height={600}
        priority
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* Dunkler Overlay für Lesbarkeit */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/40 to-transparent" />

      {/* Inhalt */}
      <div className="relative flex flex-col items-start gap-3 px-8 py-8 sm:px-12 sm:py-12">
        <Image
          src="/Logo_Wandervoegel.JPG"
          alt="Die Wandervögel — Logo"
          width={80}
          height={80}
          priority
          className="rounded-full border-2 border-white/80 shadow-lg"
        />
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl drop-shadow-md">
          Wir Wandervögel
        </h1>
        <p className="max-w-lg text-2xl text-white/90 drop-shadow sm:text-3xl font-[family-name:var(--font-caveat)]">
          Einfach mal die Schnauze halten — Du Vögel
        </p>
      </div>
    </section>
  );
}
