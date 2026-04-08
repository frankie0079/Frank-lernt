import { defineConfig, devices } from "@playwright/test";
import * as path from "path";

/**
 * EventDocs E2E Test Suite
 *
 * Runs against Production by default. Override with BASE_URL env var:
 *   BASE_URL=http://localhost:3000 npm run test:e2e
 *
 * Required env vars (in .env.local):
 *   - E2E_TOKEN: Organizer token from Supabase members table
 *   - E2E_EVENT_ID (optional): If set, uses this persistent test event.
 *     Otherwise tests create + delete their own event per run.
 */

// Load .env.local manually so Playwright picks up secrets without dotenv dep
import * as fs from "fs";
const envFile = path.resolve(__dirname, ".env.local");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const BASE_URL = process.env.BASE_URL ?? "https://frank-lernt.vercel.app";

export default defineConfig({
  testDir: "./tests/e2e",
  globalTeardown: require.resolve("./tests/e2e/global-teardown.ts"),
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // Tests share an event, keep serial to avoid races
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
  projects: [
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: "chromium-desktop",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/organizer.json",
      },
      dependencies: ["setup"],
    },
    {
      name: "mobile-safari",
      use: {
        ...devices["iPhone 14"],
        storageState: "tests/e2e/.auth/organizer.json",
      },
      dependencies: ["setup"],
      testMatch: /smoke\.spec\.ts/, // Only run smoke on mobile (iPhone-first UX)
    },
  ],
});
