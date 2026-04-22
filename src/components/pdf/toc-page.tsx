// PROJ-37: Table of contents page — lists every visible agenda day with the
// PDF page number where it starts.

import { Page, Text, View } from "@react-pdf/renderer";
import type { PdfFormatSpec, PdfThemeSpec } from "./pdf-theme";
import { formatDayLong } from "./pdf-theme";

export interface TocEntry {
  date: string;
  title: string;
  /** 1-based page number as displayed in footer */
  pageNumber: number;
}

interface TocPageProps {
  entries: TocEntry[];
  format: PdfFormatSpec;
  theme: PdfThemeSpec;
  eventName: string;
  currentPageNumber: number;
  totalPages: number;
}

export function TocPage({
  entries,
  format,
  theme,
  eventName,
  currentPageNumber,
  totalPages,
}: TocPageProps) {
  return (
    <Page
      size={{ width: format.width, height: format.height }}
      style={{
        backgroundColor: theme.background,
        paddingTop: 48,
        paddingBottom: 40,
        paddingLeft: 48,
        paddingRight: 48,
      }}
    >
      <Text
        style={{
          fontSize: 10,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: theme.textMuted,
        }}
      >
        Inhalt
      </Text>
      <Text
        style={{
          marginTop: 4,
          fontSize: 22,
          fontFamily: "Helvetica-Bold",
          color: theme.text,
        }}
      >
        Unsere Tage
      </Text>

      <View style={{ marginTop: 24 }}>
        {entries.length === 0 ? (
          <Text
            style={{
              fontSize: 11,
              fontStyle: "italic",
              color: theme.textMuted,
            }}
          >
            Noch keine Tage veröffentlicht.
          </Text>
        ) : (
          entries.map((entry, idx) => (
            <View
              key={`${entry.date}-${idx}`}
              style={{
                flexDirection: "row",
                alignItems: "flex-end",
                marginBottom: 10,
                borderBottomWidth: 0.5,
                borderBottomColor: theme.footer,
                paddingBottom: 6,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{ fontSize: 8, color: theme.textMuted, marginBottom: 2 }}
                >
                  {formatDayLong(entry.date)}
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: "Helvetica-Bold",
                    color: theme.text,
                  }}
                >
                  {entry.title}
                </Text>
              </View>
              <Text
                style={{
                  fontSize: 12,
                  color: theme.accent,
                  fontFamily: "Helvetica-Bold",
                  marginLeft: 16,
                }}
              >
                {entry.pageNumber}
              </Text>
            </View>
          ))
        )}
      </View>

      {/* Footer */}
      <View
        style={{
          position: "absolute",
          bottom: 20,
          left: 40,
          right: 40,
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
