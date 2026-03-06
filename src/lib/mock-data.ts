import { Tour } from "./types";

export const mockTours: Tour[] = [
  {
    id: "rota-vicentina-2026",
    name: "Rota Vicentina 2026",
    subtitle: "Fischerpfad, Portugal",
    start_date: "2026-06-15",
    end_date: "2026-06-28",
    status: "planned",
    cover_photo_url:
      "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=600&h=400&fit=crop",
    total_km: 226,
    participants: 5,
    current_stage: null,
    description:
      "Entlang der wilden Atlantikküste Portugals — von Santiago do Cacém bis zum Kap São Vicente.",
    created_at: "2026-02-28T00:00:00Z",
  },
  {
    id: "dolomiten-2025",
    name: "Dolomiten Höhenweg 2025",
    subtitle: "Alta Via 1, Südtirol",
    start_date: "2025-07-05",
    end_date: "2025-07-15",
    status: "archived",
    cover_photo_url:
      "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600&h=400&fit=crop",
    total_km: 150,
    participants: 4,
    current_stage: null,
    description:
      "Von den Pragser Dolomiten bis nach Belluno — zehn Tage über spektakuläre Pässe und durch stille Täler.",
    created_at: "2025-06-01T00:00:00Z",
  },
  {
    id: "kungsleden-2024",
    name: "Kungsleden 2024",
    subtitle: "Königspfad, Schwedisch-Lappland",
    start_date: "2024-08-10",
    end_date: "2024-08-22",
    status: "archived",
    cover_photo_url:
      "https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?w=600&h=400&fit=crop",
    total_km: 180,
    participants: 3,
    current_stage: null,
    description:
      "Durch die arktische Wildnis Nordschweden — Mitternachtssonne, Rentiere und endlose Weite.",
    created_at: "2024-07-01T00:00:00Z",
  },
];
