-- BUG (PROJ-26): event_members.id column missing in production.
--
-- The application code (and the join_event RPC) selects an `id` column from
-- event_members, but the table in production was created without it. This
-- caused HTTP 500 errors on:
--   GET  /api/events/[id]/members
--   POST /api/invite/[token]   (via join_event RPC)
--
-- Tech design (PROJ-26 spec) defines event_members.id as UUID PK. This
-- migration adds the column safely (idempotent) and promotes it to PK if no
-- primary key exists yet.
--
-- Apply via Supabase SQL editor.

-- 1. Add the id column with a default UUID generator if it doesn't exist.
alter table public.event_members
  add column if not exists id uuid not null default gen_random_uuid();

-- 2. Backfill any NULLs (defensive — shouldn't happen given the default).
update public.event_members
  set id = gen_random_uuid()
  where id is null;

-- 3. Add primary key constraint only if the table has no PK yet.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.event_members'::regclass
      and contype = 'p'
  ) then
    alter table public.event_members
      add constraint event_members_pkey primary key (id);
  end if;
end$$;
