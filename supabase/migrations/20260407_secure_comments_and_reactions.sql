-- PROJ-32 BUG-8/BUG-9 + same vulnerability in PROJ-31:
-- Lock down direct anon writes/reads on `comments` and `reactions`.
--
-- Background:
-- The previous architecture relied on API-route-side checks while leaving
-- RLS as `with check (true) / using (true)`. Because NEXT_PUBLIC_SUPABASE_ANON_KEY
-- is, by definition, exposed to every browser, anyone could bypass our API
-- routes and call PostgREST directly to insert/delete/read arbitrary rows.
--
-- This migration:
--   1. Adds SECURITY DEFINER RPCs that authenticate via the member token
--      cookie value (passed by the API route). These functions perform
--      membership/ownership checks server-side inside PostgreSQL itself, so
--      they cannot be bypassed regardless of which key is used to call them.
--   2. Revokes direct INSERT/UPDATE/DELETE on `comments` from anon and
--      authenticated. SELECT is also revoked on `comments` (since events are
--      not yet public; PROJ-35 will reintroduce a public read path).
--   3. Revokes direct INSERT/UPDATE/DELETE on `reactions` from anon and
--      authenticated. SELECT stays public on `reactions` because reaction
--      counts are intentionally cosmetic and don't leak event-private content.
--
-- Apply via Supabase SQL editor.

-- ============================================================================
-- 1. Helper: resolve a member from a token (used by every RPC below)
-- ============================================================================
create or replace function public.member_from_token(p_token text)
returns uuid
language sql
security definer
set search_path = public
as $$
  select id from public.members where token = p_token limit 1;
$$;

-- ============================================================================
-- 2. comments — security definer RPCs
-- ============================================================================

-- Insert
create or replace function public.create_comment(
  p_token text,
  p_content_item_id uuid,
  p_text text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
  v_event_id  uuid;
  v_trimmed   text;
  v_row       public.comments;
begin
  v_trimmed := btrim(coalesce(p_text, ''));
  if char_length(v_trimmed) = 0 then
    return jsonb_build_object('ok', false, 'error', 'empty');
  end if;
  if char_length(v_trimmed) > 500 then
    return jsonb_build_object('ok', false, 'error', 'too_long');
  end if;

  v_member_id := public.member_from_token(p_token);
  if v_member_id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  select event_id into v_event_id
  from public.content_items
  where id = p_content_item_id;
  if v_event_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if not exists (
    select 1 from public.event_members
    where event_id = v_event_id and member_id = v_member_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  insert into public.comments (content_item_id, author_id, text)
  values (p_content_item_id, v_member_id, v_trimmed)
  returning * into v_row;

  return jsonb_build_object('ok', true, 'comment', to_jsonb(v_row));
end;
$$;

-- Delete: author OR organizer OR daily admin (admin_member_id of agenda item)
create or replace function public.delete_comment(
  p_token text,
  p_comment_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
  v_comment   public.comments;
  v_item      public.content_items;
  v_event     public.events;
  v_admin     uuid;
  v_allowed   boolean := false;
begin
  v_member_id := public.member_from_token(p_token);
  if v_member_id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  select * into v_comment from public.comments where id = p_comment_id;
  if v_comment.id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_comment.author_id = v_member_id then
    v_allowed := true;
  end if;

  if not v_allowed then
    select * into v_item from public.content_items where id = v_comment.content_item_id;
    select * into v_event from public.events where id = v_item.event_id;
    if v_event.organizer_id = v_member_id then
      v_allowed := true;
    end if;
    if not v_allowed and v_item.agenda_item_id is not null then
      select admin_member_id into v_admin
      from public.agenda_items where id = v_item.agenda_item_id;
      if v_admin = v_member_id then
        v_allowed := true;
      end if;
    end if;
  end if;

  if not v_allowed then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  delete from public.comments where id = p_comment_id;
  return jsonb_build_object('ok', true);
end;
$$;

-- Read: list paginated, OR fetch single by id. Verifies membership.
create or replace function public.read_comments(
  p_token text,
  p_content_item_id uuid,
  p_cursor timestamptz default null,
  p_limit  int default 20,
  p_single_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
  v_event_id  uuid;
  v_rows      jsonb;
begin
  v_member_id := public.member_from_token(p_token);
  if v_member_id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  select event_id into v_event_id
  from public.content_items
  where id = p_content_item_id;
  if v_event_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if not exists (
    select 1 from public.event_members
    where event_id = v_event_id and member_id = v_member_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  if p_single_id is not null then
    select coalesce(jsonb_agg(c order by c.created_at asc), '[]'::jsonb) into v_rows
    from (
      select c.id, c.content_item_id, c.author_id, c.text, c.created_at,
             m.name as author_name, m.avatar_url as author_avatar_url
      from public.comments c
      left join public.members m on m.id = c.author_id
      where c.id = p_single_id and c.content_item_id = p_content_item_id
      limit 1
    ) c;
  else
    select coalesce(jsonb_agg(c order by c.created_at asc), '[]'::jsonb) into v_rows
    from (
      select c.id, c.content_item_id, c.author_id, c.text, c.created_at,
             m.name as author_name, m.avatar_url as author_avatar_url
      from public.comments c
      left join public.members m on m.id = c.author_id
      where c.content_item_id = p_content_item_id
        and (p_cursor is null or c.created_at < p_cursor)
      order by c.created_at desc
      limit greatest(1, least(p_limit, 100))
    ) c;
  end if;

  return jsonb_build_object('ok', true, 'comments', v_rows);
end;
$$;

-- Count comments per content item (used by GET /content list to populate
-- comment_count badges). Does NOT require membership: count is metadata.
create or replace function public.count_comments_by_items(
  p_item_ids uuid[]
) returns table (content_item_id uuid, cnt bigint)
language sql
security definer
set search_path = public
as $$
  select content_item_id, count(*)::bigint as cnt
  from public.comments
  where content_item_id = any(p_item_ids)
  group by content_item_id;
$$;

grant execute on function public.member_from_token(text) to anon, authenticated, service_role;
grant execute on function public.create_comment(text, uuid, text) to anon, authenticated, service_role;
grant execute on function public.delete_comment(text, uuid) to anon, authenticated, service_role;
grant execute on function public.read_comments(text, uuid, timestamptz, int, uuid) to anon, authenticated, service_role;
grant execute on function public.count_comments_by_items(uuid[]) to anon, authenticated, service_role;

-- ============================================================================
-- 3. reactions — security definer RPCs (same vulnerability as comments)
-- ============================================================================

create or replace function public.create_reaction(
  p_token text,
  p_content_item_id uuid,
  p_emoji text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
  v_event_id  uuid;
begin
  if p_emoji not in ('❤️','🔥','😂','👏','😮') then
    return jsonb_build_object('ok', false, 'error', 'invalid_emoji');
  end if;

  v_member_id := public.member_from_token(p_token);
  if v_member_id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  select event_id into v_event_id
  from public.content_items
  where id = p_content_item_id;
  if v_event_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if not exists (
    select 1 from public.event_members
    where event_id = v_event_id and member_id = v_member_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  insert into public.reactions (content_item_id, member_id, emoji)
  values (p_content_item_id, v_member_id, p_emoji)
  on conflict (content_item_id, member_id, emoji) do nothing;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.delete_reaction(
  p_token text,
  p_content_item_id uuid,
  p_emoji text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
begin
  v_member_id := public.member_from_token(p_token);
  if v_member_id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  delete from public.reactions
  where content_item_id = p_content_item_id
    and member_id = v_member_id
    and emoji = p_emoji;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.create_reaction(text, uuid, text) to anon, authenticated, service_role;
grant execute on function public.delete_reaction(text, uuid, text) to anon, authenticated, service_role;

-- ============================================================================
-- 4. Lock down direct table writes — close the BUG-8 hole
-- ============================================================================

-- comments: revoke ALL direct access from public roles. RLS policies remain
-- for completeness but the role privileges are the actual barrier.
revoke all on public.comments from anon;
revoke all on public.comments from authenticated;

-- reactions: revoke writes from public roles. SELECT stays granted because
-- reaction counts are intentionally public (they're displayed on cards).
revoke insert, update, delete on public.reactions from anon;
revoke insert, update, delete on public.reactions from authenticated;

-- Service role keeps full access (it always does, but be explicit).
grant all on public.comments to service_role;
grant all on public.reactions to service_role;
