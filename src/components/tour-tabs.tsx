"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Camera, Map } from "lucide-react";
import { cn } from "@/lib/utils";

interface TourTabsProps {
  tourId: string;
}

const tabs = [
  { segment: "tagebuch", label: "Tagebuch", icon: BookOpen },
  { segment: "galerie", label: "Galerie", icon: Camera },
  { segment: "karte", label: "Karte", icon: Map },
];

export function TourTabs({ tourId }: TourTabsProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Tour-Navigation"
      className="flex border-b border-border mb-4"
    >
      {tabs.map((tab) => {
        const href = `/touren/${tourId}/${tab.segment}`;
        const isActive = pathname === href;
        const Icon = tab.icon;

        return (
          <Link
            key={tab.segment}
            href={href}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
              isActive
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
