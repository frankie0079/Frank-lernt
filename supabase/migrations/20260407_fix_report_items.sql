-- PROJ-33 QA Round 2 fixes
--
-- BUG-3: report_items.content_item_id was ON DELETE RESTRICT, which blocked
--   deletion of content while still referenced in a report. Tech design said
--   deleted content should leave a "deleted" placeholder tile. We make the
--   column nullable and set the FK to ON DELETE SET NULL, then update the
--   save_report_items RPC so that null-marker rows PERSIST across saves.
--
-- BUG-5: list_event_reports used a subquery alias called `row` and then
--   referenced `row.date` inside jsonb_agg(... order by ...), which is risky
--   because `row` is a reserved-ish record keyword in plpgsql/SQL. Renamed
--   the alias to `r_agg`.
--
-- Apply via Supabase SQL editor.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Schema: nullable content_item_id + ON DELETE SET NULL
-- ----------------------------------------------------------------------------
alter table public.report_items
  alter column content_item_id drop not null;

alter table public.report_items
  drop constraint if exists report_items_content_item_id_fkey;

alter table public.report_items
  add constraint report_items_content_item_id_fkey
  foreign key (content_item_id)
  references public.content_items(id)
  on delete set null;

-- ----------------------------------------------------------------------------
-- 2. save_report_items v2 — preserves null-marker rows across saves
-- ----------------------------------------------------------------------------
create or replace function public.save_report_items(
  p_token text,
  p_agenda_item_id uuid,
  p_items jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $fn_save_v2$
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

  -- Replace live rows but PRESERVE null-marker "deleted" rows.
  delete from public.report_items
  where report_id = v_report.id
    and content_item_id is not null;

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
$fn_save_v2$;

-- ----------------------------------------------------------------------------
-- 3. list_event_reports v2 — renamed subquery alias `row` -> `r_agg`
-- ----------------------------------------------------------------------------
create or replace function public.list_event_reports(
  p_token text,
  p_event_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $fn_list_v2$
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

  select coalesce(
    jsonb_agg(to_jsonb(r_agg) order by r_agg.date asc, r_agg.sort_order asc),
    '[]'::jsonb
  )
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
  ) r_agg;

  return jsonb_build_object('ok', true, 'reports', v_rows);
end;
$fn_list_v2$;

grant execute on function public.save_report_items(text, uuid, jsonb)   to anon, authenticated, service_role;
grant execute on function public.list_event_reports(text, uuid)         to anon, authenticated, service_role;
