-- PROJ-35 / BUG-1 (CRITICAL) — Lock down anon SELECT on sensitive tables
--
-- BACKGROUND
-- ----------
-- Until this migration, the anon role had effective SELECT on:
--   - members          (incl. members.token  → trivial account takeover)
--   - events           (full row, all events)
--   - event_members    (membership graph)
--   - agenda_items     (every agenda of every event)
--   - content_items    (every photo/video/text caption, draft or published)
--
-- A single curl request with NEXT_PUBLIC_SUPABASE_ANON_KEY (which is, by
-- design, embedded in the JS bundle and therefore public) could dump
-- members.token in plaintext and impersonate any user — including the
-- organizer role — by visiting /join/<token>. See PROJ-35 QA Round 1, BUG-1.
--
-- WHAT THIS MIGRATION DOES
-- ------------------------
-- 1. REVOKE the SQL-level SELECT grant on these 5 tables from `anon`.
--    This is a defence-in-depth move: even if a future migration accidentally
--    re-introduces a permissive RLS policy, anon will still be denied at the
--    GRANT layer.
-- 2. DROP every existing RLS policy on these tables (we keep RLS enabled but
--    purge any policy that previously allowed anon read). The remaining
--    policies are recreated as authenticated-only where they are still needed
--    for Realtime / authenticated browser access. Server routes use the
--    service_role key (see src/lib/supabase-admin.ts) and bypass RLS entirely.
-- 3. Re-enable Row Level Security on each table (idempotent).
--
-- WHAT STILL WORKS AFTER THIS MIGRATION
-- -------------------------------------
-- - The /e/[slug] public landing page reads only via the SECURITY DEFINER
--   RPC `get_public_event(p_slug)` (see 20260408_public_event_rls.sql), which
--   already excludes members.token and is grant-execute to anon.
-- - All server routes (middleware, /api/members/*, /api/events/*, /api/invite/*,
--   /join/[token]) have been switched to the service-role client, which
--   bypasses RLS. They continue to work unchanged in behaviour.
-- - Authenticated browser flows that hit content_items (Wanderer screen,
--   Content Pool, Tages-Admin curation) write through cookie-protected server
--   routes — they do not need anon SELECT.
--
-- KNOWN REGRESSIONS (tracked separately)
-- --------------------------------------
-- - Supabase Realtime (postgres_changes) on `content_items` and `reactions`
--   subscribed via the browser anon key will stop delivering payloads, since
--   Realtime evaluates RLS as the connecting role. Affected components:
--     src/components/content-pool.tsx
--     src/components/selectable-content-grid.tsx
--   The pages still load and function via cookie-authenticated server routes;
--   only the live "new content arrived" toast/refresh stops working until the
--   subscription layer is migrated to a JWT-bearing client or to Broadcast.
--   Reactions realtime on the `reactions` table is unaffected by this
--   migration (reactions table grants are not touched).
--
-- DO NOT APPLY VIA THE DASHBOARD WITHOUT REVIEW. Frank applies via SQL Editor.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1) members
-- ---------------------------------------------------------------------------
alter table public.members enable row level security;

revoke select on public.members from anon;
revoke insert on public.members from anon;
revoke update on public.members from anon;
revoke delete on public.members from anon;

do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'members'
  loop
    execute format('drop policy if exists %I on public.members', pol.policyname);
  end loop;
end $$;

-- No policies are recreated for members. All access goes through service_role
-- (server routes) or the get_public_event RPC (which only selects name +
-- avatar_url, never token).

-- ---------------------------------------------------------------------------
-- 2) events
-- ---------------------------------------------------------------------------
alter table public.events enable row level security;

revoke select on public.events from anon;
revoke insert on public.events from anon;
revoke update on public.events from anon;
revoke delete on public.events from anon;

do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'events'
  loop
    execute format('drop policy if exists %I on public.events', pol.policyname);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3) event_members
-- ---------------------------------------------------------------------------
alter table public.event_members enable row level security;

revoke select on public.event_members from anon;
revoke insert on public.event_members from anon;
revoke update on public.event_members from anon;
revoke delete on public.event_members from anon;

do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'event_members'
  loop
    execute format('drop policy if exists %I on public.event_members', pol.policyname);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4) agenda_items
-- ---------------------------------------------------------------------------
alter table public.agenda_items enable row level security;

revoke select on public.agenda_items from anon;
revoke insert on public.agenda_items from anon;
revoke update on public.agenda_items from anon;
revoke delete on public.agenda_items from anon;

do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'agenda_items'
  loop
    execute format('drop policy if exists %I on public.agenda_items', pol.policyname);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 5) content_items
-- ---------------------------------------------------------------------------
alter table public.content_items enable row level security;

revoke select on public.content_items from anon;
revoke insert on public.content_items from anon;
revoke update on public.content_items from anon;
revoke delete on public.content_items from anon;

do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'content_items'
  loop
    execute format('drop policy if exists %I on public.content_items', pol.policyname);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Verification helper (run manually after applying):
--
--   set role anon;
--   select count(*) from public.members;        -- expect: permission denied
--   select count(*) from public.events;         -- expect: permission denied
--   select count(*) from public.event_members;  -- expect: permission denied
--   select count(*) from public.agenda_items;   -- expect: permission denied
--   select count(*) from public.content_items;  -- expect: permission denied
--   select public.get_public_event('some-slug');-- expect: jsonb result
--   reset role;
-- ---------------------------------------------------------------------------

commit;
