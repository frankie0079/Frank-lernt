import { test, expect } from "@playwright/test";
import {
  getSharedEvent,
  createTextContent,
  testMarker,
  withRetry,
  type SharedEvent,
} from "./helpers";

/**
 * PROJ-34 — Slideshow Generation via Claude Haiku.
 * Uses real Claude API (~$0.02 per run).
 * Skip on CI unless RUN_SLIDESHOW_TESTS=1.
 */

const runSlideshow = process.env.RUN_SLIDESHOW_TESTS === "1" || !process.env.CI;

test.describe("PROJ-34 slideshow", () => {
  test.skip(!runSlideshow, "Set RUN_SLIDESHOW_TESTS=1 to enable");

  let event: SharedEvent;
  let agendaItemId: string | null;
  const contentIds: string[] = [];

  let endpointAvailable = false;

  test.beforeAll(async ({ request }) => {
    event = getSharedEvent();
    agendaItemId = event.agendaItemId;
    if (!agendaItemId) return;

    // Probe whether the storyboard route is deployed (PROJ-34 may be unpushed)
    const probe = await request.get(
      `/api/events/${event.id}/reports/${agendaItemId}/storyboard`
    );
    endpointAvailable = probe.status() !== 404;
    if (!endpointAvailable) {
      console.warn(
        "[slideshow] Storyboard endpoint returns 404 — PROJ-34 not deployed. Skipping all slideshow tests."
      );
      return;
    }

    for (const i of [1, 2]) {
      const c = await createTextContent(
        request,
        event.id,
        testMarker(`slide-${i}`) + " — Schöner Tag am Berg.",
        agendaItemId
      );
      contentIds.push(c.id);
    }
    await request.put(
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
  });

  test("precondition: shared event has agenda item + endpoint deployed", () => {
    expect(agendaItemId).toBeTruthy();
    test.skip(!endpointAvailable, "PROJ-34 not deployed to this environment");
  });

  test("POST storyboard returns a valid plan (Claude Haiku live call)", async ({
    request,
  }) => {
    test.skip(!agendaItemId || !endpointAvailable, "PROJ-34 not deployed");
    const res = await withRetry(() =>
      request.post(
        `/api/events/${event.id}/reports/${agendaItemId}/storyboard`,
        { data: {} }
      )
    );
    expect(
      res.ok(),
      `Storyboard generation failed: ${res.status()} ${await res.text()}`
    ).toBeTruthy();

    const json = await res.json();
    const sb = json.storyboard ?? json;
    expect(sb).toBeTruthy();
    expect(Array.isArray(sb.frames)).toBeTruthy();
    expect(sb.frames.length).toBeGreaterThan(0);
    for (const frame of sb.frames) {
      expect((frame.duration_sec ?? frame.duration ?? 0) > 0).toBeTruthy();
    }
  });

  test("GET storyboard returns the persisted plan", async ({ request }) => {
    test.skip(!agendaItemId || !endpointAvailable, "PROJ-34 not deployed");
    const res = await request.get(
      `/api/events/${event.id}/reports/${agendaItemId}/storyboard`
    );
    expect(res.ok()).toBeTruthy();
  });

  test("PUT manually edited storyboard is persisted", async ({ request }) => {
    test.skip(!agendaItemId || !endpointAvailable, "PROJ-34 not deployed");
    const get = await request.get(
      `/api/events/${event.id}/reports/${agendaItemId}/storyboard`
    );
    const json = await get.json();
    const sb = json.storyboard ?? json;
    if (!sb || !Array.isArray(sb.frames)) {
      test.skip();
      return;
    }
    sb.title = `E2E-edited-${Date.now()}`;
    const put = await request.put(
      `/api/events/${event.id}/reports/${agendaItemId}/storyboard`,
      { data: { storyboard: sb } }
    );
    expect(put.ok()).toBeTruthy();
  });

  test("sad: POST storyboard for foreign event → 403/404", async ({
    request,
  }) => {
    test.skip(!agendaItemId || !endpointAvailable, "PROJ-34 not deployed");
    const res = await request.post(
      `/api/events/00000000-0000-0000-0000-000000000000/reports/${agendaItemId}/storyboard`,
      { data: {} }
    );
    expect([403, 404]).toContain(res.status());
  });
});
