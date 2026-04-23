#!/usr/bin/env node
// PROJ-39 extra edge cases that qa-proj39-deep.mjs doesn't cover.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash, randomUUID } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
const SUPA = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const SRK  = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim();

const LOCAL = "http://localhost:3000";
const SK_HDR = { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": "application/json" };

function tag(ok) { return ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"; }
let allGreen = true;
function result(name, ok, detail) {
  console.log(`${tag(ok)} ${name}`);
  if (detail) console.log(`       ${detail}`);
  if (!ok) allGreen = false;
}

const testTag = `proj39-extra-${Date.now()}`;
const token = `proj39-x-${crypto.randomUUID()}`;
const token2 = `proj39-y-${crypto.randomUUID()}`;
let memberId, memberId2, eventId, eventId2;

async function sb(method, path, body) {
  const res = await fetch(`${SUPA}/rest/v1/${path}`, {
    method,
    headers: { ...SK_HDR, Prefer: "return=representation" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function setup() {
  console.log("\n--- Setup ---");
  const m = await sb("POST", "members", { name: `QA ${testTag}`, token, role: "organizer" });
  memberId = m[0].id;
  const m2 = await sb("POST", "members", { name: `QA2 ${testTag}`, token: token2, role: "organizer" });
  memberId2 = m2[0].id;
  const e = await sb("POST", "events", {
    name: `QA Ev1 ${testTag}`, organizer_id: memberId,
    slug: `qa39-ev1-${Date.now()}`, start_date: "2026-04-23", end_date: "2026-04-23",
  });
  eventId = e[0].id;
  const e2 = await sb("POST", "events", {
    name: `QA Ev2 ${testTag}`, organizer_id: memberId,
    slug: `qa39-ev2-${Date.now()}`, start_date: "2026-04-23", end_date: "2026-04-23",
  });
  eventId2 = e2[0].id;
  await sb("POST", "event_members", { event_id: eventId, member_id: memberId, role: "organizer" });
  await sb("POST", "event_members", { event_id: eventId2, member_id: memberId, role: "organizer" });
  console.log(`       m=${memberId} m2=${memberId2} e1=${eventId} e2=${eventId2}`);
}

async function cleanup() {
  console.log("\n--- Cleanup ---");
  for (const ev of [eventId, eventId2]) {
    if (!ev) continue;
    await sb("DELETE", `content_items?event_id=eq.${ev}`);
    await sb("DELETE", `event_members?event_id=eq.${ev}`);
    await sb("DELETE", `events?id=eq.${ev}`);
  }
  for (const mid of [memberId, memberId2]) {
    if (mid) await sb("DELETE", `members?id=eq.${mid}`);
  }
  console.log("       done");
}

async function api(method, path, body, cookieToken = token) {
  const res = await fetch(`${LOCAL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Cookie: `member_token=${cookieToken}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { status: res.status, json, text };
}

const fakeMediaUrl = () =>
  `${SUPA}/storage/v1/object/public/media/qa-proj39/${randomUUID()}.jpg`;
const sha256hex = (s) => createHash("sha256").update(s).digest("hex");

// --- Scenarios -----------------------------------------------------------

// E1: Upload without file_hash at all (legacy client / text post flows) → 201, file_hash stays null
async function e1_noHash() {
  const r = await api("POST", `/api/events/${eventId}/content`, {
    type: "photo",
    media_url: fakeMediaUrl(),
    caption: null,
    latitude: null, longitude: null, exif_date: null,
  });
  const ok = r.status === 201 && r.json?.content_item?.id;
  if (!ok) return result(`E1  POST photo without file_hash → 201`, false,
    `HTTP ${r.status} body ${JSON.stringify(r.json || r.text)}`);
  const rows = await sb("GET", `content_items?id=eq.${r.json.content_item.id}&select=file_hash`);
  const dbOk = rows[0].file_hash === null;
  result(`E1  POST photo without file_hash → 201 + db file_hash IS NULL`, dbOk,
    `db file_hash=${rows[0].file_hash}`);
}

// E2: Explicit file_hash=null in the body → accepted (same as legacy)
async function e2_hashNull() {
  const r = await api("POST", `/api/events/${eventId}/content`, {
    type: "photo",
    media_url: fakeMediaUrl(),
    file_hash: null,
  });
  const ok = r.status === 201;
  result(`E2  POST photo file_hash=null → 201`, ok,
    `HTTP ${r.status} body ${JSON.stringify(r.json || r.text)}`);
}

// E3: Same file_hash across DIFFERENT events → both should succeed (dedup is per-event)
async function e3_crossEvent() {
  const h = sha256hex(`shared-${Date.now()}`);
  const r1 = await api("POST", `/api/events/${eventId}/content`, {
    type: "photo", media_url: fakeMediaUrl(), file_hash: h,
  });
  const r2 = await api("POST", `/api/events/${eventId2}/content`, {
    type: "photo", media_url: fakeMediaUrl(), file_hash: h,
  });
  const ok = r1.status === 201 && r2.status === 201
    && !r1.json?.duplicate && !r2.json?.duplicate
    && r1.json?.content_item?.id !== r2.json?.content_item?.id;
  result(`E3  Same hash across different events → both 201, no duplicate flag`, ok,
    `e1=${r1.status}/${r1.json?.duplicate} e2=${r2.status}/${r2.json?.duplicate}`);
}

// E4: Upper-case hex in hash → regex rejects (it enforces lowercase)
async function e4_uppercaseRejected() {
  const h = sha256hex(`foo-${Date.now()}`).toUpperCase();
  const r = await api("GET", `/api/events/${eventId}/content?hash=${h}`);
  const ok = r.status === 400;
  result(`E4  GET ?hash=<UPPERCASE HEX> → 400`, ok,
    `HTTP ${r.status} body ${JSON.stringify(r.json || r.text)}`);
}

// E5: Wrong length hex in hash → regex rejects
async function e5_wrongLength() {
  const r = await api("GET", `/api/events/${eventId}/content?hash=aaaa`);
  const ok = r.status === 400;
  result(`E5  GET ?hash=<too-short> → 400`, ok,
    `HTTP ${r.status} body ${JSON.stringify(r.json || r.text)}`);
}

// E6: Non-member cannot probe someone else's event (membership check)
async function e6_nonMemberCannotProbe() {
  // member2 is NOT in event1. Probe should 403.
  const h = sha256hex(`x`);
  const r = await api("GET", `/api/events/${eventId}/content?hash=${h}`, null, token2);
  const ok = r.status === 403;
  result(`E6  Non-member GET ?hash → 403`, ok,
    `HTTP ${r.status} body ${JSON.stringify(r.json || r.text)}`);
}

// E7: Non-member cannot POST content to someone else's event
async function e7_nonMemberCannotPost() {
  const h = sha256hex(`y-${Date.now()}`);
  const r = await api("POST", `/api/events/${eventId}/content`, {
    type: "photo", media_url: fakeMediaUrl(), file_hash: h,
  }, token2);
  const ok = r.status === 403;
  result(`E7  Non-member POST → 403`, ok,
    `HTTP ${r.status} body ${JSON.stringify(r.json || r.text)}`);
}

// E8: POST with malformed file_hash (wrong regex) → 400 on Zod
async function e8_postMalformedHash() {
  const r = await api("POST", `/api/events/${eventId}/content`, {
    type: "photo", media_url: fakeMediaUrl(),
    file_hash: "NOT-HEX-OBVIOUSLY",
  });
  const ok = r.status === 400 && /hash/i.test(r.json?.error || "");
  result(`E8  POST with malformed file_hash → 400`, ok,
    `HTTP ${r.status} body ${JSON.stringify(r.json || r.text)}`);
}

// E9: Malicious media_url (different host) → 400, even with valid hash
async function e9_maliciousMediaUrl() {
  const h = sha256hex(`mal-${Date.now()}`);
  const r = await api("POST", `/api/events/${eventId}/content`, {
    type: "photo",
    media_url: "https://evil.example.com/sneaky.jpg",
    file_hash: h,
  });
  const ok = r.status === 400 && /Storage/i.test(r.json?.error || "");
  result(`E9  POST with foreign media_url + valid hash → 400`, ok,
    `HTTP ${r.status} body ${JSON.stringify(r.json || r.text)}`);
}

// --- Main ----------------------------------------------------------------

try {
  await setup();
  console.log("\n--- Extra Edge Cases ---");
  await e1_noHash();
  await e2_hashNull();
  await e3_crossEvent();
  await e4_uppercaseRejected();
  await e5_wrongLength();
  await e6_nonMemberCannotProbe();
  await e7_nonMemberCannotPost();
  await e8_postMalformedHash();
  await e9_maliciousMediaUrl();
} finally {
  await cleanup();
}

console.log();
console.log(allGreen ? "\x1b[32mAll extra edge-case checks passed.\x1b[0m"
                     : "\x1b[31mOne or more extras failed.\x1b[0m");
process.exit(allGreen ? 0 : 1);
