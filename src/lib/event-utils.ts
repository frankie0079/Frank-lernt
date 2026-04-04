/**
 * Utility functions for events.
 */

export type EventStatus = "planned" | "active" | "archived";

export interface EventData {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  cover_url: string | null;
  slug: string;
  organizer_id: string;
  created_at: string;
  member_count?: number;
}

export interface EventMember {
  id: string;
  event_id: string;
  member_id: string;
  role: "organizer" | "admin" | "member";
  joined_at: string;
  member_name: string | null;
  member_avatar_url: string | null;
}

export interface Invitation {
  id: string;
  event_id: string;
  token: string;
  expires_at: string;
  created_at: string;
}

export interface AgendaItem {
  id: string;
  event_id: string;
  date: string;
  title: string;
  description: string | null;
  admin_member_id: string | null;
  sort_order: number;
}

/**
 * Compute event status based on current date.
 * - today < start_date -> "planned"
 * - today between start and end (inclusive) -> "active"
 * - today > end_date -> "archived"
 */
export function computeEventStatus(
  startDate: string,
  endDate: string
): EventStatus {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");

  if (today < start) return "planned";
  if (today > end) return "archived";
  return "active";
}

/**
 * Generate a deterministic gradient based on event name hash.
 * Returns a CSS gradient string using teal/amber tones.
 */
export function generateEventGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    const char = name.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }

  // Use hash to pick angle and color variations
  const angle = Math.abs(hash % 360);
  const hue1 = 170 + (Math.abs(hash) % 30); // teal range: 170-200
  const hue2 = 35 + (Math.abs(hash >> 8) % 20); // amber range: 35-55
  const sat1 = 60 + (Math.abs(hash >> 4) % 30);
  const sat2 = 70 + (Math.abs(hash >> 12) % 25);

  return `linear-gradient(${angle}deg, hsl(${hue1}, ${sat1}%, 45%), hsl(${hue2}, ${sat2}%, 55%))`;
}

/**
 * Generate slug from event name.
 * Handles German umlauts explicitly (ae, oe, ue, ss),
 * then strips remaining diacritics, lowercases, and hyphenates.
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\u00e4/g, "ae") // ae
    .replace(/\u00f6/g, "oe") // oe
    .replace(/\u00fc/g, "ue") // ue
    .replace(/\u00df/g, "ss") // ss
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove remaining diacritics
    .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, "") // Trim leading/trailing hyphens
    .replace(/-{2,}/g, "-"); // Remove consecutive hyphens
}

/**
 * Format a date range for display.
 */
export function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");

  const opts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
  };
  const optsWithYear: Intl.DateTimeFormatOptions = {
    ...opts,
    year: "numeric",
  };

  if (startDate === endDate) {
    return start.toLocaleDateString("de-DE", optsWithYear);
  }

  if (start.getFullYear() === end.getFullYear()) {
    return `${start.toLocaleDateString("de-DE", opts)} – ${end.toLocaleDateString("de-DE", optsWithYear)}`;
  }

  return `${start.toLocaleDateString("de-DE", optsWithYear)} – ${end.toLocaleDateString("de-DE", optsWithYear)}`;
}
