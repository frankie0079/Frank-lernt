import Link from "next/link";
import { Button } from "@/components/ui/button";

interface TourNavigationProps {
  tourId: string;
  showPlanung: boolean;
}

export function TourNavigation({ tourId, showPlanung }: TourNavigationProps) {
  const links = [
    ...(showPlanung
      ? [{ href: `/touren/${tourId}/planung`, label: "Planung" }]
      : []),
    { href: `/touren/${tourId}/tagebuch`, label: "Tagebuch" },
    { href: `/touren/${tourId}/galerie`, label: "Galerie" },
    { href: `/touren/${tourId}/karte`, label: "Karte" },
  ];

  return (
    <nav aria-label={`Navigation für Tour ${tourId}`} className="flex flex-wrap gap-2">
      {links.map((link) => (
        <Button key={link.href} variant="outline" size="sm" className="border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground transition-colors text-sm px-3" asChild>
          <Link href={link.href}>{link.label}</Link>
        </Button>
      ))}
    </nav>
  );
}
