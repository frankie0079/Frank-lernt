-- PROJ-34: Slideshow-Generierung & WhatsApp-/Instagram-Export
--
-- Adds:
--   1. event_settings table (slideshow defaults per event)
--   2. daily_reports columns: storyboard, slideshow_url,
--      slideshow_published_at, slideshow_duration_sec
--   3. SECURITY DEFINER RPCs for storyboard save/get,
--      publish/unpublish-slideshow, list-published-slideshows
--   4. event_settings get/set RPCs
--
-- Storage bucket `slideshows` is created in this migration as well.
--
-- Apply via Supabase SQL editor.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Table: event_settings
-- ----------------------------------------------------------------------------
create table if not exists public.event_settings (
  event_id                       uuid primary key references public.events(id) on delete cascade,
  slideshow_format               text not null default 'portrait'
                                  check (slideshow_format in ('portrait', 'landscape')),
  slideshow_music_mood           text not null default 'auto'
                                  check (slideshow_music_mood in ('auto','epic','chill','joyful','reflective')),
  slideshow_photo_duration_sec   int  not null default 3
                                  check (slideshow_photo_duration_sec between 1 and 8),
  updated_at                     timestamptz not null default now()
);

alter table public.event_settings enable row level security;
revoke all on public.event_settings from anon;
revoke all on public.event_settings from authenticated;
grant all on public.event_settings to service_role;

-- ----------------------------------------------------------------------------
-- 2. Add columns to daily_reports
-- ----------------------------------------------------------------------------
alter table public.daily_reports
  add column if not exists storyboard               jsonb,
  add column if not exists slideshow_url            text,
  add column if not exists slideshow_published_at   timestamptz,
  add column if not exists slideshow_duration_sec   int;

create index if not exists daily_reports_slideshow_published_idx
  on public.daily_reports (event_id, slideshow_published_at desc)
  where slideshow_published_at is not null;

-- ----------------------------------------------------------------------------
-- 3. Storage bucket: slideshows
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'slideshows',
  'slideshows',
  true,
  52428800, -- 50 MB
  array['video/webm', 'video/mp4', 'application/zip']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Public read, member upload via signed RPC (we use authenticated client-side
-- upload restricted to file paths starting with their event_id; the API enforces
-- the membership check before issuing an upload).
drop policy if exists "slideshows_public_read" on storage.objects;
create policy "slideshows_public_read"
  on storage.objects for select
  using (bucket_id = 'slideshows');

drop policy if exists "slideshows_member_upload" on storage.objects;
create policy "slideshows_member_upload"
  on storage.objects for insert
  with check (bucket_id = 'slideshows');

drop policy if exists "slideshows_member_update" on storage.objects;
create policy "slideshows_member_update"
  on storage.objects for update
  using (bucket_id = 'slideshows');

-- ----------------------------------------------------------------------------
-- 4. RPC: get_event_settings
-- ----------------------------------------------------------------------------
create or replace function public.get_event_settings(
  p_token text,
  p_event_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $fn_get_settings$
declare
  v_member_id uuid;
  v_org       uuid;
  v_settings  public.event_settings;
begin
  v_member_id := public.member_from_token(p_token);
  if v_member_id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  select organizer_id into v_org from public.events where id = p_event_id;
  if v_org is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_org <> v_member_id and not exists (
    select 1 from public.event_members
    where event_id = p_event_id and member_id = v_member_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  select * into v_settings from public.event_settings where event_id = p_event_id;
  if v_settings.event_id is null then
    -- Defaults
    return jsonb_build_object(
      'ok', true,
      'settings', jsonb_build_object(
        'event_id', p_event_id,
        'slideshow_format', 'portrait',
        'slideshow_music_mood', 'auto',
        'slideshow_photo_duration_sec', 3
      )
    );
  end if;

  return jsonb_build_object('ok', true, 'settings', to_jsonb(v_settings));
end;
$fn_get_settings$;

-- ----------------------------------------------------------------------------
-- 5. RPC: set_event_settings (organizer only)
-- ----------------------------------------------------------------------------
create or replace function public.set_event_settings(
  p_token text,
  p_event_id uuid,
  p_format text,
  p_music_mood text,
  p_photo_duration_sec int
) returns jsonb
language plpgsql
security definer
set search_path = public
as $fn_set_settings$
declare
  v_member_id uuid;
  v_org       uuid;
  v_settings  public.event_settings;
begin
  v_member_id := public.member_from_token(p_token);
  if v_member_id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  select organizer_id into v_org from public.events where id = p_event_id;
  if v_org is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_org <> v_member_id then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  if p_format not in ('portrait','landscape') then
    return jsonb_build_object('ok', false, 'error', 'invalid_payload');
  end if;
  if p_music_mood not in ('auto','epic','chill','joyful','reflective') then
    return jsonb_build_object('ok', false, 'error', 'invalid_payload');
  end if;
  if p_photo_duration_sec < 1 or p_photo_duration_sec > 8 then
    return jsonb_build_object('ok', false, 'error', 'invalid_payload');
  end if;

  insert into public.event_settings (
    event_id, slideshow_format, slideshow_music_mood, slideshow_photo_duration_sec, updated_at
  ) values (
    p_event_id, p_format, p_music_mood, p_photo_duration_sec, now()
  )
  on conflict (event_id) do update
    set slideshow_format             = excluded.slideshow_format,
        slideshow_music_mood         = excluded.slideshow_music_mood,
        slideshow_photo_duration_sec = excluded.slideshow_photo_duration_sec,
        updated_at                   = now()
  returning * into v_settings;

  return jsonb_build_object('ok', true, 'settings', to_jsonb(v_settings));
end;
$fn_set_settings$;

-- ----------------------------------------------------------------------------
-- 6. RPC: storyboard input — collects all data the LLM needs
--    (curated content_items + comments + author info, scoped to one report)
-- ----------------------------------------------------------------------------
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
      'description', v_event.description
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

-- ----------------------------------------------------------------------------
-- 7. RPC: save_report_storyboard — admin persists LLM output
-- ----------------------------------------------------------------------------
create or replace function public.save_report_storyboard(
  p_token text,
  p_agenda_item_id uuid,
  p_storyboard jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $fn_sb_save$
declare
  v_member_id uuid;
  v_report    public.daily_reports;
begin
  v_member_id := public.member_from_token(p_token);
  if v_member_id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  if not public.member_can_curate_report(v_member_id, p_agenda_item_id) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  if jsonb_typeof(p_storyboard) <> 'object' then
    return jsonb_build_object('ok', false, 'error', 'invalid_payload');
  end if;

  update public.daily_reports
  set storyboard = p_storyboard,
      updated_at = now()
  where agenda_item_id = p_agenda_item_id
  returning * into v_report;

  if v_report.id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  return jsonb_build_object('ok', true, 'report', to_jsonb(v_report));
end;
$fn_sb_save$;

-- ----------------------------------------------------------------------------
-- 8. RPC: publish_slideshow — sets slideshow_url + published_at
-- ----------------------------------------------------------------------------
create or replace function public.publish_slideshow(
  p_token text,
  p_agenda_item_id uuid,
  p_slideshow_url text,
  p_duration_sec int
) returns jsonb
language plpgsql
security definer
set search_path = public
as $fn_sb_pub$
declare
  v_member_id uuid;
  v_report    public.daily_reports;
begin
  v_member_id := public.member_from_token(p_token);
  if v_member_id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  if not public.member_can_curate_report(v_member_id, p_agenda_item_id) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  if p_slideshow_url is null or length(p_slideshow_url) = 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_payload');
  end if;

  update public.daily_reports
  set slideshow_url           = p_slideshow_url,
      slideshow_duration_sec  = p_duration_sec,
      slideshow_published_at  = now(),
      updated_at              = now()
  where agenda_item_id = p_agenda_item_id
  returning * into v_report;

  if v_report.id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  return jsonb_build_object('ok', true, 'report', to_jsonb(v_report));
end;
$fn_sb_pub$;

-- ----------------------------------------------------------------------------
-- 9. RPC: unpublish_slideshow
-- ----------------------------------------------------------------------------
create or replace function public.unpublish_slideshow(
  p_token text,
  p_agenda_item_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $fn_sb_unpub$
declare
  v_member_id uuid;
  v_report    public.daily_reports;
begin
  v_member_id := public.member_from_token(p_token);
  if v_member_id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  if not public.member_can_curate_report(v_member_id, p_agenda_item_id) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  update public.daily_reports
  set slideshow_published_at = null,
      updated_at             = now()
  where agenda_item_id = p_agenda_item_id
  returning * into v_report;

  if v_report.id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  return jsonb_build_object('ok', true, 'report', to_jsonb(v_report));
end;
$fn_sb_unpub$;

-- ----------------------------------------------------------------------------
-- 10. RPC: list_event_slideshows — for the public/event-feed of films
-- ----------------------------------------------------------------------------
create or replace function public.list_event_slideshows(
  p_token text,
  p_event_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $fn_sb_list$
declare
  v_member_id uuid;
  v_org       uuid;
  v_rows      jsonb;
begin
  v_member_id := public.member_from_token(p_token);
  if v_member_id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  select organizer_id into v_org from public.events where id = p_event_id;
  if v_org is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_org <> v_member_id and not exists (
    select 1 from public.event_members
    where event_id = p_event_id and member_id = v_member_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  select coalesce(jsonb_agg(s order by s.published_at desc), '[]'::jsonb)
  into v_rows
  from (
    select
      a.id                            as agenda_item_id,
      a.title                         as agenda_title,
      a.date                          as agenda_date,
      r.id                            as report_id,
      r.slideshow_url,
      r.slideshow_published_at        as published_at,
      r.slideshow_duration_sec        as duration_sec,
      coalesce(r.storyboard->>'title', a.title) as title
    from public.daily_reports r
    join public.agenda_items a on a.id = r.agenda_item_id
    where r.event_id = p_event_id
      and r.slideshow_published_at is not null
      and r.slideshow_url is not null
  ) s;

  return jsonb_build_object('ok', true, 'slideshows', v_rows);
end;
$fn_sb_list$;

-- ----------------------------------------------------------------------------
-- 11. Grants
-- ----------------------------------------------------------------------------
grant execute on function public.get_event_settings(text, uuid)                          to anon, authenticated, service_role;
grant execute on function public.set_event_settings(text, uuid, text, text, int)         to anon, authenticated, service_role;
grant execute on function public.get_report_storyboard_input(text, uuid)                 to anon, authenticated, service_role;
grant execute on function public.save_report_storyboard(text, uuid, jsonb)               to anon, authenticated, service_role;
grant execute on function public.publish_slideshow(text, uuid, text, int)                to anon, authenticated, service_role;
grant execute on function public.unpublish_slideshow(text, uuid)                         to anon, authenticated, service_role;
grant execute on function public.list_event_slideshows(text, uuid)                       to anon, authenticated, service_role;
