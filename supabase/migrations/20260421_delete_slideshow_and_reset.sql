-- PROJ-34 (2026-04-21): "Löschen"-Button im Kurations-Workflow.
--
-- Setzt den kompletten Slideshow-Zustand für einen Tag zurück:
--   - slideshow_url        = null
--   - slideshow_published_at = null
--   - slideshow_duration_sec = null
--   - storyboard           = null
--   - report_items-Zeilen werden gelöscht (Foto-Auswahl geht zurück auf leer)
--
-- Storage-Objekt (`slideshows/{event_id}/{agenda_item_id}.{mp4,webm}`) wird
-- vom Client nach erfolgreichem RPC entfernt — dazu braucht der Client die
-- Admin-Credentials, die der Server-Endpoint per Service-Role-Client setzt.
--
-- ============================================================================

create or replace function public.delete_slideshow_and_reset(
  p_token text,
  p_agenda_item_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $fn_del$
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

  select * into v_report from public.daily_reports where agenda_item_id = p_agenda_item_id;
  if v_report.id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  delete from public.report_items where report_id = v_report.id;

  update public.daily_reports
  set slideshow_url          = null,
      slideshow_published_at = null,
      slideshow_duration_sec = null,
      storyboard             = null,
      updated_at             = now()
  where id = v_report.id
  returning * into v_report;

  return jsonb_build_object(
    'ok', true,
    'report', to_jsonb(v_report),
    'previous_slideshow_url', v_report.slideshow_url -- always null post-update; client uses its own known url
  );
end;
$fn_del$;

revoke all on function public.delete_slideshow_and_reset(text, uuid) from public;
grant execute on function public.delete_slideshow_and_reset(text, uuid)
  to anon, authenticated, service_role;
