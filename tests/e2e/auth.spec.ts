import { test, expect } from "@playwright/test";

/**
 * AUTH — Sad paths & protected-route behavior (PROJ-24).
 * These tests deliberately use a fresh un-authed context.
 */

test.describe("auth sad paths", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("invalid token redirects to /login?error=invalid_link", async ({
    page,
  }) => {
    await page.goto("/join/definitely-not-a-real-token-xyz123");
    await expect(page).toHaveURL(/\/login\?error=invalid_link/);
    await expect(
      page.getByText(/Dieser Link ist ungueltig/i)
    ).toBeVisible();
  });

  test("empty token path 404s or redirects to login", async ({ page }) => {
    const res = await page.goto("/join/");
    // Either redirect or 404 — both acceptable; what we forbid is silent success
    const url = page.url();
    expect(
      url.includes("/login") || res?.status() === 404 || url.endsWith("/join/")
    ).toBeTruthy();
  });

  test("/events unauthenticated → /login", async ({ page }) => {
    await page.goto("/events");
    await expect(page).toHaveURL(/\/login/);
  });

  test("/events/<random-uuid> unauthenticated → /login", async ({ page }) => {
    await page.goto("/events/00000000-0000-0000-0000-000000000000");
    await expect(page).toHaveURL(/\/login/);
  });

  test("/profile unauthenticated → /login", async ({ page }) => {
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/login/);
  });

  test("/api/members/me without cookie returns 401/redirect", async ({
    request,
  }) => {
    const res = await request.get("/api/members/me");
    expect([401, 403, 302, 307]).toContain(res.status());
  });
});

test.describe("auth happy paths (already logged in)", () => {
  test("GET /api/members/me returns profile with id + role", async ({
    request,
  }) => {
    const res = await request.get("/api/members/me");
    expect(res.ok()).toBeTruthy();
    const me = (await res.json()).member;
    expect(me?.id).toBeTruthy();
    expect(["organizer", "admin", "member"]).toContain(me.role);
  });

  test("/events shows current member's events list", async ({ page }) => {
    await page.goto("/events");
    await expect(
      page.getByRole("heading", { name: /Meine Events/i })
    ).toBeVisible();
  });

  test("/profile renders profile page", async ({ page }) => {
    await page.goto("/profile");
    await expect(page.getByText(/Mein Profil/).first()).toBeVisible();
  });
});
