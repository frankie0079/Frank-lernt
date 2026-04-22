#!/usr/bin/env node
// PROJ-38 verification — run after applying
// supabase/migrations/20260422_realtime_fix_content_items.sql.
//
// Usage: node scripts/verify-proj38.mjs
//
// Checks:
//   PASS 1: anon SELECT on content_items succeeds (was the regression)
//   PASS 2: anon SELECT on members still FAILS (security invariant — must stay locked)
//   PASS 3: anon INSERT on content_items still FAILS (no unintended write grant)
//
// Does NOT touch production data. All requests are read-only or expected to fail.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env.local");
const env = readFileSync(envPath, "utf8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const anon = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim();

const hdr = { apikey: anon, Authorization: `Bearer ${anon}` };

function tag(ok) { return ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"; }

let allGreen = true;

async function check1() {
  const r = await fetch(`${url}/rest/v1/content_items?select=id&limit=1`, { headers: hdr });
  const ok = r.status === 200;
  console.log(`${tag(ok)} 1/3  anon SELECT content_items  → HTTP ${r.status} (want 200)`);
  if (!ok) { allGreen = false; console.log("       body:", await r.text()); }
}

async function check2() {
  const r = await fetch(`${url}/rest/v1/members?select=token&limit=1`, { headers: hdr });
  const ok = r.status === 401 || r.status === 403;
  console.log(`${tag(ok)} 2/3  anon SELECT members.token   → HTTP ${r.status} (want 401/403)`);
  if (!ok) { allGreen = false; console.log("       body:", await r.text()); }
}

async function check3() {
  const r = await fetch(`${url}/rest/v1/content_items`, {
    method: "POST",
    headers: { ...hdr, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({
      event_id: "00000000-0000-0000-0000-000000000000",
      author_id: "00000000-0000-0000-0000-000000000000",
      type: "photo",
    }),
  });
  const ok = r.status === 401 || r.status === 403;
  console.log(`${tag(ok)} 3/3  anon INSERT content_items  → HTTP ${r.status} (want 401/403)`);
  if (!ok) { allGreen = false; console.log("       body:", await r.text()); }
}

await check1();
await check2();
await check3();

console.log();
if (allGreen) {
  console.log("\x1b[32mAll checks passed. Realtime CDC to anon subscribers is now unlocked,\x1b[0m");
  console.log("\x1b[32mand members.token remains locked. Safe to deploy.\x1b[0m");
  process.exit(0);
} else {
  console.log("\x1b[31mOne or more checks failed. Do NOT deploy PROJ-38.\x1b[0m");
  process.exit(1);
}
