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

export const PDF_THEME_SPECS: Record<PdfTheme, PdfThemeSpec> = {
  classic: {
    label: "Classic",
    background: "#ffffff",
    text: "#1a1a1a",
    textMuted: "#6b7280",
    accent: "#374151",
    footer: "#9ca3af",
    placeholderBg: "#0d9488",
    placeholderText: "#ffffff",
  },
  warm: {
    label: "Warm",
    background: "#fdf6ee",
    text: "#2d1e0f",
    textMuted: "#8a6a4a",
    accent: "#78350f",
    footer: "#a87d4e",
    placeholderBg: "#a16207",
    placeholderText: "#fffbeb",
  },
  dark: {
    label: "Dark",
    background: "#1e1e1e",
    text: "#f5f5f5",
    textMuted: "#9ca3af",
    accent: "#d1d5db",
    footer: "#6b7280",
    placeholderBg: "#0f766e",
    placeholderText: "#f0fdfa",
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
  return `${base || "tagebuch"}-Tagebuch.pdf`;
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
