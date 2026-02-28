export interface Tour {
  id: string;
  name: string;
  subtitle: string;
  start_date: string;
  end_date: string;
  status: "planned" | "active" | "archived";
  cover_photo_url: string | null;
  total_km: number;
  participants: number;
  current_stage: string | null;
  description: string;
}
