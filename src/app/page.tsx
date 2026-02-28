import { HeroSection } from "@/components/hero-section";
import { TourenBereich } from "@/components/touren-bereich";
import { mockTours } from "@/lib/mock-data";

export default function Home() {
  // Aktive oder geplante Tour (die nächste anstehende)
  const activeTour =
    mockTours.find((t) => t.status === "active") ??
    mockTours.find((t) => t.status === "planned");

  // Vergangene Touren
  const pastTours = mockTours.filter((t) => t.status === "archived");

  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <HeroSection activeTour={activeTour} />
      <TourenBereich activeTour={activeTour} pastTours={pastTours} />
    </main>
  );
}
