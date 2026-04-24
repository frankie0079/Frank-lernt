// PROJ-37: One PDF page per book_section. Header (day + title), photo grid,
// optional comment, footer (event + page X/Y).

import { Page, Text, View } from "@react-pdf/renderer";
import type { BookLayout, BookPageItem } from "@/lib/book-types";
import type { PdfFormatSpec, PdfThemeSpec } from "./pdf-theme";
import { formatDayLong } from "./pdf-theme";
import { PdfPhotoLayout } from "./photo-layouts";

const PAGE_PADDING = 36;
const HEADER_HEIGHT = 54;
const FOOTER_HEIGHT = 20;
const COMMENT_RESERVED = 70;
const MAX_COMMENT_CHARS = 2000;

function truncateComment(text: string | null | undefined): string {
  if (!text) return "";
  if (text.length <= MAX_COMMENT_CHARS) return text;
  return text.slice(0, MAX_COMMENT_CHARS).trimEnd() + "…";
}

interface SectionPageProps {
  dayIndex: number;
  dayDate: string;
  dayTitle: string;
  section: {
    id: string;
    layout: BookLayout;
    comment: string;
    items: BookPageItem[];
  };
  sectionIndex: number;
  sectionCount: number;
  format: PdfFormatSpec;
  theme: PdfThemeSpec;
  eventName: string;
  currentPageNumber: number;
  totalPages: number;
}

export function SectionPage({
  dayIndex,
  dayDate,
  dayTitle,
  section,
  sectionIndex,
  sectionCount,
  format,
  theme,
  eventName,
  currentPageNumber,
  totalPages,
}: SectionPageProps) {
  const contentWidth = format.width - PAGE_PADDING * 2;
  const hasComment = Boolean(section.comment && section.layout !== "text-left");
  const reservedForComment = hasComment ? COMMENT_RESERVED : 0;
  const gridHeight =
    format.height -
    PAGE_PADDING * 2 -
    HEADER_HEIGHT -
    FOOTER_HEIGHT -
    reservedForComment;

  return (
    <Page
      size={{ width: format.width, height: format.height }}
      style={{
        backgroundColor: theme.background,
        padding: PAGE_PADDING,
      }}
    >
      {/* Header */}
      <View style={{ marginBottom: 12 }}>
        <Text
          style={{
            fontSize: 8,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            color: theme.textMuted,
          }}
        >
          Tag {dayIndex} · {formatDayLong(dayDate)}
        </Text>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginTop: 4,
          }}
        >
          <Text
            style={{
              fontSize: 28,
              fontFamily: "AlfaSlabOne",
              fontWeight: 400,
              color: theme.text,
              flex: 1,
              lineHeight: 1.1,
            }}
          >
            {dayTitle}
          </Text>
          {sectionCount > 1 && (
            <Text
              style={{
                fontSize: 8,
                color: theme.textMuted,
                marginLeft: 12,
              }}
            >
              Seite {sectionIndex + 1} / {sectionCount}
            </Text>
          )}
        </View>
        <View
          style={{
            marginTop: 10,
            height: 1,
            backgroundColor: theme.accent,
            opacity: 0.3,
          }}
        />
      </View>

      {/* Photo grid */}
      <PdfPhotoLayout
        layout={section.layout}
        items={section.items}
        width={contentWidth}
        height={gridHeight}
        sideText={
          section.layout === "text-left" ? truncateComment(section.comment) : null
        }
        theme={theme}
      />

      {/* Comment (for non-text-left layouts) — BUG-3 truncate at 2000 chars */}
      {hasComment && (
        <Text
          style={{
            marginTop: 12,
            fontSize: 11,
            lineHeight: 1.5,
            color: theme.text,
          }}
        >
          {truncateComment(section.comment)}
        </Text>
      )}

      {/* Footer */}
      <View
        style={{
          position: "absolute",
          bottom: 16,
          left: PAGE_PADDING,
          right: PAGE_PADDING,
          flexDirection: "row",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ fontSize: 8, color: theme.footer }}>{eventName}</Text>
        <Text style={{ fontSize: 8, color: theme.footer }}>
          Seite {currentPageNumber} / {totalPages}
        </Text>
      </View>
    </Page>
  );
}
