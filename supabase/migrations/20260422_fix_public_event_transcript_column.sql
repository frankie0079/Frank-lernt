-- Pre-existing bug (found during PROJ-38 QA, unrelated to PROJ-38 scope):
-- get_public_event RPC references ci.transcript — a column that does not
-- exist in content_items. The error was introduced during the design pass
-- on 2026-04-17 in migrations 20260417_cover_position.sql and
-- 20260417_cover_scale.sql.
--
-- Consequence: /e/[slug] (the public event page) fails with
-- 42703 "column ci.transcript does not exist" and returns 404 in the UI.
--
-- Fix: drop the 'transcript' key from the item JSON. No client code reads
-- this field — Web Speech API transcripts are stored in content_items.caption,
-- not in a separate column. This migration preserves the rest of the RPC
-- shape from 20260417_cover_scale.sql (cover_position + cover_scale fields
-- on the event object are retained).
--
-- Apply via Supabase SQL editor.
-- ============================================================================

create or replace function public.get_public_event(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn_pe$
declare
  v_event       public.events;
  v_member_count bigint;
  v_agenda      jsonb;
  v_reports     jsonb;
begin
  select * into v_event
  from public.events
  where slug = p_slug;

  if v_event.id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  select count(*) into v_member_count
  from public.event_members
  where event_id = v_event.id;

  select coalesce(jsonb_agg(
    jsonb_build_object('id', a.id, 'date', a.date, 'title', a.title)
    order by a.sort_order, a.date
  ), '[]'::jsonb) into v_agenda
  from public.agenda_items a
  where a.event_id = v_event.id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'agenda_item_id', rep.agenda_item_id,
      'agenda_title',   rep.agenda_title,
      'agenda_date',    rep.agenda_date,
      'slideshow_url',  rep.slideshow_url,
      'published_at',   rep.published_at,
      'items',          rep.items
    ) order by rep.agenda_date
  ), '[]'::jsonb) into v_reports
  from (
    select
      r.agenda_item_id,
      a.title  as agenda_title,
      a.date   as agenda_date,
      r.slideshow_url,
      r.published_at,
      coalesce(jsonb_agg(
        jsonb_build_object(
          'id',         ci.id,
          'type',       ci.type,
          'media_url',  ci.media_url,
          'caption',    ci.caption,
          'author_name',       m.name,
          'author_avatar_url', m.avatar_url
        ) order by item.sort_order
      ) filter (where ci.id is not null), '[]'::jsonb) as items
    from public.daily_reports r
    join public.agenda_items a on a.id = r.agenda_item_id
    left join public.report_items item on item.report_id = r.id
    left join public.content_items ci  on ci.id = item.content_item_id
    left join public.members m         on m.id  = ci.author_id
    where r.event_id = v_event.id
      and r.status = 'published'
    group by r.id, r.agenda_item_id, a.title, a.date, r.slideshow_url, r.published_at
  ) rep;

  return jsonb_build_object(
    'ok', true,
    'event', jsonb_build_object(
      'id',             v_event.id,
      'name',           v_event.name,
      'description',    v_event.description,
      'start_date',     v_event.start_date,
      'end_date',       v_event.end_date,
      'cover_url',      v_event.cover_url,
      'cover_position', v_event.cover_position,
      'cover_scale',    v_event.cover_scale,
      'slug',           v_event.slug,
      'member_count',   v_member_count
    ),
    'agenda',  v_agenda,
    'reports', v_reports
  );
end;
$fn_pe$;

-- ---------------------------------------------------------------------------
-- Verification (run manually after applying):
--
--   select public.get_public_event('hong-kong-april-2026');
--                                                  -- expect: jsonb with ok=true
-- ---------------------------------------------------------------------------
