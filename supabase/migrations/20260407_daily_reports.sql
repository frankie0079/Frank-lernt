-- PROJ-33: Tages-Admin Kurations-Workflow
--
-- Adds `daily_reports` and `report_items` tables plus SECURITY DEFINER RPCs
-- that authenticate via the member token cookie value (passed by API routes).
-- Direct PostgREST writes are revoked for anon/authenticated; the API routes
-- call the RPCs server-side, mirroring the locked-down architecture
-- introduced in 20260407_secure_comments_and_reactions.sql.
--
-- Apply via Supabase SQL editor.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tables
-- ----------------------------------------------------------------------------
create table if not exists public.daily_reports (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references public.events(id) on delete cascade,
  agenda_item_id  uuid not null unique references public.agenda_items(id) on delete cascade,
  status          text not null default 'draft' check (status in ('draft','published')),
  published_at    timestamptz,
  created_by      uuid references public.members(id) on delete set null,
  updated_at      timestamptz not null default now()
);

create index if not exists daily_reports_event_id_idx on public.daily_reports (event_id);
create index if not exists daily_reports_agenda_item_id_idx on public.daily_reports (agenda_item_id);
create index if not exists daily_reports_status_idx on public.daily_reports (status);

create table if not exists public.report_items (
  id               uuid primary key default gen_random_uuid(),
  report_id        uuid not null references public.daily_reports(id) on delete cascade,
  content_item_id  uuid not null references public.content_items(id) on delete restrict,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now(),
  unique (report_id, content_item_id)
);

create index if not exists report_items_report_id_idx on public.report_items (report_id);
create index if not exists report_items_content_item_id_idx on public.report_items (content_item_id);
create index if not exists report_items_sort_idx on public.report_items (report_id, sort_order);

-- ----------------------------------------------------------------------------
-- 2. RLS — enabled but writes only via SECURITY DEFINER RPCs
-- ----------------------------------------------------------------------------
alter table public.daily_reports enable row level security;
alter table public.report_items  enable row level security;

-- Closed-by-default: no policy means no access for anon/authenticated.
-- (We deliberately do NOT add permissive policies. Direct PostgREST access
-- is blocked. RPCs use SECURITY DEFINER to bypass RLS.)

revoke all on public.daily_reports from anon;
revoke all on public.daily_reports from authenticated;
revoke all on public.report_items  from anon;
revoke all on public.report_items  from authenticated;
grant all on public.daily_reports to service_role;
grant all on public.report_items  to service_role;

-- ----------------------------------------------------------------------------
-- 3. Helper: is the given member admin of agenda item or organizer of event?
-- ----------------------------------------------------------------------------
create or replace function public.member_can_curate_report(
  p_member_id uuid,
  p_agenda_item_id uuid
) returns boolean
language plpgsql
security definer
set search_path = public
as $fn_curate$
declare
  v_event_id uuid;
  v_admin    uuid;
  v_org      uuid;
begin
  select event_id, admin_member_id into v_event_id, v_admin
  from public.agenda_items
  where id = p_agenda_item_id;
  if v_event_id is null then
    return false;
  end if;
  if v_admin = p_member_id then
    return true;
  end if;
  select organizer_id into v_org from public.events where id = v_event_id;
  if v_org = p_member_id then
    return true;
  end if;
  return false;
end;
$fn_curate$;

-- ----------------------------------------------------------------------------
-- 4. RPC: list reports for organizer overview
-- ----------------------------------------------------------------------------
create or replace function public.list_event_reports(
  p_token text,
  p_event_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $fn_list$
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

  -- Allowed: organizer OR any agenda admin of this event OR member of event
  if v_org <> v_member_id and not exists (
    select 1 from public.event_members
    where event_id = p_event_id and member_id = v_member_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  select coalesce(jsonb_agg(row order by row.date asc, row.sort_order asc), '[]'::jsonb)
  into v_rows
  from (
    select
      a.id           as agenda_item_id,
      a.title,
      a.date,
      a.sort_order,
      a.admin_member_id,
      m.name         as admin_name,
      r.id           as report_id,
      coalesce(r.status, 'empty') as status,
      r.published_at,
      r.updated_at,
      coalesce((
        select count(*) from public.report_items ri where ri.report_id = r.id
      ), 0) as item_count
    from public.agenda_items a
    left join public.daily_reports r on r.agenda_item_id = a.id
    left join public.members m on m.id = a.admin_member_id
    where a.event_id = p_event_id
  ) row;

  return jsonb_build_object('ok', true, 'reports', v_rows);
end;
$fn_list$;

-- ----------------------------------------------------------------------------
-- 5. RPC: get one report (auto-creates draft if missing)
-- ----------------------------------------------------------------------------
create or replace function public.get_report(
  p_token text,
  p_agenda_item_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $fn_get$
declare
  v_member_id uuid;
  v_event_id  uuid;
  v_report    public.daily_reports;
  v_items     jsonb;
begin
  v_member_id := public.member_from_token(p_token);
  if v_member_id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  select event_id into v_event_id from public.agenda_items where id = p_agenda_item_id;
  if v_event_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if not public.member_can_curate_report(v_member_id, p_agenda_item_id) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  select * into v_report from public.daily_reports where agenda_item_id = p_agenda_item_id;
  if v_report.id is null then
    insert into public.daily_reports (event_id, agenda_item_id, status, created_by, updated_at)
    values (v_event_id, p_agenda_item_id, 'draft', v_member_id, now())
    returning * into v_report;
  end if;

  select coalesce(jsonb_agg(row order by row.sort_order asc), '[]'::jsonb)
  into v_items
  from (
    select
      ri.id,
      ri.content_item_id,
      ri.sort_order,
      case when c.id is null then true else false end as deleted,
      c.type,
      c.media_url,
      c.thumbnail_url,
      c.caption,
      c.created_at as content_created_at,
      c.author_id,
      m.name       as author_name,
      m.avatar_url as author_avatar_url
    from public.report_items ri
    left join public.content_items c on c.id = ri.content_item_id
    left join public.members m       on m.id = c.author_id
    where ri.report_id = v_report.id
  ) row;

  return jsonb_build_object(
    'ok', true,
    'report', to_jsonb(v_report),
    'items',  v_items
  );
end;
$fn_get$;

-- ----------------------------------------------------------------------------
-- 6. RPC: bulk save items (PUT) — replaces selection + order
--    Re-publishing rule: if status was 'published', auto-revert to 'draft'.
-- ----------------------------------------------------------------------------
create or replace function public.save_report_items(
  p_token text,
  p_agenda_item_id uuid,
  p_items jsonb -- [{ "content_item_id": "...", "sort_order": 10 }, ...]
) returns jsonb
language plpgsql
security definer
set search_path = public
as $fn_save$
declare
  v_member_id uuid;
  v_event_id  uuid;
  v_report    public.daily_reports;
  v_item      jsonb;
  v_cid       uuid;
  v_count     int := 0;
begin
  v_member_id := public.member_from_token(p_token);
  if v_member_id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  select event_id into v_event_id from public.agenda_items where id = p_agenda_item_id;
  if v_event_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if not public.member_can_curate_report(v_member_id, p_agenda_item_id) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  if jsonb_typeof(p_items) <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'invalid_payload');
  end if;

  -- Get-or-create draft
  select * into v_report from public.daily_reports where agenda_item_id = p_agenda_item_id;
  if v_report.id is null then
    insert into public.daily_reports (event_id, agenda_item_id, status, created_by, updated_at)
    values (v_event_id, p_agenda_item_id, 'draft', v_member_id, now())
    returning * into v_report;
  end if;

  -- Validate every content_item_id belongs to the same event
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_cid := (v_item->>'content_item_id')::uuid;
    if v_cid is null then
      return jsonb_build_object('ok', false, 'error', 'invalid_item');
    end if;
    if not exists (
      select 1 from public.content_items
      where id = v_cid and event_id = v_event_id
    ) then
      return jsonb_build_object('ok', false, 'error', 'content_not_in_event');
    end if;
    v_count := v_count + 1;
  end loop;

  -- Replace strategy: delete all then insert. Simpler and correct for bulk save.
  delete from public.report_items where report_id = v_report.id;

  insert into public.report_items (report_id, content_item_id, sort_order)
  select
    v_report.id,
    (elem->>'content_item_id')::uuid,
    coalesce((elem->>'sort_order')::int, 0)
  from jsonb_array_elements(p_items) as elem;

  -- Editing a published report demotes it back to draft
  update public.daily_reports
  set
    status       = case when status = 'published' then 'draft' else status end,
    published_at = case when status = 'published' then null else published_at end,
    updated_at   = now()
  where id = v_report.id
  returning * into v_report;

  return jsonb_build_object(
    'ok', true,
    'report', to_jsonb(v_report),
    'item_count', v_count
  );
end;
$fn_save$;

-- ----------------------------------------------------------------------------
-- 7. RPC: publish toggle
-- ----------------------------------------------------------------------------
create or replace function public.toggle_report_publish(
  p_token text,
  p_agenda_item_id uuid,
  p_publish boolean
) returns jsonb
language plpgsql
security definer
set search_path = public
as $fn_pub$
declare
  v_member_id uuid;
  v_report    public.daily_reports;
  v_count     int;
begin
  v_member_id := public.member_from_token(p_token);
  if v_member_id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  if not public.member_can_curate_report(v_member_id, p_agenda_item_id) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  select * into v_report from public.daily_reports where agenda_item_id = p_agenda_item_id;
  if v_report.id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if p_publish then
    select count(*) into v_count from public.report_items where report_id = v_report.id;
    if v_count = 0 then
      return jsonb_build_object('ok', false, 'error', 'no_items');
    end if;
    update public.daily_reports
    set status = 'published', published_at = now(), updated_at = now()
    where id = v_report.id
    returning * into v_report;
  else
    update public.daily_reports
    set status = 'draft', published_at = null, updated_at = now()
    where id = v_report.id
    returning * into v_report;
  end if;

  return jsonb_build_object('ok', true, 'report', to_jsonb(v_report));
end;
$fn_pub$;

-- ----------------------------------------------------------------------------
-- 8. Grants
-- ----------------------------------------------------------------------------
grant execute on function public.member_can_curate_report(uuid, uuid)        to anon, authenticated, service_role;
grant execute on function public.list_event_reports(text, uuid)              to anon, authenticated, service_role;
grant execute on function public.get_report(text, uuid)                      to anon, authenticated, service_role;
grant execute on function public.save_report_items(text, uuid, jsonb)        to anon, authenticated, service_role;
grant execute on function public.toggle_report_publish(text, uuid, boolean)  to anon, authenticated, service_role;
