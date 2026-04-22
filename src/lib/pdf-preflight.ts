// PROJ-37 BUG-1: Preflight-Validierung aller Foto-URLs bevor @react-pdf/renderer
// den Document-Tree baut. @react-pdf hat keinen per-Image onError-Hook —
// eine einzige 404-URL bricht den ganzen Render ab. Wir prüfen daher alle
// media_urls parallel per HEAD-Request und markieren kaputte Items als
// `type: null`, sodass der vorhandene Teal-Platzhalter im Tile greift.

import type { BookPage, BookPageItem } from "@/lib/book-types";

const HEAD_TIMEOUT_MS = 5_000;

async function urlAvailable(url: string): Promise<boolean> {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), HEAD_TIMEOUT_MS);
    const res = await fetch(url, {
      method: "HEAD",
      mode: "cors",
      cache: "no-cache",
      signal: ctl.signal,
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

export interface PreflightResult {
  pages: BookPage[];
  validated: number;
  broken: number;
  coverBroken: boolean;
}

/**
 * Pre-flight check: verify every media URL referenced by the PDF renders.
 * Returns a *copy* of the input with broken items' `type` set to `null`
 * (the existing placeholder signal) and `media_url`/`thumbnail_url` blanked.
 * Also probes the cover URL — on failure, the caller can swap to null to
 * render the solid accent background.
 *
 * Progress callback is invoked once per URL (post-check) so the UI can
 * render "Prüfe X / Y Fotos…".
 */
export async function preflightPdfUrls(
  pages: BookPage[],
  coverUrl: string | null | undefined,
  onProgress?: (done: number, total: number) => void
): Promise<PreflightResult> {
  // Collect all unique URLs → the same media_url can be shared across
  // sections (though unlikely) and we don't want to HEAD twice.
  const urls = new Set<string>();
  if (coverUrl) urls.add(coverUrl);
  for (const p of pages) {
    for (const sec of p.sections ?? []) {
      for (const item of sec.items) {
        const u = item.media_url || item.thumbnail_url;
        if (u && (item.type === "photo" || item.type === "video")) {
          urls.add(u);
        }
      }
    }
  }

  const total = urls.size;
  if (total === 0) {
    return { pages, validated: 0, broken: 0, coverBroken: false };
  }

  const availability = new Map<string, boolean>();
  let done = 0;

  // Limit concurrency so we don't hammer Supabase; 8 parallel is a good
  // trade-off between speed and politeness.
  const urlArray = Array.from(urls);
  const CONCURRENCY = 8;
  let idx = 0;

  async function worker() {
    while (idx < urlArray.length) {
      const url = urlArray[idx++];
      const ok = await urlAvailable(url);
      availability.set(url, ok);
      done++;
      onProgress?.(done, total);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, urlArray.length) }, worker)
  );

  const coverBroken = coverUrl ? availability.get(coverUrl) === false : false;

  let brokenCount = 0;
  const validatedPages = pages.map((p) => ({
    ...p,
    sections: (p.sections ?? []).map((sec) => ({
      ...sec,
      items: sec.items.map<BookPageItem>((item) => {
        if (item.type !== "photo" && item.type !== "video") return item;
        const url = item.media_url || item.thumbnail_url;
        if (!url) return item;
        const ok = availability.get(url);
        if (ok === false) {
          brokenCount++;
          return {
            ...item,
            type: null,
            media_url: null,
            thumbnail_url: null,
          };
        }
        return item;
      }),
    })),
  }));

  return {
    pages: validatedPages,
    validated: total - brokenCount,
    broken: brokenCount,
    coverBroken,
  };
}
