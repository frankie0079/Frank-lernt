// PROJ-37: Photo layouts translated from the on-screen Tagebuch view into
// @react-pdf/renderer primitives. Each layout receives a pre-computed
// `width`/`height` in pt for its hero grid area plus the items, and returns
// a <View> tree that @react-pdf lays out with flexbox.

import { Image, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { BookLayout, BookPageItem } from "@/lib/book-types";
import type { PdfThemeSpec } from "./pdf-theme";

const GAP = 6;

const styles = StyleSheet.create({
  row: { flexDirection: "row" },
  col: { flexDirection: "column" },
  image: { width: "100%", height: "100%", objectFit: "contain" },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
  placeholderText: { fontSize: 8, textAlign: "center" },
  noteTile: {
    padding: 8,
    flex: 1,
  },
  noteText: { fontSize: 9, lineHeight: 1.4 },
  noteAuthor: { fontSize: 7, marginTop: 4 },
  videoBadge: {
    position: "absolute",
    bottom: 4,
    left: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    color: "#ffffff",
    fontSize: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
  },
  sideText: {
    fontSize: 11,
    lineHeight: 1.5,
  },
});

interface TileProps {
  item: BookPageItem;
  width: number;
  height: number;
  theme: PdfThemeSpec;
}

function Tile({ item, width, height, theme }: TileProps) {
  // Prefer full-resolution media_url for the PDF; thumbnails (typically ~400px)
  // pixelate badly at print resolutions (A4 @ 300dpi ≈ 2480px wide).
  const src = item.media_url || item.thumbnail_url;
  const isMedia = item.type === "photo" || item.type === "video";

  if (isMedia && src) {
    return (
      <View style={{ width, height, position: "relative", overflow: "hidden" }}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src={src} style={styles.image} />
        {item.type === "video" && (
          <Text style={styles.videoBadge}>▶ Video</Text>
        )}
      </View>
    );
  }

  if (item.type === "text" || item.type === "audio") {
    return (
      <View
        style={{
          width,
          height,
          backgroundColor: theme.placeholderBg + "22",
          padding: 8,
        }}
      >
        <Text style={[styles.noteText, { color: theme.text }]}>
          {item.caption || "(kein Text)"}
        </Text>
        {item.author_name && (
          <Text style={[styles.noteAuthor, { color: theme.textMuted }]}>
            — {item.author_name}
          </Text>
        )}
      </View>
    );
  }

  // Missing source → teal placeholder
  return (
    <View
      style={{
        width,
        height,
        backgroundColor: theme.placeholderBg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={[styles.placeholderText, { color: theme.placeholderText }]}>
        Foto nicht verfügbar
      </Text>
    </View>
  );
}

interface PhotoLayoutProps {
  layout: BookLayout;
  items: BookPageItem[];
  /** Available width for the grid in pt */
  width: number;
  /** Available height for the grid in pt */
  height: number;
  /** Side text for `text-left` layout */
  sideText?: string | null;
  theme: PdfThemeSpec;
}

/**
 * Render the given layout into a fixed (width × height) box. The caller is
 * responsible for sizing — we just fill the box.
 *
 * For layouts with more items than slots, we drop the surplus (the on-screen
 * editor already warned). Keeping it simple: one book_section = one PDF page.
 */
export function PdfPhotoLayout({
  layout,
  items,
  width,
  height,
  sideText,
  theme,
}: PhotoLayoutProps) {
  if (items.length === 0) {
    return (
      <View
        style={{
          width,
          height,
          backgroundColor: theme.placeholderBg + "22",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 10, color: theme.textMuted }}>
          Keine Beiträge auf dieser Seite
        </Text>
      </View>
    );
  }

  switch (layout) {
    case "single": {
      const item = items[0];
      return (
        <Tile item={item} width={width} height={height} theme={theme} />
      );
    }
    case "two": {
      const two = items.slice(0, 2);
      const tileW = (width - GAP) / 2;
      return (
        <View style={styles.row}>
          {two.map((item, idx) => (
            <View
              key={item.id}
              style={{ marginLeft: idx === 0 ? 0 : GAP }}
            >
              <Tile item={item} width={tileW} height={height} theme={theme} />
            </View>
          ))}
        </View>
      );
    }
    case "three": {
      const three = items.slice(0, 3);
      const tileW = (width - 2 * GAP) / 3;
      return (
        <View style={styles.row}>
          {three.map((item, idx) => (
            <View key={item.id} style={{ marginLeft: idx === 0 ? 0 : GAP }}>
              <Tile item={item} width={tileW} height={height} theme={theme} />
            </View>
          ))}
        </View>
      );
    }
    case "four": {
      const four = items.slice(0, 4);
      const tileW = (width - GAP) / 2;
      const tileH = (height - GAP) / 2;
      return (
        <View style={styles.col}>
          {[0, 1].map((row) => (
            <View
              key={row}
              style={[styles.row, { marginTop: row === 0 ? 0 : GAP }]}
            >
              {[0, 1].map((col) => {
                const item = four[row * 2 + col];
                if (!item) return null;
                return (
                  <View
                    key={item.id}
                    style={{ marginLeft: col === 0 ? 0 : GAP }}
                  >
                    <Tile
                      item={item}
                      width={tileW}
                      height={tileH}
                      theme={theme}
                    />
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      );
    }
    case "five-hero": {
      const five = items.slice(0, 5);
      const [hero, ...quad] = five;
      const heroH = (height - GAP) * 0.55;
      const quadH = (height - GAP) * 0.45;
      const tileW = (width - GAP) / 2;
      const tileH = (quadH - GAP) / 2;
      return (
        <View style={styles.col}>
          {hero && (
            <Tile item={hero} width={width} height={heroH} theme={theme} />
          )}
          {quad.length > 0 && (
            <View style={[styles.col, { marginTop: GAP }]}>
              {[0, 1].map((row) => (
                <View
                  key={row}
                  style={[styles.row, { marginTop: row === 0 ? 0 : GAP }]}
                >
                  {[0, 1].map((col) => {
                    const item = quad[row * 2 + col];
                    if (!item) return null;
                    return (
                      <View
                        key={item.id}
                        style={{ marginLeft: col === 0 ? 0 : GAP }}
                      >
                        <Tile
                          item={item}
                          width={tileW}
                          height={tileH}
                          theme={theme}
                        />
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          )}
        </View>
      );
    }
    case "grid-3": {
      // Flowing 3-column square grid. Scale columns to fit width; compute rows
      // needed and fit them into the available height (scale down if needed).
      const cols = 3;
      const tileW = (width - (cols - 1) * GAP) / cols;
      const rows = Math.ceil(items.length / cols);
      const naturalH = rows * tileW + (rows - 1) * GAP;
      const scale = naturalH > height ? height / naturalH : 1;
      const actualTileW = tileW * scale;
      const actualTileH = tileW * scale;
      return (
        <View style={styles.col}>
          {Array.from({ length: rows }).map((_, row) => (
            <View
              key={row}
              style={[styles.row, { marginTop: row === 0 ? 0 : GAP * scale }]}
            >
              {Array.from({ length: cols }).map((_, col) => {
                const item = items[row * cols + col];
                if (!item) return null;
                return (
                  <View
                    key={item.id}
                    style={{ marginLeft: col === 0 ? 0 : GAP * scale }}
                  >
                    <Tile
                      item={item}
                      width={actualTileW}
                      height={actualTileH}
                      theme={theme}
                    />
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      );
    }
    case "text-left": {
      const first = items[0];
      const halfW = (width - GAP) / 2;
      return (
        <View style={styles.row}>
          <View
            style={{
              width: halfW,
              height,
              backgroundColor: theme.placeholderBg + "15",
              padding: 12,
              justifyContent: "center",
            }}
          >
            {sideText ? (
              <Text style={[styles.sideText, { color: theme.text }]}>
                {sideText}
              </Text>
            ) : (
              <Text
                style={{
                  fontSize: 10,
                  fontStyle: "italic",
                  color: theme.textMuted,
                }}
              >
                Kein Kommentar hinterlegt.
              </Text>
            )}
          </View>
          {first && (
            <View style={{ marginLeft: GAP }}>
              <Tile item={first} width={halfW} height={height} theme={theme} />
            </View>
          )}
        </View>
      );
    }
  }
  return null;
}
