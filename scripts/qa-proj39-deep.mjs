#!/usr/bin/env node
// PROJ-39 deep QA — exercises the Next.js API route end-to-end against the
// local dev server with a real (throwaway) member cookie, so we can assert
// the auth-protected behavior of the hash probe and the POST dedup fast-path.
//
// Usage:
//   1) npm run dev  (localhost:3000)
//   2) node scripts/qa-proj39-deep.mjs
//
// What it does:
//   A) Creates a throwaway member + event + event_members row via service_role.
//   B) Uses that member's token as a member_token cookie against localhost:3000.
//   C) Runs six scenarios against the real API route:
//        S1  GET ?hash=INVALID    → 400 with regex error
//        S2  GET ?hash=RANDOM     → 200 { exists: false }
//        S3  POST new photo with file_hash → 201 { content_item, no duplicate flag }
//        S4  POST same URL+same hash again → 200 { content_item, duplicate: true }
//        S5  POST text-post with a hash → should strip the hash server-side
//              (verify by querying content_items.file_hash → must be null)
//        S6  GET ?hash=<the hash from S3> → 200 { exists: true, content_item: {...} }
//   Z) Cleanup: deletes everything it created.
//
// No production writes. No secret exfiltration — service role stays in env.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash, randomUUID } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
const SUPA = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const ANON = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim();
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

// --- Setup: create throwaway test rows -----------------------------------
const testTag = `proj39-qa-${Date.now()}`;
const memberToken = `proj39-qa-token-${crypto.randomUUID()}`;
let memberId, eventId;

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
  // 1) Create throwaway member (organizer role so we can also act as event author).
  const memRows = await sb("POST", "members", {
    name: `QA ${testTag}`,
    token: memberToken,
    role: "organizer",
  });
  memberId = memRows[0].id;
  console.log(`       member_id = ${memberId}`);

  // 2) Create throwaway event.
  const evRows = await sb("POST", "events", {
    name: `QA PROJ-39 ${testTag}`,
    description: null,
    organizer_id: memberId,
    slug: `qa-proj39-${Date.now()}`,
    start_date: "2026-04-23",
    end_date: "2026-04-23",
  });
  eventId = evRows[0].id;
  console.log(`       event_id  = ${eventId}`);

  // 3) event_members link so the member has access via membership check.
  await sb("POST", "event_members", {
    event_id: eventId,
    member_id: memberId,
    role: "organizer",
  });
}

async function cleanup() {
  console.log("\n--- Cleanup ---");
  if (eventId) {
    await sb("DELETE", `content_items?event_id=eq.${eventId}`);
    await sb("DELETE", `event_members?event_id=eq.${eventId}`);
    await sb("DELETE", `events?id=eq.${eventId}`);
    console.log("       event + members + content deleted");
  }
  if (memberId) {
    await sb("DELETE", `members?id=eq.${memberId}`);
    console.log("       member deleted");
  }
}

// --- Helpers -------------------------------------------------------------

const cookieHdr = { Cookie: `member_token=${memberToken}` };

async function api(method, path, body) {
  const res = await fetch(`${LOCAL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...cookieHdr },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* leave as text */ }
  return { status: res.status, json, text };
}

// Fabricate a reusable Supabase-hosted media URL. POST /content validates that
// the URL host matches NEXT_PUBLIC_SUPABASE_URL and the path starts with
// "/storage/". We use a well-formed URL that satisfies the shape check; we
// don't actually need the blob to exist because POST never hits Storage.
const fakeMediaUrl = () =>
  `${SUPA}/storage/v1/object/public/media/qa-proj39/${randomUUID()}.jpg`;

// Lowercase hex SHA-256 of a given string — stable per input so we can reuse.
function sha256hex(s) {
  return createHash("sha256").update(s).digest("hex");
}

// --- Scenarios -----------------------------------------------------------

async function s1_invalidHash() {
  const r = await api("GET", `/api/events/${eventId}/content?hash=NOT_HEX`);
  const ok = r.status === 400 && /Datei-Hash/i.test(r.json?.error || "");
  result(`S1  GET ?hash=NOT_HEX → 400 "Ungültiger Datei-Hash"`, ok,
    `got HTTP ${r.status} body ${JSON.stringify(r.json || r.text)}`);
}

async function s2_validHashNoMatch() {
  const randomHash = sha256hex(`no-match-${Date.now()}-${Math.random()}`);
  const r = await api("GET", `/api/events/${eventId}/content?hash=${randomHash}`);
  const ok = r.status === 200 && r.json?.exists === false;
  result(`S2  GET ?hash=<random> → 200 { exists: false }`, ok,
    `got HTTP ${r.status} body ${JSON.stringify(r.json)}`);
}

let s3Hash, s3ItemId, s3MediaUrl;
async function s3_postNew() {
  s3Hash = sha256hex(`photo-body-${Date.now()}`);
  s3MediaUrl = fakeMediaUrl();
  const r = await api("POST", `/api/events/${eventId}/content`, {
    type: "photo",
    agenda_item_id: null,
    media_url: s3MediaUrl,
    thumbnail_url: null,
    caption: null,
    latitude: null,
    longitude: null,
    exif_date: null,
    file_hash: s3Hash,
  });
  const ok = r.status === 201 && r.json?.content_item?.id && !r.json?.duplicate;
  s3ItemId = r.json?.content_item?.id;
  result(`S3  POST new photo with fresh file_hash → 201 (no duplicate flag)`, ok,
    `got HTTP ${r.status} item=${s3ItemId} dup=${r.json?.duplicate}`);
}

async function s4_postDuplicate() {
  // Same URL AND same hash — server must treat as duplicate and return 200.
  const r = await api("POST", `/api/events/${eventId}/content`, {
    type: "photo",
    agenda_item_id: null,
    media_url: s3MediaUrl,
    thumbnail_url: null,
    caption: "different caption — still a dup",
    latitude: null,
    longitude: null,
    exif_date: null,
    file_hash: s3Hash,
  });
  const ok = r.status === 200 && r.json?.duplicate === true && r.json?.content_item?.id === s3ItemId;
  result(`S4  POST same hash again → 200 { duplicate: true } with SAME id`, ok,
    `got HTTP ${r.status} dup=${r.json?.duplicate} same-id=${r.json?.content_item?.id === s3ItemId}`);
}

async function s5_textStripsHash() {
  const bogusHash = sha256hex(`text-hash-${Date.now()}`);
  const r = await api("POST", `/api/events/${eventId}/content`, {
    type: "text",
    agenda_item_id: null,
    media_url: null,
    thumbnail_url: null,
    caption: "this is a text post with a sneaky hash",
    latitude: null,
    longitude: null,
    exif_date: null,
    file_hash: bogusHash,
  });
  const okInsert = r.status === 201 && r.json?.content_item?.id;
  if (!okInsert) {
    result(`S5  POST text with hash → 201 (hash stripped)`, false,
      `insert failed HTTP ${r.status} body=${JSON.stringify(r.json || r.text)}`);
    return;
  }
  // Verify the server stripped the hash — query file_hash via service role.
  const rows = await sb("GET", `content_items?id=eq.${r.json.content_item.id}&select=file_hash,type`);
  const ok = rows?.[0]?.file_hash === null && rows?.[0]?.type === "text";
  result(`S5  POST text with hash → 201 + server sets file_hash NULL`, ok,
    `db says file_hash=${rows?.[0]?.file_hash} type=${rows?.[0]?.type}`);
}

async function s6_probeExistingHash() {
  const r = await api("GET", `/api/events/${eventId}/content?hash=${s3Hash}`);
  const ok = r.status === 200 && r.json?.exists === true && r.json?.content_item?.id === s3ItemId;
  result(`S6  GET ?hash=<existing> → 200 { exists: true, content_item }`, ok,
    `got HTTP ${r.status} exists=${r.json?.exists} id=${r.json?.content_item?.id}`);
}

// --- Main ----------------------------------------------------------------

try {
  await setup();
  console.log("\n--- Scenarios ---");
  await s1_invalidHash();
  await s2_validHashNoMatch();
  await s3_postNew();
  if (s3ItemId) await s4_postDuplicate();
  await s5_textStripsHash();
  if (s3ItemId) await s6_probeExistingHash();
} finally {
  await cleanup();
}

console.log();
if (allGreen) {
  console.log("\x1b[32mAll deep QA scenarios passed.\x1b[0m");
  process.exit(0);
} else {
  console.log("\x1b[31mOne or more scenarios failed.\x1b[0m");
  process.exit(1);
}
