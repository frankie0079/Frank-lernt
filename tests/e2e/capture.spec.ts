import { test, expect } from "@playwright/test";
import { getSharedEvent, testMarker, type SharedEvent } from "./helpers";

/** PROJ-27 — Wanderer-Screen / Capture (text path + validation). */

let event: SharedEvent;
test.beforeAll(() => {
  event = getSharedEvent();
});

test.beforeEach(async ({ page }) => {
  await page.goto(`/events/${event.id}`);
});

test("happy: text capture creates a pool entry", async ({ page }) => {
  const content = testMarker("capture-happy");
  await page.getByRole("button", { name: "Text-Kommentar schreiben" }).click();
  await page.getByPlaceholder(/Was m(ö|oe)chtest du teilen/i).fill(content);
  await page.getByRole("button", { name: "Absenden" }).click();
  await expect(page.getByText(/Text-Beitrag/)).not.toBeVisible({
    timeout: 10_000,
  });
});

test("sad: empty text disables submit", async ({ page }) => {
  await page.getByRole("button", { name: "Text-Kommentar schreiben" }).click();
  await expect(page.getByRole("button", { name: "Absenden" })).toBeDisabled();
});

test("sad: whitespace-only text is rejected", async ({ page }) => {
  await page.getByRole("button", { name: "Text-Kommentar schreiben" }).click();
  await page.getByPlaceholder(/Was m(ö|oe)chtest du teilen/i).fill("   ");
  await expect(page.getByRole("button", { name: "Absenden" })).toBeDisabled();
});

test("sad: oversized text is rejected client-side", async ({ page }) => {
  await page.getByRole("button", { name: "Text-Kommentar schreiben" }).click();
  await page
    .getByPlaceholder(/Was m(ö|oe)chtest du teilen/i)
    .fill("x".repeat(2600));
  await expect(page.getByRole("button", { name: "Absenden" })).toBeDisabled();
});

test("api sad: empty caption → 400", async ({ request }) => {
  const res = await request.post(`/api/events/${event.id}/content`, {
    data: { type: "text", caption: "", agenda_item_id: null },
  });
  expect(res.status()).toBe(400);
});

test("api sad: unknown type → 400", async ({ request }) => {
  const res = await request.post(`/api/events/${event.id}/content`, {
    data: { type: "alien", caption: "hi" },
  });
  expect([400, 422]).toContain(res.status());
});

test("api sad: foreign event → 403/404", async ({ request }) => {
  const res = await request.post(
    `/api/events/00000000-0000-0000-0000-000000000000/content`,
    { data: { type: "text", caption: "nope" } }
  );
  expect([403, 404]).toContain(res.status());
});
