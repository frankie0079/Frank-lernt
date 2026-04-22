#!/usr/bin/env node
// PROJ-38 deep QA — additional security probes beyond verify-proj38.mjs.
// Run after migration is applied. All requests are read-only or expected to fail.

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
function check(ok, label, actual, want) {
  console.log(`${tag(ok)} ${label}  → ${actual} (want ${want})`);
  if (!ok) allGreen = false;
}

// Q1: Can anon SELECT content_items? (Regression fix)
{
  const r = await fetch(`${url}/rest/v1/content_items?select=id&limit=1`, { headers: hdr });
  check(r.status === 200, "Q1 anon SELECT content_items", `HTTP ${r.status}`, "200");
}

// Q2: Can anon UPDATE content_items? (Should fail — security invariant)
{
  const r = await fetch(`${url}/rest/v1/content_items?id=eq.00000000-0000-0000-0000-000000000000`, {
    method: "PATCH",
    headers: { ...hdr, "Content-Type": "application/json" },
    body: JSON.stringify({ caption: "pwned" }),
  });
  check(r.status === 401 || r.status === 403, "Q2 anon UPDATE content_items", `HTTP ${r.status}`, "401/403");
}

// Q3: Can anon DELETE content_items? (Should fail — security invariant)
{
  const r = await fetch(`${url}/rest/v1/content_items?id=eq.00000000-0000-0000-0000-000000000000`, {
    method: "DELETE",
    headers: hdr,
  });
  check(r.status === 401 || r.status === 403, "Q3 anon DELETE content_items", `HTTP ${r.status}`, "401/403");
}

// Q4: Can anon SELECT members via PostgREST join from content_items? (Should fail)
// If PostgREST has a foreign-key relation exposed, this would leak.
{
  const r = await fetch(`${url}/rest/v1/content_items?select=id,members(token)&limit=1`, { headers: hdr });
  const body = await r.text();
  const leaked = r.status === 200 && body.includes("token");
  check(!leaked, "Q4 anon join content_items→members.token", r.status === 200 ? "200 (checking body)" : `HTTP ${r.status}`, "no token in response");
  if (leaked) console.log("     leak:", body.slice(0, 200));
}

// Q5: Can anon SELECT events via PostgREST join from content_items? (Should fail — events is locked)
{
  const r = await fetch(`${url}/rest/v1/content_items?select=id,events(id,name)&limit=1`, { headers: hdr });
  const body = await r.text();
  let ok;
  if (r.status !== 200) {
    ok = true; // PostgREST rejected the join — good
  } else {
    // 200 can still be OK if events is null (RLS denied the join)
    try {
      const arr = JSON.parse(body);
      // If events populated with actual data, that's a leak
      ok = arr.every((row) => !row.events || Object.keys(row.events).length === 0);
    } catch { ok = false; }
  }
  check(ok, "Q5 anon join content_items→events", `HTTP ${r.status}`, "empty events or error");
  if (!ok) console.log("     leak:", body.slice(0, 300));
}

// Q6: Can anon SELECT agenda_items via PostgREST join? (agenda_items is locked)
{
  const r = await fetch(`${url}/rest/v1/content_items?select=id,agenda_items(title)&limit=1`, { headers: hdr });
  const body = await r.text();
  let ok;
  if (r.status !== 200) {
    ok = true;
  } else {
    try {
      const arr = JSON.parse(body);
      ok = arr.every((row) => !row.agenda_items || Object.keys(row.agenda_items).length === 0);
    } catch { ok = false; }
  }
  check(ok, "Q6 anon join content_items→agenda_items", `HTTP ${r.status}`, "empty or error");
  if (!ok) console.log("     leak:", body.slice(0, 300));
}

// Q7: Can anon SELECT reactions? (Should work — was already public)
{
  const r = await fetch(`${url}/rest/v1/reactions?select=id&limit=1`, { headers: hdr });
  check(r.status === 200, "Q7 anon SELECT reactions (was always public)", `HTTP ${r.status}`, "200");
}

// Q8: Can anon INSERT reactions directly? (Should fail — RPC-only)
{
  const r = await fetch(`${url}/rest/v1/reactions`, {
    method: "POST",
    headers: { ...hdr, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({
      content_item_id: "00000000-0000-0000-0000-000000000000",
      member_id: "00000000-0000-0000-0000-000000000000",
      emoji: "❤️",
    }),
  });
  check(r.status === 401 || r.status === 403, "Q8 anon INSERT reactions", `HTTP ${r.status}`, "401/403");
}

// Q9: Can anon SELECT events directly? (Should fail — locked)
{
  const r = await fetch(`${url}/rest/v1/events?select=id&limit=1`, { headers: hdr });
  check(r.status === 401 || r.status === 403, "Q9 anon SELECT events (still locked)", `HTTP ${r.status}`, "401/403");
}

// Q10: Can anon SELECT event_members? (Should fail — locked)
{
  const r = await fetch(`${url}/rest/v1/event_members?select=event_id&limit=1`, { headers: hdr });
  check(r.status === 401 || r.status === 403, "Q10 anon SELECT event_members (still locked)", `HTTP ${r.status}`, "401/403");
}

// Q11: Can anon SELECT agenda_items? (Should fail — locked)
{
  const r = await fetch(`${url}/rest/v1/agenda_items?select=id&limit=1`, { headers: hdr });
  check(r.status === 401 || r.status === 403, "Q11 anon SELECT agenda_items (still locked)", `HTTP ${r.status}`, "401/403");
}

// Q12: Can anon SELECT comments? (Should fail — RPC-only since PROJ-32 BUG-8/9)
{
  const r = await fetch(`${url}/rest/v1/comments?select=id&limit=1`, { headers: hdr });
  check(r.status === 401 || r.status === 403, "Q12 anon SELECT comments (still locked)", `HTTP ${r.status}`, "401/403");
}

// Q13: Public-event RPC still works?
{
  const r = await fetch(`${url}/rest/v1/rpc/get_public_event`, {
    method: "POST",
    headers: { ...hdr, "Content-Type": "application/json" },
    body: JSON.stringify({ p_slug: "hong-kong-april-2026" }),
  });
  check(r.status === 200, "Q13 public-event RPC still works", `HTTP ${r.status}`, "200");
}

console.log();
if (allGreen) {
  console.log("\x1b[32mAll 13 deep QA checks passed.\x1b[0m");
  process.exit(0);
} else {
  console.log("\x1b[31mOne or more deep QA checks failed.\x1b[0m");
  process.exit(1);
}
