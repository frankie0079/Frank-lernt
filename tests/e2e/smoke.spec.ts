import { test, expect } from "@playwright/test";
import {
  getSharedEvent,
  createTextContent,
  testMarker,
  type SharedEvent,
} from "./helpers";

/**
 * SMOKE TEST — Critical happy path across all deployed features.
 * Read-mostly: navigation + tab rendering + one API-seeded item visible.
 * The text-capture UI flow is exercised in capture.spec.ts to keep the
 * smoke test independent of the per-IP write rate limit.
 */

let event: SharedEvent;
test.beforeAll(() => {
  event = getSharedEvent();
});

test("happy path: events list → event dashboard → tabs render", async ({
  page,
}) => {
  await page.goto("/events");
  await expect(
    page.getByRole("heading", { name: /Meine Events/i })
  ).toBeVisible();

  // Shared test event appears in list (PROJ-25)
  await expect(page.getByText(event.name).first()).toBeVisible();

  // Open the event
  await page.getByText(event.name).first().click();
  await expect(page).toHaveURL(new RegExp(`/events/${event.id}`));

  // PROJ-27: Wanderer-Screen capture buttons
  await expect(
    page.getByRole("button", { name: "Foto aufnehmen" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Text-Kommentar schreiben" })
  ).toBeVisible();

  // PROJ-28: Pool tab loads without crashing
  await page.getByRole("tab").filter({ hasText: /Pool/i }).first().click();
  await expect(page.locator("body")).not.toContainText(
    /Application error|Internal Server/i
  );
});

test("API-seeded item appears in pool", async ({ page, request }) => {
  const marker = testMarker("smoke-pool");
  await createTextContent(request, event.id, marker);
  await page.goto(`/events/${event.id}`);
  await page.getByRole("tab").filter({ hasText: /Pool/i }).first().click();
  await expect(page.getByText(marker).first()).toBeVisible({ timeout: 15_000 });
});

test("PROJ-33 admin page loads without 500", async ({ page }) => {
  await page.goto(`/events/${event.id}/admin`);
  await expect(page.locator("body")).not.toContainText(
    /Application error|Internal Server/i
  );
});
