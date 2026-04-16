-- Add cover_url to get_report_storyboard_input return payload.
-- Needed so the slideshow renderer can draw a dedicated intro cover scene
-- with the event's cover photo (PROJ-34 title animation).

create or replace function public.get_report_storyboard_input(
  p_token text,
  p_agenda_item_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $fn_sb_in$
declare
  v_member_id uuid;
  v_event_id  uuid;
  v_event     public.events;
  v_agenda    public.agenda_items;
  v_report    public.daily_reports;
  v_items     jsonb;
begin
  v_member_id := public.member_from_token(p_token);
  if v_member_id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  select * into v_agenda from public.agenda_items where id = p_agenda_item_id;
  if v_agenda.id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  v_event_id := v_agenda.event_id;

  if not public.member_can_curate_report(v_member_id, p_agenda_item_id) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  select * into v_event from public.events where id = v_event_id;
  select * into v_report from public.daily_reports where agenda_item_id = p_agenda_item_id;
  if v_report.id is null then
    return jsonb_build_object('ok', false, 'error', 'no_report');
  end if;

  select coalesce(jsonb_agg(item order by item.sort_order asc), '[]'::jsonb)
  into v_items
  from (
    select
      ri.sort_order,
      c.id              as content_item_id,
      c.type,
      c.media_url,
      c.thumbnail_url,
      c.caption,
      c.created_at,
      m.id              as author_id,
      m.name            as author_name,
      m.avatar_url      as author_avatar_url,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'author', cm.name,
          'text',   co.text
        ) order by co.created_at asc)
        from public.comments co
        left join public.members cm on cm.id = co.author_id
        where co.content_item_id = c.id
      ), '[]'::jsonb) as comments
    from public.report_items ri
    join public.content_items c on c.id = ri.content_item_id
    left join public.members m on m.id = c.author_id
    where ri.report_id = v_report.id
  ) item;

  return jsonb_build_object(
    'ok', true,
    'event', jsonb_build_object(
      'id',          v_event.id,
      'name',        v_event.name,
      'description', v_event.description,
      'cover_url',   v_event.cover_url
    ),
    'agenda_item', jsonb_build_object(
      'id',    v_agenda.id,
      'title', v_agenda.title,
      'date',  v_agenda.date
    ),
    'report_id',         v_report.id,
    'existing_storyboard', v_report.storyboard,
    'items', v_items
  );
end;
$fn_sb_in$;
