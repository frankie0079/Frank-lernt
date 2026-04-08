import { test, expect } from "@playwright/test";
import {
  getSharedEvent,
  createTextContent,
  testMarker,
  type SharedEvent,
} from "./helpers";

/** PROJ-28 — Content Pool. */

let event: SharedEvent;
test.beforeAll(() => {
  event = getSharedEvent();
});

test("pool renders for shared event", async ({ page }) => {
  await page.goto(`/events/${event.id}`);
  await page.getByRole("tab").filter({ hasText: /Pool/i }).first().click();
  // Must not crash. Body should render SOMETHING — either items or empty state.
  await expect(page.locator("body")).not.toContainText(
    /Application error|Internal Server/i
  );
});

test("pool lists items created via API (round-trip)", async ({
  page,
  request,
}) => {
  const caption = testMarker("pool-list");
  await createTextContent(request, event.id, caption);

  await page.goto(`/events/${event.id}`);
  await page.getByRole("tab").filter({ hasText: /Pool/i }).first().click();
  await expect(page.getByText(caption).first()).toBeVisible({
    timeout: 15_000,
  });
});

test("GET /content returns items ordered by created_at desc", async ({
  request,
}) => {
  const a = testMarker("pool-order-A");
  const b = testMarker("pool-order-B");
  await createTextContent(request, event.id, a);
  await new Promise((r) => setTimeout(r, 50)); // ensure ordering
  await createTextContent(request, event.id, b);

  const res = await request.get(`/api/events/${event.id}/content`);
  expect(res.ok()).toBeTruthy();
  const json = await res.json();
  const items: Array<{ caption: string }> = json.content_items ?? [];
  expect(Array.isArray(items)).toBeTruthy();
  const captions = items.map((i) => i.caption);
  const idxA = captions.indexOf(a);
  const idxB = captions.indexOf(b);
  expect(idxA, `marker A not found in pool`).toBeGreaterThanOrEqual(0);
  expect(idxB, `marker B not found in pool`).toBeGreaterThanOrEqual(0);
  // B was created after A → B should appear first in desc order
  expect(idxB).toBeLessThan(idxA);
});

test("sad: GET /content for foreign event → 403/404", async ({ request }) => {
  const res = await request.get(
    `/api/events/00000000-0000-0000-0000-000000000000/content`
  );
  expect([403, 404]).toContain(res.status());
});
