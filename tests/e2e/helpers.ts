import { APIRequestContext, expect, Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const sharedFile = path.resolve(__dirname, ".auth/shared-event.json");

export interface SharedEvent {
  id: string;
  name: string;
  slug: string;
  marker: string;
  agendaItemId: string | null;
  agendaItems: Array<{ id: string; title: string }>;
}

/**
 * Read the shared test event (created by auth.setup.ts).
 * All specs use this instead of creating their own events, to stay
 * under the 30 writes/min/IP rate limit.
 */
let _cached: SharedEvent | null = null;
export function getSharedEvent(): SharedEvent {
  if (_cached) return _cached;
  if (!fs.existsSync(sharedFile)) {
    throw new Error(
      `Shared event file missing: ${sharedFile}\n` +
        "Run the 'setup' project first (or re-run the full suite)."
    );
  }
  _cached = JSON.parse(fs.readFileSync(sharedFile, "utf8")) as SharedEvent;
  return _cached;
}

/**
 * Unique marker string for test content (timestamp + random).
 * Used to identify and find test-created items in realtime UI.
 */
export function testMarker(label = "run"): string {
  return `E2E-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Create a text content item via API. Returns the created item's id.
 */
/**
 * Retry on 429 (rate limit). Backs off exponentially up to ~16s.
 */
export async function withRetry<T extends { status: () => number }>(
  fn: () => Promise<T>
): Promise<T> {
  const delays = [1000, 2000, 4000, 8000, 16000];
  let res = await fn();
  for (const delay of delays) {
    if (res.status() !== 429) return res;
    await new Promise((r) => setTimeout(r, delay));
    res = await fn();
  }
  return res;
}

async function postWithRetry(
  request: APIRequestContext,
  url: string,
  body: unknown
) {
  return withRetry(() => request.post(url, { data: body }));
}

export async function createTextContent(
  request: APIRequestContext,
  eventId: string,
  caption: string,
  agendaItemId: string | null = null
): Promise<{ id: string }> {
  const res = await postWithRetry(request, `/api/events/${eventId}/content`, {
    type: "text",
    caption,
    agenda_item_id: agendaItemId,
    latitude: null,
    longitude: null,
  });
  expect(
    res.ok(),
    `POST content failed: ${res.status()} ${await res.text()}`
  ).toBeTruthy();
  const json = await res.json();
  const id = json.content_item?.id ?? json.content?.id ?? json.id;
  if (!id) {
    throw new Error(`Could not extract content id from: ${JSON.stringify(json)}`);
  }
  return { id };
}

/**
 * Delete a single content item (for per-test cleanup where CASCADE isn't enough).
 */
export async function deleteContent(
  request: APIRequestContext,
  eventId: string,
  contentId: string
): Promise<void> {
  const res = await request.delete(`/api/events/${eventId}/content/${contentId}`);
  if (!res.ok() && res.status() !== 404) {
    console.warn(`[cleanup] DELETE content ${contentId} → ${res.status()}`);
  }
}

/**
 * Wait for text to appear in the DOM.
 */
export async function expectMarkerVisible(
  page: Page,
  marker: string,
  timeout = 15_000
) {
  await expect(page.getByText(marker).first()).toBeVisible({ timeout });
}
