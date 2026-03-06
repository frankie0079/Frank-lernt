import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";

interface TourHeaderProps {
  tourId: string;
}

export async function TourHeader({ tourId }: TourHeaderProps) {
  const { data: tour, error } = await supabase
    .from("tours")
    .select("name, subtitle, status, start_date, end_date")
    .eq("id", tourId)
    .single();

  if (error || !tour) {
    return (
      <div className="py-4">
        <h1 className="text-2xl font-bold text-foreground">Tour nicht gefunden</h1>
        <p className="text-muted-foreground">Diese Tour existiert nicht.</p>
      </div>
    );
  }

  const statusLabel =
    tour.status === "active"
      ? "Aktiv"
      : tour.status === "planned"
        ? "Geplant"
        : "Archiviert";

  return (
    <header className="py-3">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-foreground leading-tight">
          {tour.name}
        </h1>
        <Badge
          className={
            tour.status === "active"
              ? "bg-accent text-accent-foreground"
              : tour.status === "planned"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
          }
        >
          {statusLabel}
        </Badge>
      </div>
      <p className="text-muted-foreground mt-0.5">{tour.subtitle}</p>
    </header>
  );
}
