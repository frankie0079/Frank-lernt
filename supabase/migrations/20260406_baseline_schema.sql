-- BASELINE SCHEMA — idempotent reconstruction of all v2 EventDocs tables.
--
-- Background: Tables in production were created manually via the Supabase
-- Dashboard, never as code-tracked migrations. This caused two production
-- outages (event_members.id missing, content_items missing entirely). This
-- migration documents the canonical schema and ensures every required table
-- exists. It is safe to run against production: every statement uses
-- IF NOT EXISTS or guarded DO blocks, so existing tables/columns/indexes are
-- left untouched.
--
-- Apply via Supabase SQL editor.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. members  (existing in prod — verified via REST introspection 2026-04-06)
-- ----------------------------------------------------------------------------
create table if not exists public.members (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  token       text not null unique,
  role        text not null check (role in ('organizer','admin','member')),
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists members_token_idx on public.members (token);

-- ----------------------------------------------------------------------------
-- 2. events  (existing in prod)
-- ----------------------------------------------------------------------------
create table if not exists public.events (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  description   text,
  start_date    date not null,
  end_date      date not null,
  cover_url     text,
  slug          text not null unique,
  organizer_id  uuid not null references public.members(id) on delete cascade,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists events_organizer_id_idx on public.events (organizer_id);
create index if not exists events_slug_idx on public.events (slug);

-- ----------------------------------------------------------------------------
-- 3. event_members  (existing in prod; .id column was added 2026-04-06 via
--    20260406_event_members_id_column.sql — kept here for full reproducibility)
-- ----------------------------------------------------------------------------
create table if not exists public.event_members (
  id         uuid not null default gen_random_uuid(),
  event_id   uuid not null references public.events(id) on delete cascade,
  member_id  uuid not null references public.members(id) on delete cascade,
  role       text not null check (role in ('organizer','admin','member')),
  joined_at  timestamptz not null default now(),
  unique (event_id, member_id)
);

-- Ensure id is PK if it isn't yet (idempotent guard)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.event_members'::regclass and contype = 'p'
  ) then
    alter table public.event_members add constraint event_members_pkey primary key (id);
  end if;
end$$;

create index if not exists event_members_event_id_idx on public.event_members (event_id);
create index if not exists event_members_member_id_idx on public.event_members (member_id);

-- ----------------------------------------------------------------------------
-- 4. invitations  (existing in prod)
-- ----------------------------------------------------------------------------
create table if not exists public.invitations (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events(id) on delete cascade,
  token       text not null unique,
  created_by  uuid not null references public.members(id) on delete cascade,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

create index if not exists invitations_token_idx on public.invitations (token);
create index if not exists invitations_event_id_idx on public.invitations (event_id);

-- ----------------------------------------------------------------------------
-- 5. agenda_items  (existing in prod)
-- ----------------------------------------------------------------------------
create table if not exists public.agenda_items (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references public.events(id) on delete cascade,
  date             date not null,
  title            text not null,
  description      text,
  admin_member_id  uuid references public.members(id) on delete set null,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now()
);

create index if not exists agenda_items_event_id_idx on public.agenda_items (event_id);

-- ----------------------------------------------------------------------------
-- 6. content_items  (NEW — was MISSING in prod despite PROJ-28/29/30 marked
--    as Deployed. Reconstructed from src/lib/validations/content.ts and
--    src/app/api/events/[id]/content/route.ts)
-- ----------------------------------------------------------------------------
create table if not exists public.content_items (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references public.events(id) on delete cascade,
  agenda_item_id  uuid references public.agenda_items(id) on delete set null,
  author_id       uuid not null references public.members(id) on delete cascade,
  type            text not null check (type in ('photo','video','text','audio')),
  media_url       text,
  thumbnail_url   text,
  caption         text check (caption is null or length(caption) <= 2500),
  latitude        double precision check (latitude is null or (latitude between -90 and 90)),
  longitude       double precision check (longitude is null or (longitude between -180 and 180)),
  exif_date       timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists content_items_event_id_idx on public.content_items (event_id);
create index if not exists content_items_agenda_item_id_idx on public.content_items (agenda_item_id);
create index if not exists content_items_author_id_idx on public.content_items (author_id);
create index if not exists content_items_created_at_idx on public.content_items (created_at desc);

-- RLS for content_items
alter table public.content_items enable row level security;

-- SELECT: public (mirrors PROJ-35 öffentliche Event-Seite)
drop policy if exists "content_items_select_public" on public.content_items;
create policy "content_items_select_public"
  on public.content_items for select
  using (true);

-- INSERT/UPDATE/DELETE: handled by API routes server-side (anon key + cookie
-- check). Mirrors the pattern documented in 20260406_reactions.sql.
drop policy if exists "content_items_insert_via_api" on public.content_items;
create policy "content_items_insert_via_api"
  on public.content_items for insert with check (true);

drop policy if exists "content_items_update_via_api" on public.content_items;
create policy "content_items_update_via_api"
  on public.content_items for update using (true) with check (true);

drop policy if exists "content_items_delete_via_api" on public.content_items;
create policy "content_items_delete_via_api"
  on public.content_items for delete using (true);

-- Realtime publication for content_items
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'content_items'
  ) then
    alter publication supabase_realtime add table public.content_items;
  end if;
end$$;
