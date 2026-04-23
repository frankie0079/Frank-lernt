#!/usr/bin/env node
// PROJ-39 verification — Upload-SHA-256-Dedup security + shape invariants.
//
// Usage: node scripts/verify-proj39.mjs
//
// Checks (all against production anon — no secrets touched):
//   PASS 1: file_hash column exists on content_items (anon SELECT file_hash returns 200)
//   PASS 2: anon INSERT on content_items with file_hash still FAILS (no write grant)
//   PASS 3: /api/events/[id]/content?hash=... without cookie → 401 (auth-first, no leak)
//   PASS 4: /api/events/[id]/content?hash=NOT_HEX without cookie → 401 (auth-first still)
//   PASS 5: /api/events/[bad-uuid]/content?hash=... → 400 (UUID validation before auth)

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env.local");
const env = readFileSync(envPath, "utf8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const anon = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim();

const PROD = "https://frank-lernt.vercel.app";
const HK_EVENT = "85f0339d-edac-462d-bc0e-85d448a375f1";
const VALID_HASH = "a".repeat(64);

const hdr = { apikey: anon, Authorization: `Bearer ${anon}` };

function tag(ok) { return ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"; }
let allGreen = true;

async function check1() {
  const r = await fetch(`${url}/rest/v1/content_items?select=file_hash&limit=0`, { headers: hdr });
  const ok = r.status === 200;
  console.log(`${tag(ok)} 1/5  file_hash column exists (anon SELECT file_hash)  → HTTP ${r.status} (want 200)`);
  if (!ok) { allGreen = false; console.log("       body:", await r.text()); }
}

async function check2() {
  const r = await fetch(`${url}/rest/v1/content_items`, {
    method: "POST",
    headers: { ...hdr, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({
      event_id: "00000000-0000-0000-0000-000000000000",
      author_id: "00000000-0000-0000-0000-000000000000",
      type: "photo",
      file_hash: VALID_HASH,
    }),
  });
  const ok = r.status === 401 || r.status === 403;
  console.log(`${tag(ok)} 2/5  anon INSERT w/ file_hash still blocked          → HTTP ${r.status} (want 401/403)`);
  if (!ok) { allGreen = false; console.log("       body:", await r.text()); }
}

async function check3() {
  const r = await fetch(`${PROD}/api/events/${HK_EVENT}/content?hash=${VALID_HASH}`);
  const ok = r.status === 401;
  console.log(`${tag(ok)} 3/5  GET ?hash=valid without cookie → 401            → HTTP ${r.status} (want 401)`);
  if (!ok) { allGreen = false; console.log("       body:", await r.text()); }
}

async function check4() {
  // URL-encode to avoid accidental parse success; the point is that even before
  // hash-shape validation runs, auth already kicks us out → no information leak
  // about whether the hash is valid or not.
  const r = await fetch(`${PROD}/api/events/${HK_EVENT}/content?hash=NOT_HEX_WOW`);
  const ok = r.status === 401;
  console.log(`${tag(ok)} 4/5  GET ?hash=invalid without cookie → 401 (auth-first)  → HTTP ${r.status} (want 401)`);
  if (!ok) { allGreen = false; console.log("       body:", await r.text()); }
}

async function check5() {
  const r = await fetch(`${PROD}/api/events/not-a-uuid/content?hash=${VALID_HASH}`);
  const ok = r.status === 400;
  console.log(`${tag(ok)} 5/5  GET bad-event-UUID → 400 (UUID check before auth) → HTTP ${r.status} (want 400)`);
  if (!ok) { allGreen = false; console.log("       body:", await r.text()); }
}

await check1();
await check2();
await check3();
await check4();
await check5();

console.log();
if (allGreen) {
  console.log("\x1b[32mAll 5 production invariants hold.\x1b[0m");
  console.log("\x1b[32m  - file_hash column is live.\x1b[0m");
  console.log("\x1b[32m  - anon cannot INSERT with a hash.\x1b[0m");
  console.log("\x1b[32m  - GET ?hash= requires auth regardless of hash shape (no leak).\x1b[0m");
  process.exit(0);
} else {
  console.log("\x1b[31mOne or more production invariants broken.\x1b[0m");
  process.exit(1);
}
