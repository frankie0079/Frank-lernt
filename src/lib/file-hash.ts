/**
 * PROJ-39: File-Dedup-Helpers.
 *
 * Browser-natives SHA-256 via Web Crypto API. Keine NPM-Dependency.
 * Alle Funktionen sind silent-fail: bei Timeout, Browser-Fehler oder
 * Netzwerk-Problemen geben sie `null` zurück, damit der Upload-Pfad
 * im Caller ohne Dedup weiterlaufen kann.
 */

/** Maximale Zeit für die Hash-Berechnung einer einzelnen Datei. */
const HASH_TIMEOUT_MS = 5000;

/** Shape of a minimal content item as returned by the duplicate probe. */
export interface DuplicateProbeItem {
  id: string;
  event_id: string;
  agenda_item_id: string | null;
  author_id: string;
  type: "photo" | "video" | "text" | "audio";
  media_url: string | null;
  thumbnail_url: string | null;
  caption: string | null;
  latitude: number | null;
  longitude: number | null;
  exif_date: string | null;
  created_at: string;
  file_hash?: string | null;
}

/**
 * Konvertiert einen ArrayBuffer in lowercase-hex.
 * Ausgabe ist exakt `buffer.byteLength * 2` Zeichen.
 */
function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

/**
 * Berechnet den SHA-256-Hash eines File oder Blob (lowercase hex, 64 chars).
 *
 * Akzeptiert sowohl `File` (Gallery-Upload) als auch `Blob` (MediaRecorder-
 * Output von Audio/Video-Aufnahmen), da `File extends Blob`.
 *
 * Bricht nach HASH_TIMEOUT_MS ab, fängt alle Fehler stumm ab und gibt
 * `null` zurück, wenn Dedup nicht möglich ist. Caller soll dann den
 * Upload ohne Dedup-Check fortsetzen.
 *
 * Keine `throw`s — nur `null` oder einen 64-Zeichen-Hex-String.
 */
export async function computeSHA256(file: Blob): Promise<string | null> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    return null;
  }

  try {
    const buffer = await readBlobWithTimeout(file, HASH_TIMEOUT_MS);
    if (!buffer) return null;

    const digest = await crypto.subtle.digest("SHA-256", buffer);
    const hex = bufferToHex(digest);

    // Defensive guard — `crypto.subtle.digest('SHA-256', ...)` muss 32 Bytes
    // liefern, aber wir verlassen uns nicht auf Polyfills oder SW-Rewrites.
    if (!/^[0-9a-f]{64}$/.test(hex)) {
      return null;
    }
    return hex;
  } catch {
    return null;
  }
}

/**
 * Liest einen Blob in einen ArrayBuffer mit harter Timeout-Grenze.
 * Gibt `null` zurück, wenn der Read länger als `timeoutMs` dauert oder scheitert.
 */
async function readBlobWithTimeout(
  blob: Blob,
  timeoutMs: number
): Promise<ArrayBuffer | null> {
  return new Promise((resolve) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(null);
    }, timeoutMs);

    // Bevorzuge die moderne `Blob.arrayBuffer()` API — sie ist ein Promise
    // und vermeidet das Event-Listener-Setup von FileReader.
    const maybePromise = blob.arrayBuffer?.();
    if (maybePromise && typeof maybePromise.then === "function") {
      maybePromise
        .then((buf) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(buf);
        })
        .catch(() => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(null);
        });
      return;
    }

    // Fallback via FileReader für alte Browser / exotische Polyfills.
    try {
      const reader = new FileReader();
      reader.onload = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const result = reader.result;
        resolve(result instanceof ArrayBuffer ? result : null);
      };
      reader.onerror = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(null);
      };
      reader.readAsArrayBuffer(blob);
    } catch {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(null);
    }
  });
}

/**
 * Fragt die Server-API, ob für ein Event bereits ein content_item mit
 * diesem Hash existiert (PROJ-39 Pre-Upload-Probe).
 *
 * Antwort-Contract vom Server:
 *   200 + { exists: true, content_item: {...} }  — Duplikat
 *   200 + { exists: false }                       — neu, Upload starten
 *   400 bei ungültigem Hash, 401/403 bei fehlenden Berechtigungen, etc.
 *
 * Bei jedem Fehler (Netzwerk, 4xx, 5xx, ungültige JSON) gibt die Funktion
 * `null` zurück — Caller soll den Upload ohne Dedup-Schutz fortsetzen.
 */
export async function checkDuplicate(
  eventId: string,
  hash: string
): Promise<DuplicateProbeItem | null> {
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) return null;

  try {
    const res = await fetch(
      `/api/events/${eventId}/content?hash=${encodeURIComponent(hash)}`,
      {
        method: "GET",
        credentials: "same-origin",
      }
    );

    if (!res.ok) return null;

    const data = (await res.json().catch(() => null)) as
      | { exists: boolean; content_item?: DuplicateProbeItem }
      | null;

    if (data && data.exists && data.content_item) {
      return data.content_item;
    }
    return null;
  } catch {
    return null;
  }
}
