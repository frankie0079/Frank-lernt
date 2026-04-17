-- Add cover_position column to events table.
-- Stores CSS object-position value (e.g. "50% 30%") for cover photo cropping.
-- Default "center" = CSS default behavior (same as before).

alter table public.events
  add column if not exists cover_position text default 'center';

-- Update get_public_event RPC to include cover_position in its output.
-- (CREATE OR REPLACE — safe to re-run.)
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
          'transcript', ci.transcript,
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
      'slug',           v_event.slug,
      'member_count',   v_member_count
    ),
    'agenda',  v_agenda,
    'reports', v_reports
  );
end;
$fn_pe$;
