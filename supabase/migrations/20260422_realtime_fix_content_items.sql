-- PROJ-38: Realtime-Fix Content-Pool
--
-- BACKGROUND
-- ----------
-- Migration 20260408_lockdown_anon_rls.sql revoked `SELECT ON content_items`
-- from the `anon` role and dropped every RLS policy on the table, as a
-- defence-in-depth response to PROJ-35 BUG-1 (anon could dump
-- `members.token` via REST). The lockdown was correct for `members`,
-- `events`, `event_members`, and `agenda_items` — all of which either
-- expose auth-tokens (members) or the membership graph.
--
-- Unintended regression: Supabase Realtime (Postgres CDC) evaluates RLS
-- as the role of the subscribing client. Browser subscribers connect with
-- the public anon key → their CDC channel on `content_items` went silent.
-- The WebSocket stays open but emits no payloads, so the Content-Pool and
-- the Tages-Admin curation grid no longer show live INSERT/DELETE events.
--
-- WHAT THIS MIGRATION DOES
-- ------------------------
-- 1. Restores `GRANT SELECT ON public.content_items TO anon`. Only SELECT —
--    INSERT/UPDATE/DELETE remain revoked. Writes continue to go through
--    the cookie-protected server routes (service_role, bypasses RLS).
-- 2. Adds a minimal RLS SELECT policy for the `anon` role that matches
--    every row (`using (true)`). RLS stays ENABLED; we only open the
--    SELECT side of the fence and only for SELECT, nothing else.
--
-- WHAT THIS MIGRATION DELIBERATELY DOES NOT DO
-- --------------------------------------------
-- - Does NOT touch `members`, `events`, `event_members`, or `agenda_items`.
--   Those tables remain fully locked down for anon. `members.token` stays
--   unreadable, which is the non-negotiable security invariant.
-- - Does NOT re-grant INSERT/UPDATE/DELETE on `content_items` to anon.
--   All writes must continue to go through server routes so we keep the
--   server-side event-membership checks intact.
-- - Does NOT touch `reactions`. Its `reactions_select_public` policy
--   (using true) was never revoked by the lockdown, so reactions Realtime
--   already works.
-- - Does NOT touch the `supabase_realtime` publication. `content_items`
--   is already published (20260406_baseline_schema.sql §content_items).
--
-- SECURITY ANALYSIS
-- -----------------
-- `content_items` holds: event_id, agenda_item_id, author_id, type,
-- media_url, thumbnail_url, caption, latitude, longitude, exif_date,
-- created_at. None of these are auth-tokens. The only secret credential
-- in the app (`members.token`) lives in a different table that stays
-- locked. Re-enabling anon SELECT on `content_items` means an attacker
-- who both (a) possesses the public anon key (it ships in every JS
-- bundle) AND (b) knows or guesses an event's UUIDv4 can list that
-- event's content via REST. v4 UUIDs are not guessable. This is the same
-- exposure the app had before the lockdown, which we accept.
--
-- Apply via Supabase SQL editor.
-- ============================================================================

begin;

-- Sanity: RLS must remain on. The lockdown migration already enabled it,
-- but we repeat the statement idempotently so this migration is
-- self-contained and tolerates manual dashboard tampering.
alter table public.content_items enable row level security;

-- 1. Restore the SQL-level SELECT grant removed by 20260408_lockdown_anon_rls.sql.
--    SELECT only. INSERT/UPDATE/DELETE stay revoked.
grant select on public.content_items to anon;

-- 2. Replace any old SELECT policy under this name (none should exist
--    after the lockdown, but idempotency matters — see Schema-Drift rule).
drop policy if exists "content_items_select_anon_realtime" on public.content_items;

-- Minimal SELECT policy: allow anon to read every row. This is what
-- Postgres CDC needs to deliver INSERT/DELETE payloads to anon-key
-- subscribers. Writes are still server-only (no insert/update/delete
-- policy for anon, no SQL grant either).
create policy "content_items_select_anon_realtime"
  on public.content_items
  for select
  to anon
  using (true);

commit;

-- ---------------------------------------------------------------------------
-- Verification (run manually after applying, in Supabase SQL editor):
--
--   set role anon;
--   select count(*) from public.content_items;   -- expect: a number (OK)
--   select count(*) from public.members;         -- expect: permission denied
--   select count(*) from public.event_members;   -- expect: permission denied
--   select count(*) from public.events;          -- expect: permission denied
--   select count(*) from public.agenda_items;    -- expect: permission denied
--   insert into public.content_items (event_id, author_id, type)
--     values (gen_random_uuid(), gen_random_uuid(), 'photo');
--                                                  -- expect: permission denied
--   reset role;
--
-- Realtime verification (browser console on a Content-Pool page):
--   1. Open the app on two devices / tabs as two different members of
--      the same event.
--   2. On device A, upload a photo via Wanderer screen.
--   3. On device B, the new card must appear within ~3 seconds without
--      reloading the page.
-- ---------------------------------------------------------------------------
