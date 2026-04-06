/**
 * Offline content queue using IndexedDB.
 * Stores failed content submissions and retries when back online.
 * Photo items store the original file blob so the full pipeline
 * (EXIF, compress, upload) can be re-run on retry.
 */

/** Thrown when IndexedDB storage quota is exceeded. */
export class OfflineQuotaError extends Error {
  constructor() {
    super("Offline-Speicher voll. Bitte verbinde dich mit dem Internet, um gestaute Beitr\u00e4ge zu senden.");
    this.name = "OfflineQuotaError";
  }
}

const DB_NAME = "eventdocs-offline";
const DB_VERSION = 2;
const STORE_NAME = "pending-content";

export interface QueuedContent {
  id: string;
  eventId: string;
  userId: string;
  payload: Record<string, unknown>;
  /** Original image file stored as Blob for photo items. */
  fileBlob: Blob | null;
  createdAt: number;
  retryCount: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const oldVersion = event.oldVersion;
      if (oldVersion < 1) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
      // v2: added fileBlob + userId fields — no store schema change needed
      // (IndexedDB is schemaless for value fields, only keyPath matters)
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Add a failed content submission to the offline queue. */
export async function enqueue(
  eventId: string,
  userId: string,
  payload: Record<string, unknown>,
  file?: File | Blob | null
): Promise<string> {
  const db = await openDB();
  const id = crypto.randomUUID();
  const item: QueuedContent = {
    id,
    eventId,
    userId,
    payload,
    fileBlob: file ?? null,
    createdAt: Date.now(),
    retryCount: 0,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).add(item);
    tx.oncomplete = () => resolve(id);
    tx.onerror = () => {
      // QuotaExceededError: storage is full (typically 50–100 MB per origin)
      const err = tx.error;
      if (err && (err.name === "QuotaExceededError" || err.name === "NS_ERROR_DOM_QUOTA_REACHED")) {
        reject(new OfflineQuotaError());
      } else {
        reject(err);
      }
    };
  });
}

/** Get all pending items from the queue. */
export async function getPending(): Promise<QueuedContent[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Remove an item from the queue (after successful sync). */
export async function dequeue(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Update retry count for an item. */
export async function incrementRetry(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const item = getReq.result as QueuedContent | undefined;
      if (item) {
        item.retryCount += 1;
        store.put(item);
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Flush the queue — retry all pending content submissions.
 * For photo items with a stored blob, re-runs the full upload pipeline
 * (EXIF extraction, compression, storage upload) before POSTing.
 * Returns count of successful syncs.
 */
export async function flushQueue(): Promise<number> {
  const pending = await getPending();
  let synced = 0;

  for (const item of pending) {
    // Skip items that have failed too many times
    if (item.retryCount >= 5) continue;

    try {
      let payload = { ...item.payload };

      // If this is a photo item with a stored blob, re-run the upload pipeline
      if (payload.type === "photo" && item.fileBlob) {
        const { processAndUploadImage } = await import("@/lib/content-upload");
        const file = new File([item.fileBlob], "offline-photo.jpg", {
          type: "image/jpeg",
        });
        const result = await processAndUploadImage(
          file,
          item.eventId,
          item.userId
        );
        payload = {
          ...payload,
          media_url: result.mediaUrl,
          thumbnail_url: result.thumbnailUrl,
          // Prefer EXIF GPS over device GPS already in payload
          latitude: result.exif.latitude ?? payload.latitude,
          longitude: result.exif.longitude ?? payload.longitude,
          exif_date: result.exif.exifDate,
        };
      }

      // If this is an audio item with a stored blob, re-upload to storage
      if (payload.type === "audio" && item.fileBlob) {
        const { uploadAudioToStorage } = await import("@/lib/content-upload");
        const mimeType =
          (payload.audio_mime_type as string | undefined) || "audio/webm";
        const result = await uploadAudioToStorage(
          item.eventId,
          item.userId,
          item.fileBlob,
          mimeType
        );
        payload = {
          ...payload,
          media_url: result.mediaUrl,
        };
        // Strip the helper field — backend doesn't expect it
        delete (payload as Record<string, unknown>).audio_mime_type;
      }

      const res = await fetch(`/api/events/${item.eventId}/content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await dequeue(item.id);
        synced++;
      } else {
        await incrementRetry(item.id);
      }
    } catch {
      await incrementRetry(item.id);
    }
  }

  return synced;
}

/** Start listening for online events and auto-flush. */
export function startOnlineSync(onSync?: (count: number) => void): () => void {
  const handler = async () => {
    const count = await flushQueue();
    if (count > 0) {
      onSync?.(count);
    }
  };

  window.addEventListener("online", handler);

  // Also try to flush immediately if already online
  if (navigator.onLine) {
    handler();
  }

  return () => window.removeEventListener("online", handler);
}
