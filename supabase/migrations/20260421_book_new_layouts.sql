-- PROJ-36 follow-up: extend book page layouts + raise photo cap
--
-- Adds three new layout templates:
--   - 'four'       : 2x2 grid of 4 photos
--   - 'five-hero'  : 1 hero + 2x2 quad (Instagram-style)
--   - 'grid-3'     : flowing 3-column square grid (auto-scales to up to 60 photos)
--
-- Client-side cap was 12; that was too low for event days with 30+ photos.
-- The DB does not enforce a cap on book_page_items — cap is display-only,
-- so no constraint change there. Only the `layout` CHECK gains the three
-- new enum values, plus the `save_book_page` RPC must accept them.
--
-- Apply via Supabase SQL Editor.
-- ============================================================================

-- 1. Replace the layout CHECK to include the three new values.
alter table public.book_pages
  drop constraint if exists book_pages_layout_check;

alter table public.book_pages
  add constraint book_pages_layout_check
  check (layout in ('single','two','three','four','five-hero','grid-3','text-left'));

-- 2. Replace save_book_page so its in-body validation accepts the new layouts.
--    All other logic (organizer check, bulk-replace items, etc.) is unchanged
--    from 20260420_book_pages.sql; we reissue the full function body rather
--    than trying to ALTER because plpgsql does not support partial rewrites.
create or replace function public.save_book_page(
  p_token          text,
  p_agenda_item_id uuid,
  p_layout         text,
  p_comment        text,
  p_is_visible     boolean,
  p_items          jsonb
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

  if p_layout is null or p_layout not in (
    'single','two','three','four','five-hero','grid-3','text-left'
  ) then
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

grant execute on function public.save_book_page(text, uuid, text, text, boolean, jsonb)
  to anon, authenticated, service_role;
