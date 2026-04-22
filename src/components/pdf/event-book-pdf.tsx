// PROJ-37: The full event Tagebuch Document. Composes a consolidated cover
// (photo + title + optional about-box), an optional TOC, and one page per
// book_section.

import { Document } from "@react-pdf/renderer";
import type { BookPage } from "@/lib/book-types";
import { CoverPage } from "./cover-page";
import {
  PDF_FORMAT_SPECS,
  PDF_THEME_SPECS,
  type PdfFormat,
  type PdfTheme,
} from "./pdf-theme";
import { SectionPage } from "./section-page";
import { TocPage, type TocEntry } from "./toc-page";

export interface EventBookPdfProps {
  eventName: string;
  description?: string | null;
  coverUrl?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  members: Array<{ id: string; name: string; avatar_url?: string | null }>;
  /** Already filtered to visible pages with at least one section */
  pages: BookPage[];
  format: PdfFormat;
  theme: PdfTheme;
  /** Render the about-box (description + members) on the cover page. Default off. */
  includeAboutPage?: boolean;
  /** Add a table-of-contents page between cover and first day. Default off. */
  includeToc?: boolean;
}

export function EventBookPdf({
  eventName,
  description,
  coverUrl,
  startDate,
  endDate,
  members,
  pages,
  format,
  theme,
  includeAboutPage = false,
  includeToc = false,
}: EventBookPdfProps) {
  const fmt = PDF_FORMAT_SPECS[format];
  const thm = PDF_THEME_SPECS[theme];

  // Dynamic page numbering:
  //   1                — Cover (always)
  //   (2)              — TOC (optional)
  //   next..N          — section pages
  let nextPageNumber = 2;
  const tocPageNumber = includeToc ? nextPageNumber++ : null;
  const firstSectionPage = nextPageNumber;

  // Flatten pages → sections in order
  const flatSections = pages.flatMap((p, dayIdx) =>
    (p.sections ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((s, secIdx, arr) => ({
        dayIndex: dayIdx + 1,
        dayDate: p.agenda_date,
        dayTitle: p.agenda_title,
        section: s,
        sectionIndex: secIdx,
        sectionCount: arr.length,
      }))
  );

  const totalPages = firstSectionPage - 1 + flatSections.length;

  // Build TOC entries — one per day, pointing at the day's first section page
  const tocEntries: TocEntry[] = [];
  let running = firstSectionPage;
  for (const p of pages) {
    const secCount = (p.sections ?? []).length;
    if (secCount === 0) continue;
    tocEntries.push({
      date: p.agenda_date,
      title: p.agenda_title,
      pageNumber: running,
    });
    running += secCount;
  }

  return (
    <Document
      title={`${eventName} — Tagebuch`}
      author={eventName}
      subject="EventDocs Tagebuch"
    >
      <CoverPage
        eventName={eventName}
        startDate={startDate}
        endDate={endDate}
        coverUrl={coverUrl}
        format={fmt}
        theme={thm}
        totalPages={totalPages}
        about={
          includeAboutPage
            ? { description, members }
            : undefined
        }
      />
      {includeToc && tocPageNumber !== null && (
        <TocPage
          entries={tocEntries}
          format={fmt}
          theme={thm}
          eventName={eventName}
          currentPageNumber={tocPageNumber}
          totalPages={totalPages}
        />
      )}
      {flatSections.map((entry, idx) => (
        <SectionPage
          key={entry.section.id}
          dayIndex={entry.dayIndex}
          dayDate={entry.dayDate}
          dayTitle={entry.dayTitle}
          section={entry.section}
          sectionIndex={entry.sectionIndex}
          sectionCount={entry.sectionCount}
          format={fmt}
          theme={thm}
          eventName={eventName}
          currentPageNumber={firstSectionPage + idx}
          totalPages={totalPages}
        />
      ))}
    </Document>
  );
}
