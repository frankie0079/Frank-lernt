#!/usr/bin/env node
// PROJ-39 DB-level checks:
//   D1  Directly inserting two rows with the same (event_id, file_hash) via
//       service_role must fail with 23505 (confirms the partial UNIQUE index).
//   D2  Two rows in the same event with file_hash=NULL are legal (partial
//       index does NOT constrain NULLs).
//   D3  Two rows in different events with the same file_hash are legal.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash, randomUUID } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
const SUPA = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const SRK  = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim();

const SK_HDR = { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": "application/json" };

function tag(ok) { return ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"; }
let allGreen = true;
function result(name, ok, detail) {
  console.log(`${tag(ok)} ${name}`);
  if (detail) console.log(`       ${detail}`);
  if (!ok) allGreen = false;
}

const token = `proj39-db-${crypto.randomUUID()}`;
let memberId, eventId, eventId2;

async function sb(method, path, body, expectError = false) {
  const res = await fetch(`${SUPA}/rest/v1/${path}`, {
    method,
    headers: { ...SK_HDR, Prefer: "return=representation" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok && !expectError) throw new Error(`${method} ${path} → ${res.status} ${text}`);
  return { status: res.status, body: text ? (text.startsWith("{") || text.startsWith("[") ? JSON.parse(text) : text) : null };
}

async function setup() {
  console.log("\n--- Setup ---");
  const m = await sb("POST", "members", { name: `QA DB ${Date.now()}`, token, role: "organizer" });
  memberId = m.body[0].id;
  const e = await sb("POST", "events", {
    name: `QA DB Ev ${Date.now()}`, organizer_id: memberId,
    slug: `qa-db-${Date.now()}`, start_date: "2026-04-23", end_date: "2026-04-23",
  });
  eventId = e.body[0].id;
  const e2 = await sb("POST", "events", {
    name: `QA DB Ev2 ${Date.now()}`, organizer_id: memberId,
    slug: `qa-db2-${Date.now()}`, start_date: "2026-04-23", end_date: "2026-04-23",
  });
  eventId2 = e2.body[0].id;
  console.log(`       m=${memberId} e1=${eventId} e2=${eventId2}`);
}

async function cleanup() {
  console.log("\n--- Cleanup ---");
  for (const ev of [eventId, eventId2]) {
    if (!ev) continue;
    await sb("DELETE", `content_items?event_id=eq.${ev}`);
    await sb("DELETE", `events?id=eq.${ev}`);
  }
  if (memberId) await sb("DELETE", `members?id=eq.${memberId}`);
  console.log("       done");
}

const fakeMediaUrl = () =>
  `${SUPA}/storage/v1/object/public/media/qa-db/${randomUUID()}.jpg`;

async function d1_uniqueBlocksDup() {
  const h = createHash("sha256").update(`d1-${Date.now()}`).digest("hex");
  const r1 = await sb("POST", "content_items", {
    event_id: eventId, author_id: memberId, type: "photo",
    media_url: fakeMediaUrl(), file_hash: h,
  });
  const r2 = await sb("POST", "content_items", {
    event_id: eventId, author_id: memberId, type: "photo",
    media_url: fakeMediaUrl(), file_hash: h,
  }, true);
  const ok = r1.status === 201 && r2.status === 409;
  result(`D1  Two INSERTs with same (event_id, file_hash) → 23505 on the 2nd`, ok,
    `r1=${r1.status} r2=${r2.status} body=${typeof r2.body === "string" ? r2.body.slice(0, 120) : JSON.stringify(r2.body).slice(0, 120)}`);
}

async function d2_nullsDontCollide() {
  // Two rows in same event, both file_hash=NULL → partial index must NOT collide.
  const r1 = await sb("POST", "content_items", {
    event_id: eventId, author_id: memberId, type: "photo",
    media_url: fakeMediaUrl(), file_hash: null,
  });
  const r2 = await sb("POST", "content_items", {
    event_id: eventId, author_id: memberId, type: "photo",
    media_url: fakeMediaUrl(), file_hash: null,
  });
  const ok = r1.status === 201 && r2.status === 201;
  result(`D2  Two NULL-hash rows in same event → both OK (partial index)`, ok,
    `r1=${r1.status} r2=${r2.status}`);
}

async function d3_crossEventSameHashOK() {
  const h = createHash("sha256").update(`d3-${Date.now()}`).digest("hex");
  const r1 = await sb("POST", "content_items", {
    event_id: eventId,  author_id: memberId, type: "photo",
    media_url: fakeMediaUrl(), file_hash: h,
  });
  const r2 = await sb("POST", "content_items", {
    event_id: eventId2, author_id: memberId, type: "photo",
    media_url: fakeMediaUrl(), file_hash: h,
  });
  const ok = r1.status === 201 && r2.status === 201;
  result(`D3  Same hash across different events → both 201`, ok,
    `r1=${r1.status} r2=${r2.status}`);
}

try {
  await setup();
  console.log("\n--- DB Level Checks ---");
  await d1_uniqueBlocksDup();
  await d2_nullsDontCollide();
  await d3_crossEventSameHashOK();
} finally {
  await cleanup();
}

console.log();
console.log(allGreen ? "\x1b[32mAll DB-level checks passed.\x1b[0m"
                     : "\x1b[31mOne or more DB-level checks failed.\x1b[0m");
process.exit(allGreen ? 0 : 1);
