// PROJ-37: Consolidated cover page — photo on top, Caveat-script title in a
// narrow accent bar below, optional "about box" (description + members) in
// the bottom-right corner.

import { Font, Image, Page, Text, View } from "@react-pdf/renderer";
import type { PdfFormatSpec, PdfThemeSpec } from "./pdf-theme";
import { formatDateRange } from "./pdf-theme";

// Register the Caveat handwriting font used in the app so the PDF cover
// matches the app look. TTFs are served locally from /public/fonts/ — relying
// on gstatic.com CDN caused sporadic render failures (stale hash URLs).
// Safe to call multiple times — @react-pdf treats repeated register as no-op.
if (typeof window !== "undefined") {
  Font.register({
    family: "Caveat",
    fonts: [
      { src: "/fonts/Caveat-Regular.ttf", fontWeight: 400 },
      { src: "/fonts/Caveat-Bold.ttf", fontWeight: 700 },
    ],
  });
}

interface CoverPageProps {
  eventName: string;
  startDate?: string | null;
  endDate?: string | null;
  coverUrl?: string | null;
  format: PdfFormatSpec;
  theme: PdfThemeSpec;
  /** When set, renders a compact "about" box at the bottom right of the cover */
  about?: {
    description?: string | null;
    members: Array<{ id: string; name: string; avatar_url?: string | null }>;
  };
}

export function CoverPage({
  eventName,
  startDate,
  endDate,
  coverUrl,
  format,
  theme,
  about,
}: CoverPageProps) {
  // Layout proportions. The Caveat handwriting font has long descenders, so
  // the bar needs generous vertical room — min 120pt is enough for a 40pt
  // title at line-height 1.5 plus date + label + padding.
  const imageH = format.height * 0.58;
  const barH = Math.max(120, format.height * 0.18);
  const barTop = imageH;
  const bottomArea = format.height - imageH - barH;

  const hasAbout =
    !!about && (!!about.description || about.members.length > 0);
  const aboutBoxW = Math.min(format.width * 0.5, 260);
  const aboutBoxH = Math.min(bottomArea - 24, 150);

  return (
    <Page
      size={{ width: format.width, height: format.height }}
      style={{ backgroundColor: theme.background }}
    >
      {/* Image area — background fill so "contain" letterboxing blends */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: format.width,
          height: imageH,
          backgroundColor: theme.accent,
        }}
      />
      {coverUrl && (
        /* eslint-disable-next-line jsx-a11y/alt-text */
        <Image
          src={coverUrl}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: format.width,
            height: imageH,
            objectFit: "contain",
          }}
        />
      )}

      {/* Narrow accent bar with Caveat title */}
      <View
        style={{
          position: "absolute",
          top: barTop,
          left: 0,
          width: format.width,
          height: barH,
          backgroundColor: theme.accent,
          paddingLeft: 32,
          paddingRight: 32,
          paddingTop: 12,
          paddingBottom: 12,
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            fontFamily: "Caveat",
            fontWeight: 700,
            fontSize: Math.min(40, format.width / 16),
            color: theme.background,
            lineHeight: 1.5,
          }}
        >
          {eventName}
        </Text>
        {(startDate || endDate) && (
          <Text
            style={{
              marginTop: 16,
              fontSize: 11,
              color: theme.background,
              opacity: 0.85,
            }}
          >
            {formatDateRange(startDate, endDate)}
          </Text>
        )}
        <Text
          style={{
            marginTop: 6,
            fontSize: 8,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: theme.background,
            opacity: 0.7,
          }}
        >
          Tagebuch
        </Text>
      </View>

      {/* About box — floating in the bottom-right corner */}
      {hasAbout && about && (
        <View
          style={{
            position: "absolute",
            right: 24,
            bottom: 24,
            width: aboutBoxW,
            maxHeight: aboutBoxH,
            padding: 12,
            backgroundColor: theme.background,
            borderWidth: 0.5,
            borderColor: theme.footer,
          }}
        >
          <Text
            style={{
              fontSize: 7,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: theme.textMuted,
              marginBottom: 4,
            }}
          >
            Über dieses Tagebuch
          </Text>
          {about.description && (
            <Text
              style={{
                fontSize: 9,
                lineHeight: 1.4,
                color: theme.text,
                marginBottom: 8,
              }}
            >
              {about.description.length > 180
                ? about.description.slice(0, 180).trim() + "…"
                : about.description}
            </Text>
          )}
          {about.members.length > 0 && (
            <View>
              <Text
                style={{
                  fontSize: 7,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  color: theme.textMuted,
                  marginBottom: 4,
                }}
              >
                Teilnehmer ({about.members.length})
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {about.members.slice(0, 8).map((m) => (
                  <View
                    key={m.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginRight: 8,
                      marginBottom: 4,
                    }}
                  >
                    <View
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 7,
                        backgroundColor: theme.accent,
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                        marginRight: 4,
                      }}
                    >
                      {m.avatar_url ? (
                        /* eslint-disable-next-line jsx-a11y/alt-text */
                        <Image
                          src={m.avatar_url}
                          style={{ width: 14, height: 14, objectFit: "cover" }}
                        />
                      ) : (
                        <Text
                          style={{
                            fontSize: 7,
                            fontFamily: "Helvetica-Bold",
                            color: theme.background,
                          }}
                        >
                          {m.name.charAt(0).toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <Text style={{ fontSize: 8, color: theme.text }}>
                      {m.name}
                    </Text>
                  </View>
                ))}
                {about.members.length > 8 && (
                  <Text style={{ fontSize: 8, color: theme.textMuted }}>
                    +{about.members.length - 8}
                  </Text>
                )}
              </View>
            </View>
          )}
        </View>
      )}
    </Page>
  );
}
