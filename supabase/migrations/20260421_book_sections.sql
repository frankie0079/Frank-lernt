-- PROJ-36 Stage 2: Stackable sections per diary day
--
-- Before: one book_page per agenda day, with a single layout + comment +
-- items. That gave a short, one-template-per-day feel.
--
-- After: one book_page per agenda day remains as the visibility/ownership
-- container, but the content lives in book_sections (1..many per page), each
-- with its own layout + comment + items. A day can now mix, e.g.:
--   section 1: 'single'    (hero shot of the morning)
--   section 2: 'four'      (four food photos)
--   section 3: 'grid-3'    (20 beach photos)
--   section 4: 'text-left' (evening reflection)
--
-- Backward-compat strategy:
--   - book_pages keeps the layout/comment columns — they become vestigial for
--     new code but stay around so a rollback to the previous release can
--     still read the single-layout-per-day model.
--   - book_page_items stays as well (rollback safety). New writes never touch
--     it — all new items land in book_section_items.
--   - save_book_page gets a NEW 4-arg signature (token, agenda_item_id,
--     is_visible, sections_jsonb). The old 6-arg signature stays as dead code
--     until a future cleanup migration drops it.
--
-- Apply via Supabase SQL Editor.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------
create table if not exists public.book_sections (
  id           uuid primary key default gen_random_uuid(),
  page_id      uuid not null references public.book_pages(id) on delete cascade,
  layout       text not null default 'single'
                 check (layout in ('single','two','three','four','five-hero','grid-3','text-left')),
  comment      text not null default ''
                 check (length(comment) <= 2000),
  sort_order   int  not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists book_sections_page_id_idx
  on public.book_sections (page_id);
create index if not exists book_sections_sort_idx
  on public.book_sections (page_id, sort_order);

create table if not exists public.book_section_items (
  id               uuid primary key default gen_random_uuid(),
  section_id       uuid not null references public.book_sections(id) on delete cascade,
  content_item_id  uuid not null references public.content_items(id) on delete restrict,
  sort_order       int  not null default 0,
  created_at       timestamptz not null default now(),
  unique (section_id, content_item_id)
);

create index if not exists book_section_items_section_id_idx
  on public.book_section_items (section_id);
create index if not exists book_section_items_sort_idx
  on public.book_section_items (section_id, sort_order);
create index if not exists book_section_items_content_idx
  on public.book_section_items (content_item_id);

-- ---------------------------------------------------------------------------
-- 2. RLS: closed-by-default, access only via SECURITY DEFINER RPCs
-- ---------------------------------------------------------------------------
alter table public.book_sections      enable row level security;
alter table public.book_section_items enable row level security;

revoke all on public.book_sections      from anon;
revoke all on public.book_sections      from authenticated;
revoke all on public.book_section_items from anon;
revoke all on public.book_section_items from authenticated;
grant  all on public.book_sections      to service_role;
grant  all on public.book_section_items to service_role;

-- ---------------------------------------------------------------------------
-- 3. Data migration: every existing book_page that has items or a comment
--    becomes a single-section page preserving its layout & comment.
-- ---------------------------------------------------------------------------
insert into public.book_sections (page_id, layout, comment, sort_order, created_at, updated_at)
select
  bp.id,
  bp.layout,
  coalesce(bp.comment, ''),
  0,
  coalesce(bp.updated_at, now()),
  coalesce(bp.updated_at, now())
from public.book_pages bp
where (
  exists (select 1 from public.book_page_items bpi where bpi.page_id = bp.id)
  or length(coalesce(bp.comment, '')) > 0
)
and not exists (
  select 1 from public.book_sections s where s.page_id = bp.id
);

insert into public.book_section_items (section_id, content_item_id, sort_order, created_at)
select
  bs.id,
  bpi.content_item_id,
  bpi.sort_order,
  bpi.created_at
from public.book_page_items bpi
join public.book_sections bs on bs.page_id = bpi.page_id
where bs.sort_order = 0
  and not exists (
    select 1 from public.book_section_items bsi
    where bsi.section_id = bs.id
      and bsi.content_item_id = bpi.content_item_id
  );

-- ---------------------------------------------------------------------------
-- 4. RPC: get_event_book — now returns nested sections instead of flat items
--    on each page. Shape is identical for the outer page envelope so
--    organizer / visibility / date-sort logic in the API route is unchanged.
-- ---------------------------------------------------------------------------
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
      bp.is_visible,
      bp.sort_order,
      bp.updated_at,
      bp.updated_by,
      m.name         as updated_by_name,
      a.title        as agenda_title,
      a.date         as agenda_date,
      (
        select coalesce(jsonb_agg(sec order by sec.sort_order asc), '[]'::jsonb)
        from (
          select
            bs.id,
            bs.page_id,
            bs.layout,
            bs.comment,
            bs.sort_order,
            (
              select coalesce(jsonb_agg(item order by item.sort_order asc), '[]'::jsonb)
              from (
                select
                  bsi.id,
                  bsi.content_item_id,
                  bsi.sort_order,
                  c.type,
                  c.media_url,
                  c.thumbnail_url,
                  c.caption,
                  c.author_id,
                  au.name       as author_name,
                  au.avatar_url as author_avatar_url
                from public.book_section_items bsi
                left join public.content_items c on c.id = bsi.content_item_id
                left join public.members au      on au.id = c.author_id
                where bsi.section_id = bs.id
              ) as item
            ) as items
          from public.book_sections bs
          where bs.page_id = bp.id
        ) as sec
      ) as sections
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

grant execute on function public.get_event_book(text, uuid)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. RPC: save_book_page (new 4-arg signature)
--    p_sections = [{ "layout": "...", "comment": "...", "sort_order": 0,
--                    "items": [{ "content_item_id": "...", "sort_order": 10 }] }]
--    Bulk-replace: drops all existing sections+items of the page, inserts
--    fresh ones. Organizer-only.
-- ---------------------------------------------------------------------------
create or replace function public.save_book_page(
  p_token          text,
  p_agenda_item_id uuid,
  p_is_visible     boolean,
  p_sections       jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $fn_save2$
declare
  v_member_id uuid;
  v_event_id  uuid;
  v_page      public.book_pages;
  v_section   jsonb;
  v_section_id uuid;
  v_item      jsonb;
  v_cid       uuid;
  v_layout    text;
  v_comment   text;
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

  if p_is_visible is null then
    p_is_visible := true;
  end if;

  if jsonb_typeof(p_sections) <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'invalid_payload');
  end if;

  -- Pre-validate every section + its items before touching the DB.
  for v_section in select * from jsonb_array_elements(p_sections) loop
    v_layout  := v_section->>'layout';
    v_comment := coalesce(v_section->>'comment', '');

    if v_layout is null or v_layout not in (
      'single','two','three','four','five-hero','grid-3','text-left'
    ) then
      return jsonb_build_object('ok', false, 'error', 'invalid_layout');
    end if;

    if length(v_comment) > 2000 then
      return jsonb_build_object('ok', false, 'error', 'comment_too_long');
    end if;

    if v_section ? 'items' and jsonb_typeof(v_section->'items') <> 'array' then
      return jsonb_build_object('ok', false, 'error', 'invalid_payload');
    end if;

    if v_section ? 'items' then
      for v_item in select * from jsonb_array_elements(v_section->'items') loop
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
    end if;
  end loop;

  -- Upsert the page row (visibility + stewardship only).
  select * into v_page
  from public.book_pages
  where agenda_item_id = p_agenda_item_id;

  if v_page.id is null then
    insert into public.book_pages (event_id, agenda_item_id, layout, comment,
                                   is_visible, sort_order, updated_at, updated_by)
    values (v_event_id, p_agenda_item_id, 'single', '',
            p_is_visible, 0, now(), v_member_id)
    returning * into v_page;
  else
    update public.book_pages
    set is_visible  = p_is_visible,
        updated_at  = now(),
        updated_by  = v_member_id
    where id = v_page.id
    returning * into v_page;
  end if;

  -- Bulk-replace: cascade deletes section_items via FK ON DELETE CASCADE.
  delete from public.book_sections where page_id = v_page.id;

  -- Insert fresh sections and their items.
  for v_section in select * from jsonb_array_elements(p_sections) loop
    insert into public.book_sections (page_id, layout, comment, sort_order,
                                      created_at, updated_at)
    values (
      v_page.id,
      v_section->>'layout',
      coalesce(v_section->>'comment',''),
      coalesce((v_section->>'sort_order')::int, 0),
      now(),
      now()
    )
    returning id into v_section_id;

    if v_section ? 'items' then
      insert into public.book_section_items (section_id, content_item_id, sort_order)
      select
        v_section_id,
        (elem->>'content_item_id')::uuid,
        coalesce((elem->>'sort_order')::int, 0)
      from jsonb_array_elements(v_section->'items') as elem;
    end if;
  end loop;

  return public.get_book_page_by_agenda(v_page.agenda_item_id);
end;
$fn_save2$;

grant execute on function public.save_book_page(text, uuid, boolean, jsonb)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Rewrite get_book_page_by_agenda to include the nested sections shape so
--    save_book_page's return matches the GET response.
-- ---------------------------------------------------------------------------
create or replace function public.get_book_page_by_agenda(
  p_agenda_item_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $fn_one2$
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
      bp.is_visible,
      bp.sort_order,
      bp.updated_at,
      bp.updated_by,
      m.name         as updated_by_name,
      a.title        as agenda_title,
      a.date         as agenda_date,
      (
        select coalesce(jsonb_agg(sec order by sec.sort_order asc), '[]'::jsonb)
        from (
          select
            bs.id,
            bs.page_id,
            bs.layout,
            bs.comment,
            bs.sort_order,
            (
              select coalesce(jsonb_agg(item order by item.sort_order asc), '[]'::jsonb)
              from (
                select
                  bsi.id,
                  bsi.content_item_id,
                  bsi.sort_order,
                  c.type,
                  c.media_url,
                  c.thumbnail_url,
                  c.caption,
                  c.author_id,
                  au.name       as author_name,
                  au.avatar_url as author_avatar_url
                from public.book_section_items bsi
                left join public.content_items c on c.id = bsi.content_item_id
                left join public.members au      on au.id = c.author_id
                where bsi.section_id = bs.id
              ) as item
            ) as items
          from public.book_sections bs
          where bs.page_id = bp.id
        ) as sec
      ) as sections
    from public.book_pages bp
    join public.agenda_items a on a.id = bp.agenda_item_id
    left join public.members m on m.id = bp.updated_by
    where bp.agenda_item_id = p_agenda_item_id
    limit 1
  ) row;

  return jsonb_build_object('ok', true, 'page', v_page);
end;
$fn_one2$;

grant execute on function public.get_book_page_by_agenda(uuid)
  to anon, authenticated, service_role;
