/**
 * Shared types for the Post-Event Tagebuch (book) feature — PROJ-36.
 *
 * A "book" is built automatically from an event's agenda: one BookPage per
 * agenda item. The organizer picks photos/videos/text-notes from that day's
 * content-pool and composes them into a chosen layout.
 */

export const BOOK_LAYOUTS = [
  "single",
  "two",
  "three",
  "four",
  "five-hero",
  "grid-3",
  "text-left",
] as const;

export type BookLayout = (typeof BOOK_LAYOUTS)[number];

export const MAX_PHOTOS_PER_PAGE = 60;
export const MAX_COMMENT_LENGTH = 2000;

/**
 * How many photos each layout shows from the selection. `grid-3` is the only
 * "flowing" layout — it takes everything up to MAX_PHOTOS_PER_PAGE; the
 * others show a fixed first-N.
 */
export const BOOK_LAYOUT_CAPACITY: Record<BookLayout, number> = {
  single: 1,
  two: 2,
  three: 3,
  four: 4,
  "five-hero": 5,
  "grid-3": MAX_PHOTOS_PER_PAGE,
  "text-left": 1,
};

/**
 * A row from `book_pages`, enriched with the joined agenda item + the
 * selected content items for convenience in the UI.
 */
export interface BookPage {
  id: string;
  event_id: string;
  agenda_item_id: string;
  layout: BookLayout;
  comment: string;
  is_visible: boolean;
  sort_order: number;
  updated_at: string | null;
  updated_by: string | null;
  updated_by_name: string | null;
  /** Joined agenda meta */
  agenda_title: string;
  agenda_date: string;
  /** Items attached to this page, already sorted by sort_order */
  items: BookPageItem[];
}

export interface BookPageItem {
  id: string;
  content_item_id: string;
  sort_order: number;
  /** Resolved content fields — may be null if the source was deleted */
  type: "photo" | "video" | "text" | "audio" | null;
  media_url: string | null;
  thumbnail_url: string | null;
  caption: string | null;
  author_id: string | null;
  author_name: string | null;
  author_avatar_url: string | null;
}

export interface BookGetResponse {
  event_id: string;
  is_organizer: boolean;
  pages: BookPage[];
}

export interface BookPutResponse {
  page: BookPage;
}

export const BOOK_LAYOUT_LABELS: Record<BookLayout, string> = {
  single: "Ein großes Foto",
  two: "2 Fotos nebeneinander",
  three: "3 Fotos",
  four: "4 Fotos im Quadrat",
  "five-hero": "1 groß + 4 kleine (Instagram)",
  "grid-3": "Alle Fotos im 3er-Raster",
  "text-left": "Foto + Text",
};

export const BOOK_LAYOUT_DESCRIPTIONS: Record<BookLayout, string> = {
  single: "Eine große Aufnahme über die ganze Seite.",
  two: "Zwei Fotos nebeneinander, gleich groß.",
  three: "Drei Fotos in einer Reihe.",
  four: "Vier Fotos im 2×2-Raster.",
  "five-hero": "Ein Hero-Foto oben, vier kleinere im 2×2 darunter — Instagram-Style.",
  "grid-3": "Alle ausgewählten Fotos im 3-Spalten-Raster (bis 60). Ideal für fotoreiche Tage.",
  "text-left": "Kommentar links, Foto rechts — für textlastige Tage.",
};
