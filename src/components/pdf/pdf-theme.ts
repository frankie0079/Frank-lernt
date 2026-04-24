// PROJ-37: Color + format primitives for the event-book PDF export.
// Kept as plain objects (no @react-pdf imports) so they can also be reused
// by the export dialog UI previews.

export const PDF_FORMATS = ["square", "a4-portrait", "a4-landscape"] as const;
export type PdfFormat = (typeof PDF_FORMATS)[number];

export const PDF_THEMES = ["classic", "warm", "dark"] as const;
export type PdfTheme = (typeof PDF_THEMES)[number];

export interface PdfFormatSpec {
  label: string;
  width: number;
  height: number;
}

// @react-pdf uses PostScript points (1pt = 1/72 inch). A4 = 595.28 × 841.89.
export const PDF_FORMAT_SPECS: Record<PdfFormat, PdfFormatSpec> = {
  square: { label: "Quadrat", width: 595.28, height: 595.28 },
  "a4-portrait": { label: "A4 Hoch", width: 595.28, height: 841.89 },
  "a4-landscape": { label: "A4 Quer", width: 841.89, height: 595.28 },
};

export interface PdfThemeSpec {
  label: string;
  background: string;
  text: string;
  textMuted: string;
  accent: string;
  footer: string;
  placeholderBg: string;
  placeholderText: string;
}

// Re-themed on the Aloha-Sixty palette (vintage Hawaii stamp). All three
// variants stay on-brand with the app, each hits a different mood:
//   classic → the "default postcard" (paper + ink, terracotta accent bar)
//   warm    → "golden hour" (paper-deep + forest, mustard accent bar)
//   dark    → "Aloha night" (forest-deep + paper, mustard accent bar)
export const PDF_THEME_SPECS: Record<PdfTheme, PdfThemeSpec> = {
  classic: {
    label: "Classic",
    background: "#F2E7CE",       // Paper
    text: "#0E1A1A",              // Ink
    textMuted: "#3A4747",         // fg-muted
    accent: "#C94A2B",            // Terracotta
    footer: "#6A7575",            // fg-subtle
    placeholderBg: "#2A6A6A",     // Teal (for missing-photo placeholders)
    placeholderText: "#F2E7CE",   // Paper
  },
  warm: {
    label: "Warm",
    background: "#E8D9B5",       // Paper-deep
    text: "#1E4A3C",              // Forest
    textMuted: "#3A4747",
    accent: "#E9B63A",            // Mustard
    footer: "#6A7575",
    placeholderBg: "#A93A1F",     // Terracotta-deep
    placeholderText: "#F2E7CE",
  },
  dark: {
    label: "Dark",
    background: "#143229",       // Forest-deep
    text: "#F2E7CE",              // Paper
    textMuted: "#E8D9B5",         // Paper-deep
    accent: "#E9B63A",            // Mustard
    footer: "#E8D9B5",
    placeholderBg: "#C94A2B",     // Terracotta
    placeholderText: "#F2E7CE",
  },
};

export function sanitizeFilename(eventName: string): string {
  const base = eventName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9äöüß -]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  // BUG-7: suffix lowercase for consistent casing across the whole filename.
  return `${base || "event"}-tagebuch.pdf`;
}

export function formatDateRange(
  startIso: string | null | undefined,
  endIso: string | null | undefined
): string {
  if (!startIso) return "";
  const format = (iso: string) =>
    new Date(iso + "T00:00:00").toLocaleDateString("de-DE", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  if (!endIso || endIso === startIso) return format(startIso);
  return `${format(startIso)} – ${format(endIso)}`;
}

export function formatDayLong(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
