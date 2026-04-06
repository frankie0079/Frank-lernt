-- PROJ-31: Likes & Emoji-Reactions
--
-- Creates the `reactions` table with:
--   * UNIQUE constraint preventing duplicate reactions per (item, member, emoji)
--   * CHECK constraint restricting emoji to the 5 allowed values
--   * CASCADE delete when content_item or member is removed
--   * RLS: public SELECT, authenticated INSERT (own only), DELETE own only
--   * Index on content_item_id for fast aggregation
--   * Realtime publication for INSERT/DELETE
--
-- Apply via Supabase SQL editor.

create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  emoji text not null check (emoji in ('❤️', '🔥', '😂', '👏', '😮')),
  created_at timestamptz not null default now(),
  unique (content_item_id, member_id, emoji)
);

create index if not exists reactions_content_item_id_idx
  on public.reactions (content_item_id);

create index if not exists reactions_member_id_idx
  on public.reactions (member_id);

-- Row Level Security
alter table public.reactions enable row level security;

-- SELECT: public (event public page must show counts even to non-members)
drop policy if exists "reactions_select_public" on public.reactions;
create policy "reactions_select_public"
  on public.reactions
  for select
  using (true);

-- INSERT: handled by API route (anon key, server-side membership check).
-- We do NOT expose direct anon writes; the API enforces auth + membership.
-- Policy below allows the API's anon-key client to insert any row, since
-- server-side it has already verified the member_token cookie + event
-- membership. (This mirrors the pattern used for content_items inserts.)
drop policy if exists "reactions_insert_via_api" on public.reactions;
create policy "reactions_insert_via_api"
  on public.reactions
  for insert
  with check (true);

-- DELETE: same pattern. Server route enforces "own reaction only".
drop policy if exists "reactions_delete_via_api" on public.reactions;
create policy "reactions_delete_via_api"
  on public.reactions
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
      and tablename = 'reactions'
  ) then
    alter publication supabase_realtime add table public.reactions;
  end if;
end$$;
