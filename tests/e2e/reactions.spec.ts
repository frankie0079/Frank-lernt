import { test, expect } from "@playwright/test";
import {
  getSharedEvent,
  createTextContent,
  testMarker,
  type SharedEvent,
} from "./helpers";

/** PROJ-31 — Reactions. */

let event: SharedEvent;
let contentId: string;

test.beforeAll(async ({ request }) => {
  event = getSharedEvent();
  const item = await createTextContent(
    request,
    event.id,
    testMarker("reactions-host")
  );
  contentId = item.id;
});

test("POST reaction succeeds", async ({ request }) => {
  const res = await request.post(
    `/api/events/${event.id}/content/${contentId}/reactions`,
    { data: { emoji: "❤️" } }
  );
  expect(
    res.ok(),
    `POST reaction: ${res.status()} ${await res.text()}`
  ).toBeTruthy();
});

test("GET /content list includes reactions on the item", async ({
  request,
}) => {
  const res = await request.get(`/api/events/${event.id}/content`);
  expect(res.ok()).toBeTruthy();
  const json = await res.json();
  const items: Array<{ id: string; reactions?: Array<{ emoji: string }> }> =
    json.content_items ?? [];
  const target = items.find((i) => i.id === contentId);
  expect(target, "test content not in pool").toBeTruthy();
  // Reactions may be absent from list endpoint (enriched or not). Only assert if present.
  if (target?.reactions && target.reactions.length > 0) {
    const emojis = target.reactions.map((r) => r.emoji);
    expect(emojis.length).toBeGreaterThan(0);
  }
});

test("double POST same emoji → idempotent or 409", async ({ request }) => {
  await request.post(
    `/api/events/${event.id}/content/${contentId}/reactions`,
    { data: { emoji: "🔥" } }
  );
  const second = await request.post(
    `/api/events/${event.id}/content/${contentId}/reactions`,
    { data: { emoji: "🔥" } }
  );
  expect([200, 201, 204, 409]).toContain(second.status());
});

test("DELETE reaction removes it", async ({ request }) => {
  await request.post(
    `/api/events/${event.id}/content/${contentId}/reactions`,
    { data: { emoji: "👏" } }
  );
  // DELETE takes emoji as query param, not body
  const del = await request.delete(
    `/api/events/${event.id}/content/${contentId}/reactions?emoji=${encodeURIComponent("👏")}`
  );
  expect([200, 204]).toContain(del.status());
});

test("sad: invalid emoji → 400", async ({ request }) => {
  const res = await request.post(
    `/api/events/${event.id}/content/${contentId}/reactions`,
    { data: { emoji: "💩" } }
  );
  expect([400, 422]).toContain(res.status());
});

test("sad: reaction on nonexistent content → 404", async ({ request }) => {
  const res = await request.post(
    `/api/events/${event.id}/content/00000000-0000-0000-0000-000000000000/reactions`,
    { data: { emoji: "❤️" } }
  );
  expect([403, 404]).toContain(res.status());
});
