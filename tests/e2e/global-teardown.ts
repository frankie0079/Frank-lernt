import { request as pwRequest } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

/**
 * Runs after the entire test suite. Deletes the shared test event,
 * which CASCADE-cleans content_items, reactions, comments, reports, etc.
 */
const BASE_URL = process.env.BASE_URL ?? "https://frank-lernt.vercel.app";

export default async function globalTeardown() {
  const sharedFile = path.resolve(__dirname, ".auth/shared-event.json");
  const authFile = path.resolve(__dirname, ".auth/organizer.json");
  if (!fs.existsSync(sharedFile) || !fs.existsSync(authFile)) return;

  const shared = JSON.parse(fs.readFileSync(sharedFile, "utf8")) as {
    id: string;
  };

  const ctx = await pwRequest.newContext({
    baseURL: BASE_URL,
    storageState: authFile,
  });
  try {
    const res = await ctx.delete(`/api/events/${shared.id}`);
    if (!res.ok() && res.status() !== 404) {
      console.warn(
        `[teardown] DELETE /api/events/${shared.id} → ${res.status()}`
      );
    } else {
      console.log(`[teardown] Shared event ${shared.id} deleted.`);
    }
  } finally {
    await ctx.dispose();
  }

  // Clean up the file so next run starts fresh
  try {
    fs.unlinkSync(sharedFile);
  } catch {
    // ignore
  }
}
