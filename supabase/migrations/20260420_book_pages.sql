-- PROJ-36: Post-Event Tagebuch
--
-- Adds `book_pages` and `book_page_items` tables plus SECURITY DEFINER RPCs
-- that authenticate via the member token cookie value (passed by API routes).
-- Direct PostgREST writes are revoked for anon/authenticated; API routes call
-- the RPCs server-side, mirroring the locked-down architecture from
-- 20260407_daily_reports.sql and 20260407_secure_comments_and_reactions.sql.
--
-- Design notes
-- ------------
-- - Exactly ONE book_pages row per agenda_item (UNIQUE constraint). The page
--   is auto-created lazily by get_event_book (like get_report for reports).
-- - book_page_items is a simple join with sort_order; bulk-save replaces all
--   rows for a page (delete + insert), matching the PROJ-33 report flow.
-- - RLS: closed-by-default. All access via the three RPCs.
-- - Read access: any event member (organizer + admin + member).
-- - Write access: organizer only (role = 'organizer' on event_members OR
--   events.organizer_id = member.id — we check both for safety).
--
-- Apply via Supabase SQL editor.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tables
-- ----------------------------------------------------------------------------
create table if not exists public.book_pages (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references public.events(id) on delete cascade,
  agenda_item_id  uuid not null unique references public.agenda_items(id) on delete cascade,
  layout          text not null default 'single'
                    check (layout in ('single','two','three','text-left')),
  comment         text not null default ''
                    check (length(comment) <= 2000),
  is_visible      boolean not null default true,
  sort_order      int not null default 0,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.members(id) on delete set null
);

create index if not exists book_pages_event_id_idx
  on public.book_pages (event_id);
create index if not exists book_pages_event_agenda_idx
  on public.book_pages (event_id, agenda_item_id);

create table if not exists public.book_page_items (
  id               uuid primary key default gen_random_uuid(),
  page_id          uuid not null references public.book_pages(id) on delete cascade,
  content_item_id  uuid not null references public.content_items(id) on delete restrict,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now(),
  unique (page_id, content_item_id)
);

create index if not exists book_page_items_page_id_idx
  on public.book_page_items (page_id);
create index if not exists book_page_items_sort_idx
  on public.book_page_items (page_id, sort_order);
create index if not exists book_page_items_content_idx
  on public.book_page_items (content_item_id);

-- ----------------------------------------------------------------------------
-- 2. RLS — enabled but closed by default. All access via SECURITY DEFINER RPCs.
-- ----------------------------------------------------------------------------
alter table public.book_pages       enable row level security;
alter table public.book_page_items  enable row level security;

revoke all on public.book_pages      from anon;
revoke all on public.book_pages      from authenticated;
revoke all on public.book_page_items from anon;
revoke all on public.book_page_items from authenticated;
grant  all on public.book_pages      to service_role;
grant  all on public.book_page_items to service_role;

-- ----------------------------------------------------------------------------
-- 3. Helpers — membership & organizer checks keyed by the token cookie
-- ----------------------------------------------------------------------------
create or replace function public.member_is_event_organizer(
  p_member_id uuid,
  p_event_id  uuid
) returns boolean
language sql
security definer
set search_path = public
as $fn_is_org$
  select exists (
    select 1
    from public.events e
    where e.id = p_event_id
      and e.organizer_id = p_member_id
  );
$fn_is_org$;

create or replace function public.member_is_in_event(
  p_member_id uuid,
  p_event_id  uuid
) returns boolean
language sql
security definer
set search_path = public
as $fn_in_event$
  select
    public.member_is_event_organizer(p_member_id, p_event_id)
    or exists (
      select 1
      from public.event_members
      where event_id = p_event_id
        and member_id = p_member_id
    );
$fn_in_event$;

-- ----------------------------------------------------------------------------
-- 4. RPC: get_event_book — returns every book page of an event, one per
--    agenda_item. Missing pages are auto-created with defaults so the editor
--    always has something to edit. Items are joined with content + author meta.
-- ----------------------------------------------------------------------------
create or replace function public.get_event_book(
  p_token     text,
  p_event_id  uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $fn_get$
declare
  v_member_id   uuid;
  v_is_org      boolean;
  v_pages       jsonb;
begin
  v_member_id := public.member_from_token(p_token);
  if v_member_id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  if not exists (select 1 from public.events where id = p_event_id) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if not public.member_is_in_event(v_member_id, p_event_id) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  v_is_org := public.member_is_event_organizer(v_member_id, p_event_id);

  -- Auto-create missing pages for every agenda item of this event.
  insert into public.book_pages (event_id, agenda_item_id, layout, comment,
                                 is_visible, sort_order, updated_at)
  select
    a.event_id,
    a.id,
    'single'::text,
    ''::text,
    true,
    a.sort_order,
    now()
  from public.agenda_items a
  where a.event_id = p_event_id
    and not exists (
      select 1 from public.book_pages bp
      where bp.agenda_item_id = a.id
    );

  -- Assemble pages + joined items + joined agenda meta.
  select coalesce(
    jsonb_agg(row order by row.agenda_date asc, row.sort_order asc),
    '[]'::jsonb
  )
  into v_pages
  from (
    select
      bp.id,
      bp.event_id,
      bp.agenda_item_id,
      bp.layout,
      bp.comment,
      bp.is_visible,
      bp.sort_order,
      bp.updated_at,
      bp.updated_by,
      m.name         as updated_by_name,
      a.title        as agenda_title,
      a.date         as agenda_date,
      (
        select coalesce(jsonb_agg(item order by item.sort_order asc), '[]'::jsonb)
        from (
          select
            bpi.id,
            bpi.content_item_id,
            bpi.sort_order,
            c.type,
            c.media_url,
            c.thumbnail_url,
            c.caption,
            c.author_id,
            au.name       as author_name,
            au.avatar_url as author_avatar_url
          from public.book_page_items bpi
          left join public.content_items c on c.id = bpi.content_item_id
          left join public.members au      on au.id = c.author_id
          where bpi.page_id = bp.id
        ) as item
      ) as items
    from public.book_pages bp
    join public.agenda_items a on a.id = bp.agenda_item_id
    left join public.members m on m.id = bp.updated_by
    where bp.event_id = p_event_id
  ) row;

  return jsonb_build_object(
    'ok', true,
    'event_id', p_event_id,
    'is_organizer', v_is_org,
    'pages', v_pages
  );
end;
$fn_get$;

-- ----------------------------------------------------------------------------
-- 5. RPC: save_book_page — upsert page meta + bulk-replace its items.
--    Organizer-only. Items are validated to belong to the same event.
-- ----------------------------------------------------------------------------
create or replace function public.save_book_page(
  p_token          text,
  p_agenda_item_id uuid,
  p_layout         text,
  p_comment        text,
  p_is_visible     boolean,
  p_items          jsonb  -- [{ "content_item_id": "...", "sort_order": 10 }, ...]
) returns jsonb
language plpgsql
security definer
set search_path = public
as $fn_save$
declare
  v_member_id uuid;
  v_event_id  uuid;
  v_page      public.book_pages;
  v_item      jsonb;
  v_cid       uuid;
begin
  v_member_id := public.member_from_token(p_token);
  if v_member_id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  select event_id into v_event_id
  from public.agenda_items where id = p_agenda_item_id;
  if v_event_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if not public.member_is_event_organizer(v_member_id, v_event_id) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  -- Validate inputs
  if p_layout is null or p_layout not in ('single','two','three','text-left') then
    return jsonb_build_object('ok', false, 'error', 'invalid_layout');
  end if;

  if p_comment is null then
    p_comment := '';
  end if;

  if length(p_comment) > 2000 then
    return jsonb_build_object('ok', false, 'error', 'comment_too_long');
  end if;

  if p_is_visible is null then
    p_is_visible := true;
  end if;

  if jsonb_typeof(p_items) <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'invalid_payload');
  end if;

  -- Validate every content_item_id belongs to the same event.
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_cid := nullif(v_item->>'content_item_id','')::uuid;
    if v_cid is null then
      return jsonb_build_object('ok', false, 'error', 'invalid_item');
    end if;
    if not exists (
      select 1 from public.content_items
      where id = v_cid and event_id = v_event_id
    ) then
      return jsonb_build_object('ok', false, 'error', 'content_not_in_event');
    end if;
  end loop;

  -- Upsert the page row.
  select * into v_page
  from public.book_pages
  where agenda_item_id = p_agenda_item_id;

  if v_page.id is null then
    insert into public.book_pages (event_id, agenda_item_id, layout, comment,
                                   is_visible, sort_order, updated_at, updated_by)
    values (v_event_id, p_agenda_item_id, p_layout, p_comment,
            p_is_visible, 0, now(), v_member_id)
    returning * into v_page;
  else
    update public.book_pages
    set layout      = p_layout,
        comment     = p_comment,
        is_visible  = p_is_visible,
        updated_at  = now(),
        updated_by  = v_member_id
    where id = v_page.id
    returning * into v_page;
  end if;

  -- Bulk-replace items (delete all + insert fresh).
  delete from public.book_page_items where page_id = v_page.id;

  insert into public.book_page_items (page_id, content_item_id, sort_order)
  select
    v_page.id,
    (elem->>'content_item_id')::uuid,
    coalesce((elem->>'sort_order')::int, 0)
  from jsonb_array_elements(p_items) as elem;

  return public.get_book_page_by_agenda(v_page.agenda_item_id);
end;
$fn_save$;

-- ----------------------------------------------------------------------------
-- 6. Internal helper: return one page + items for an agenda_item.
--    Called by save_book_page so the API gets the fully-hydrated row back in
--    one round-trip (saves a second GET after the PUT).
-- ----------------------------------------------------------------------------
create or replace function public.get_book_page_by_agenda(
  p_agenda_item_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $fn_one$
declare
  v_page jsonb;
begin
  select row_to_json(row)::jsonb
  into v_page
  from (
    select
      bp.id,
      bp.event_id,
      bp.agenda_item_id,
      bp.layout,
      bp.comment,
      bp.is_visible,
      bp.sort_order,
      bp.updated_at,
      bp.updated_by,
      m.name         as updated_by_name,
      a.title        as agenda_title,
      a.date         as agenda_date,
      (
        select coalesce(jsonb_agg(item order by item.sort_order asc), '[]'::jsonb)
        from (
          select
            bpi.id,
            bpi.content_item_id,
            bpi.sort_order,
            c.type,
            c.media_url,
            c.thumbnail_url,
            c.caption,
            c.author_id,
            au.name       as author_name,
            au.avatar_url as author_avatar_url
          from public.book_page_items bpi
          left join public.content_items c on c.id = bpi.content_item_id
          left join public.members au      on au.id = c.author_id
          where bpi.page_id = bp.id
        ) as item
      ) as items
    from public.book_pages bp
    join public.agenda_items a on a.id = bp.agenda_item_id
    left join public.members m on m.id = bp.updated_by
    where bp.agenda_item_id = p_agenda_item_id
    limit 1
  ) row;

  return jsonb_build_object('ok', true, 'page', v_page);
end;
$fn_one$;

-- ----------------------------------------------------------------------------
-- 7. Grants
-- ----------------------------------------------------------------------------
grant execute on function public.member_is_event_organizer(uuid, uuid)
  to anon, authenticated, service_role;
grant execute on function public.member_is_in_event(uuid, uuid)
  to anon, authenticated, service_role;
grant execute on function public.get_event_book(text, uuid)
  to anon, authenticated, service_role;
grant execute on function public.save_book_page(text, uuid, text, text, boolean, jsonb)
  to anon, authenticated, service_role;
grant execute on function public.get_book_page_by_agenda(uuid)
  to anon, authenticated, service_role;
