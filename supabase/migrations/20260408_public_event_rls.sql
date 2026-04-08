-- PROJ-35: Public Event Page (/e/[slug])
--
-- Provides a single SECURITY DEFINER RPC `get_public_event(p_slug)` that
-- returns everything the public landing page needs:
--   - event (id, name, description, dates, cover_url, slug, member_count)
--   - agenda items (id, date, title)
--   - published daily_reports (with slideshow_url, published_at)
--   - report_items joined to content_items (curated photos/videos/text/audio)
--   - author info for each content item (name + avatar_url ONLY — no tokens)
--
-- Why an RPC instead of opening RLS per table?
--   - daily_reports / report_items are revoked from anon (PROJ-33 lockdown).
--   - members.token must NEVER leak to anon.
--   - One RPC keeps the public surface area minimal and explicit.
--   - The `published` filter is enforced inside the function, not in client code.
--
-- Apply via Supabase SQL editor.
-- ============================================================================

create or replace function public.get_public_event(
  p_slug text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $fn_pe$
declare
  v_event        public.events;
  v_member_count int;
  v_agenda       jsonb;
  v_reports      jsonb;
begin
  if p_slug is null or length(p_slug) = 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_payload');
  end if;

  select * into v_event from public.events where slug = p_slug;
  if v_event.id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  select count(*)::int into v_member_count
  from public.event_members
  where event_id = v_event.id;

  -- Agenda items (only those that have published reports — keeps payload tiny
  -- AND ensures we never expose draft-day titles).
  select coalesce(jsonb_agg(a order by a.date asc, a.sort_order asc), '[]'::jsonb)
  into v_agenda
  from (
    select ai.id, ai.date, ai.title, ai.sort_order
    from public.agenda_items ai
    where ai.event_id = v_event.id
      and exists (
        select 1 from public.daily_reports dr
        where dr.agenda_item_id = ai.id
          and dr.status = 'published'
      )
  ) a;

  -- Published reports + curated items
  select coalesce(jsonb_agg(rep order by rep.agenda_date asc, rep.agenda_sort asc), '[]'::jsonb)
  into v_reports
  from (
    select
      r.id                           as report_id,
      r.agenda_item_id,
      a.title                        as agenda_title,
      a.date                         as agenda_date,
      a.sort_order                   as agenda_sort,
      r.slideshow_url,
      r.slideshow_published_at,
      r.slideshow_duration_sec,
      r.published_at,
      coalesce((
        select jsonb_agg(item order by item.sort_order asc)
        from (
          select
            ri.sort_order,
            c.id            as content_item_id,
            c.type,
            c.media_url,
            c.thumbnail_url,
            c.caption,
            c.latitude,
            c.longitude,
            c.created_at,
            m.id            as author_id,
            m.name          as author_name,
            m.avatar_url    as author_avatar_url
          from public.report_items ri
          join public.content_items c on c.id = ri.content_item_id
          left join public.members m on m.id = c.author_id
          where ri.report_id = r.id
        ) item
      ), '[]'::jsonb) as items
    from public.daily_reports r
    join public.agenda_items a on a.id = r.agenda_item_id
    where r.event_id = v_event.id
      and r.status = 'published'
  ) rep;

  return jsonb_build_object(
    'ok', true,
    'event', jsonb_build_object(
      'id',          v_event.id,
      'name',        v_event.name,
      'description', v_event.description,
      'start_date',  v_event.start_date,
      'end_date',    v_event.end_date,
      'cover_url',   v_event.cover_url,
      'slug',        v_event.slug,
      'member_count', v_member_count
    ),
    'agenda',  v_agenda,
    'reports', v_reports
  );
end;
$fn_pe$;

grant execute on function public.get_public_event(text) to anon, authenticated, service_role;
