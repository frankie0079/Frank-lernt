-- PROJ-32: Kommentar-Threads
--
-- Creates the `comments` table with:
--   * CHECK constraint enforcing text length 1..500 (after trim)
--   * CASCADE delete when content_item or member is removed
--   * RLS: public SELECT, INSERT/DELETE via API (server enforces auth + ownership/role)
--   * Composite index on (content_item_id, created_at desc) for cursor pagination
--   * Index on author_id for "own comments" lookups
--   * Realtime publication for INSERT/DELETE
--
-- Apply via Supabase SQL editor.

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  author_id uuid not null references public.members(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now(),
  constraint comments_text_length_chk
    check (char_length(btrim(text)) between 1 and 500)
);

create index if not exists comments_item_created_idx
  on public.comments (content_item_id, created_at desc);

create index if not exists comments_author_id_idx
  on public.comments (author_id);

-- Row Level Security
alter table public.comments enable row level security;

-- SELECT: public (public event page must render comments to non-members)
drop policy if exists "comments_select_public" on public.comments;
create policy "comments_select_public"
  on public.comments
  for select
  using (true);

-- INSERT: handled by API route (anon key, server-side membership check).
-- Server verifies member_token cookie + event membership before insert.
-- Mirrors the pattern used for reactions/content_items.
drop policy if exists "comments_insert_via_api" on public.comments;
create policy "comments_insert_via_api"
  on public.comments
  for insert
  with check (true);

-- DELETE: server route enforces "own comment OR organizer/daily-admin".
drop policy if exists "comments_delete_via_api" on public.comments;
create policy "comments_delete_via_api"
  on public.comments
  for delete
  using (true);

-- Realtime publication
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'comments'
  ) then
    alter publication supabase_realtime add table public.comments;
  end if;
end$$;
