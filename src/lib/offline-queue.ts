/**
 * Offline content queue using IndexedDB.
 * Stores failed content submissions and retries when back online.
 */

const DB_NAME = "eventdocs-offline";
const DB_VERSION = 1;
const STORE_NAME = "pending-content";

export interface QueuedContent {
  id: string;
  eventId: string;
  payload: Record<string, unknown>;
  createdAt: number;
  retryCount: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Add a failed content submission to the offline queue. */
export async function enqueue(eventId: string, payload: Record<string, unknown>): Promise<string> {
  const db = await openDB();
  const id = crypto.randomUUID();
  const item: QueuedContent = {
    id,
    eventId,
    payload,
    createdAt: Date.now(),
    retryCount: 0,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).add(item);
    tx.oncomplete = () => resolve(id);
    tx.onerror = () => reject(tx.error);
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

/** Flush the queue — retry all pending content submissions. Returns count of successful syncs. */
export async function flushQueue(): Promise<number> {
  const pending = await getPending();
  let synced = 0;

  for (const item of pending) {
    try {
      const res = await fetch(`/api/events/${item.eventId}/content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.payload),
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
