import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TourHeader } from "@/components/tour-header";
import { TourTabs } from "@/components/tour-tabs";

interface TourLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function TourLayout({ children, params }: TourLayoutProps) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 pb-24">
      {/* Back link */}
      <div className="pt-4 pb-2">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Zurück zur Startseite"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurück
        </Link>
      </div>

      {/* Tour header (name + subtitle from API) */}
      <TourHeader tourId={id} />

      {/* Tab navigation */}
      <TourTabs tourId={id} />

      {/* Page content */}
      <main>{children}</main>
    </div>
  );
}
