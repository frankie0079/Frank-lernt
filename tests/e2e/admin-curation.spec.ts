import { test, expect } from "@playwright/test";
import {
  getSharedEvent,
  createTextContent,
  testMarker,
  withRetry,
  type SharedEvent,
} from "./helpers";

/** PROJ-33 — Tages-Admin curation workflow. */

let event: SharedEvent;
let agendaItemId: string | null;
const contentIds: string[] = [];

test.beforeAll(async ({ request }) => {
  event = getSharedEvent();
  agendaItemId = event.agendaItemId;
  if (!agendaItemId) return;
  for (const suffix of ["A", "B", "C"]) {
    const c = await createTextContent(
      request,
      event.id,
      testMarker(`admin-${suffix}`),
      agendaItemId
    );
    contentIds.push(c.id);
  }
});

test("precondition: event has agenda item", () => {
  expect(agendaItemId).toBeTruthy();
});

test("admin overview page loads without 500", async ({ page }) => {
  await page.goto(`/events/${event.id}/admin`);
  await expect(page.locator("body")).not.toContainText(
    /Application error|Internal Server/i
  );
});

test("GET report returns initial state", async ({ request }) => {
  test.skip(!agendaItemId, "no agenda item");
  const res = await request.get(
    `/api/events/${event.id}/reports/${agendaItemId}`
  );
  expect(res.ok()).toBeTruthy();
});

test("PUT saves selected items with sort order", async ({ request }) => {
  test.skip(!agendaItemId || contentIds.length < 3, "not enough content");
  const res = await request.put(
    `/api/events/${event.id}/reports/${agendaItemId}`,
    {
      data: {
        items: contentIds.map((id, i) => ({
          content_item_id: id,
          sort_order: i,
        })),
      },
    }
  );
  expect(
    res.ok(),
    `PUT report failed: ${res.status()} ${await res.text()}`
  ).toBeTruthy();
});

test("PATCH publish=true marks report as published", async ({ request }) => {
  test.skip(!agendaItemId, "no agenda item");
  const res = await withRetry(() =>
    request.patch(`/api/events/${event.id}/reports/${agendaItemId}/publish`, {
      data: { publish: true },
    })
  );
  expect(
    res.ok(),
    `PATCH publish=true: ${res.status()} ${await res.text()}`
  ).toBeTruthy();
});

test("PATCH publish=false rolls back to draft", async ({ request }) => {
  test.skip(!agendaItemId, "no agenda item");
  const res = await withRetry(() =>
    request.patch(`/api/events/${event.id}/reports/${agendaItemId}/publish`, {
      data: { publish: false },
    })
  );
  expect(res.ok()).toBeTruthy();
});

test("sad: PUT with foreign content_id → rejected", async ({ request }) => {
  test.skip(!agendaItemId, "no agenda item");
  const res = await request.put(
    `/api/events/${event.id}/reports/${agendaItemId}`,
    {
      data: {
        items: [
          {
            content_item_id: "00000000-0000-0000-0000-000000000000",
            sort_order: 0,
          },
        ],
      },
    }
  );
  expect([400, 403, 404, 422]).toContain(res.status());
});
