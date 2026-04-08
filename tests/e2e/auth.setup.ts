import { test as setup, expect } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const authFile = path.resolve(__dirname, ".auth/organizer.json");
const sharedFile = path.resolve(__dirname, ".auth/shared-event.json");

/**
 * One-time setup:
 *   1. Login via /join/[E2E_TOKEN], persist storageState
 *   2. Create ONE shared test event with agenda items (reused by all specs,
 *      avoids per-IP rate limit of 30 writes/min on POST /api/events)
 *   3. Write event.id + agenda_item_id to shared-event.json
 */
setup("authenticate + seed shared test event", async ({ page }) => {
  const token = process.env.E2E_TOKEN;
  if (!token) {
    throw new Error(
      "E2E_TOKEN env var is required. Add it to .env.local:\n" +
        "  E2E_TOKEN=<organizer-token-from-Supabase-members-table>"
    );
  }

  fs.mkdirSync(path.dirname(authFile), { recursive: true });

  // ---- Login ----
  await page.goto(`/join/${token}`);
  await expect(page).toHaveURL(/\/events(\?|$)/, { timeout: 15_000 });
  await expect(
    page.getByRole("heading", { name: /Meine Events/i })
  ).toBeVisible();

  const me = await page.request.get("/api/members/me");
  expect(me.ok(), "GET /api/members/me must succeed").toBeTruthy();
  const meJson = await me.json();
  expect(meJson.member?.id).toBeTruthy();

  await page.context().storageState({ path: authFile });

  // ---- Seed shared test event with agenda item ----
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const marker = `E2E-shared-${Date.now()}`;

  const createRes = await page.request.post("/api/events", {
    data: {
      name: `${marker} Testevent`,
      description: "E2E shared test event — auto-deleted after suite run",
      start_date: today,
      end_date: tomorrow,
      agenda_items: [
        { date: today, title: `${marker} Tag 1`, sort_order: 0 },
        { date: tomorrow, title: `${marker} Tag 2`, sort_order: 1 },
      ],
    },
  });
  expect(
    createRes.ok(),
    `Shared event create failed: ${createRes.status()} ${await createRes.text()}`
  ).toBeTruthy();

  const { event } = await createRes.json();

  // Fetch agenda items (POST doesn't return them)
  const getRes = await page.request.get(`/api/events/${event.id}`);
  expect(getRes.ok()).toBeTruthy();
  const getJson = await getRes.json();
  // Response shape: { event: {...}, agenda_items: [...] } (top-level agenda)
  const agendaItems = getJson.agenda_items ?? getJson.event?.agenda_items ?? [];

  fs.writeFileSync(
    sharedFile,
    JSON.stringify(
      {
        id: event.id,
        name: event.name,
        slug: event.slug,
        marker,
        agendaItemId: agendaItems[0]?.id ?? null,
        agendaItems: agendaItems.map((a: { id: string; title: string }) => ({
          id: a.id,
          title: a.title,
        })),
      },
      null,
      2
    )
  );

  console.log(`[setup] Shared event created: ${event.id} (${agendaItems.length} agenda items)`);
});
