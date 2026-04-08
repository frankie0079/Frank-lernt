import { test, expect } from "@playwright/test";
import {
  getSharedEvent,
  createTextContent,
  testMarker,
  type SharedEvent,
} from "./helpers";

/** PROJ-32 — Comment threads. */

let event: SharedEvent;
let contentId: string;

test.beforeAll(async ({ request }) => {
  event = getSharedEvent();
  const item = await createTextContent(
    request,
    event.id,
    testMarker("comments-host")
  );
  contentId = item.id;
});

test("happy: POST + GET round-trip", async ({ request }) => {
  const text = testMarker("comments-happy");
  const post = await request.post(
    `/api/events/${event.id}/content/${contentId}/comments`,
    { data: { text } }
  );
  expect(post.ok()).toBeTruthy();

  const get = await request.get(
    `/api/events/${event.id}/content/${contentId}/comments`
  );
  expect(get.ok()).toBeTruthy();
  const json = await get.json();
  const texts = (json.comments ?? []).map((c: { text: string }) => c.text);
  expect(texts).toContain(text);
});

test("sad: empty comment → 400", async ({ request }) => {
  const res = await request.post(
    `/api/events/${event.id}/content/${contentId}/comments`,
    { data: { text: "" } }
  );
  expect([400, 422]).toContain(res.status());
});

test("sad: whitespace-only comment → 400", async ({ request }) => {
  const res = await request.post(
    `/api/events/${event.id}/content/${contentId}/comments`,
    { data: { text: "     " } }
  );
  expect([400, 422]).toContain(res.status());
});

test("sad: oversized comment (>500 chars) → 400", async ({ request }) => {
  const res = await request.post(
    `/api/events/${event.id}/content/${contentId}/comments`,
    { data: { text: "x".repeat(501) } }
  );
  expect([400, 422]).toContain(res.status());
});

test("XSS: script tag stored verbatim, never executed", async ({
  page,
  request,
}) => {
  const payload = `E2E-xss-${Date.now()}-<script>window.__xss=1</script>`;
  const post = await request.post(
    `/api/events/${event.id}/content/${contentId}/comments`,
    { data: { text: payload } }
  );
  expect(post.ok()).toBeTruthy();

  // Navigate to pool — if the comment is shown anywhere and the script
  // were to run, window.__xss would become 1.
  await page.goto(`/events/${event.id}`);
  await page.getByRole("tab").filter({ hasText: /Pool/i }).first().click();
  // Wait a bit for realtime/render
  await page.waitForTimeout(2000);
  const xss = await page.evaluate(
    () => (window as unknown as { __xss?: number }).__xss
  );
  expect(xss).toBeUndefined();
});

test("sad: DELETE nonexistent comment → 400/403/404", async ({ request }) => {
  const res = await request.delete(
    `/api/events/${event.id}/content/${contentId}/comments/00000000-0000-0000-0000-000000000000`
  );
  expect([400, 403, 404]).toContain(res.status());
});
