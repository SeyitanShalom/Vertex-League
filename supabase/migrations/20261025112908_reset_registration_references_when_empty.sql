begin;

set local lock_timeout = '5s';
-- Use the same table-before-advisory lock order as creation, deletion and TRUNCATE.
lock table public.registrations in access exclusive mode;
do $$ begin
  perform pg_advisory_xact_lock(hashtextextended('vertex:registration-references',0));
end $$;

-- Serialize reference allocation with cleanup, including both competition modes.
create or replace function public.create_team_registration(p_mode text,p_data jsonb,p_submission_key uuid,p_token_hash text,p_payload_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.competition_settings; r public.registrations; v_team uuid; v_reference text; v_number text;
begin
  lock table public.registrations in row exclusive mode;
  perform pg_advisory_xact_lock(hashtextextended('vertex:registration-references',0));
  perform pg_advisory_xact_lock(hashtextextended('vertex:create:'||p_mode,0));
  select * into r from public.registrations where submission_key=p_submission_key;
  if found then
    if r.status_token_hash<>p_token_hash or r.payload_hash<>p_payload_hash or r.mode<>p_mode then raise exception 'duplicate_submission'; end if;
    return jsonb_build_object('id',r.id,'reference',r.registration_reference,'team_id',r.team_id);
  end if;
  select * into s from public.competition_settings where mode=p_mode for update;
  if not found or not s.registration_enabled then raise exception 'registration_closed'; end if;
  if s.registration_deadline is not null and now()>=s.registration_deadline then raise exception 'deadline_passed'; end if;
  if s.maximum_teams is not null and (select count(*) from public.registrations reg join public.payments pay on pay.registration_id=reg.id and pay.is_current and pay.payment_status='confirmed' where reg.mode=p_mode and reg.registration_status in ('awaiting_screening','approved','correction_required') and reg.refund_status='none')>=s.maximum_teams then raise exception 'capacity_reached'; end if;
  insert into public.teams(mode,team_name,manager_name,phone,whatsapp_number,email,location,additional_information)
  values(p_mode,p_data->>'team_name',p_data->>'manager_name',p_data->>'phone',p_data->>'whatsapp_number',nullif(p_data->>'email',''),p_data->>'location',nullif(p_data->>'additional_information','')) returning id into v_team;
  insert into public.manager_contacts(mode,phone,team_id)
    select p_mode,n,v_team from (select distinct unnest(array[p_data->>'phone',p_data->>'whatsapp_number']) n) contacts;
  v_number := nextval('public.registration_reference_seq')::text;
  v_reference := s.reference_prefix||'-'||s.reference_year||'-'||lpad(v_number,greatest(length(v_number),6),'0');
  insert into public.registrations(mode,team_id,registration_reference,submission_key,payload_hash,status_token_hash,registration_fee)
    values(p_mode,v_team,v_reference,p_submission_key,p_payload_hash,p_token_hash,s.registration_fee) returning * into r;
  insert into public.payments(registration_id,amount) values(r.id,s.registration_fee);
  insert into public.admin_audit_logs(registration_id,action,new_value) values(r.id,'registration_submitted',jsonb_build_object('mode',p_mode));
  return jsonb_build_object('id',r.id,'reference',v_reference,'team_id',v_team);
end $$;

-- Acquire the reference lock before touching the dependent test records.
create or replace function public.delete_test_registration(p_id uuid, p_reference text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_registration public.registrations;
  v_team public.teams;
begin
  if not public.is_vertex_admin() then raise exception 'access_denied'; end if;
  lock table public.registrations in row exclusive mode;
  perform pg_advisory_xact_lock(hashtextextended('vertex:registration-references',0));

  select * into v_registration from public.registrations
    where id = p_id and mode = 'test' and registration_reference = p_reference
    for update;
  if not found then raise exception 'registration_not_found'; end if;

  select * into v_team from public.teams where id = v_registration.team_id for update;
  if not found or v_team.mode <> 'test' or v_team.logo_path is not null
    or v_registration.registration_status <> 'submitted'
    or v_registration.refund_status <> 'none'
    or v_registration.approved_at is not null
    or v_registration.rejected_at is not null
    or v_registration.screening_passed_at is not null
    or (select count(*) from public.payments where registration_id = p_id) <> 1
    or exists (select 1 from public.payments
      where registration_id = p_id
        and (payment_status <> 'pending' or verified_at is not null or verified_by is not null))
    or exists (select 1 from public.refunds where registration_id = p_id)
    or exists (select 1 from public.admin_audit_logs
      where registration_id = p_id and action <> 'registration_submitted')
  then raise exception 'test_deletion_not_allowed'; end if;

  delete from public.admin_audit_logs where registration_id = p_id;
  delete from public.payments where registration_id = p_id;
  delete from public.manager_contacts where team_id = v_team.id;
  delete from public.registrations where id = p_id;
  delete from public.teams where id = v_team.id;

  insert into public.admin_audit_logs(admin_id, action, new_value, reason)
    values (auth.uid(), 'test_registration_deleted',
      jsonb_build_object('reference', v_registration.registration_reference),
      'Organizer confirmed no payment was received');
end $$;

-- This trigger helper is private and cannot be called through the public Data API.
create schema if not exists vertex_private;
revoke all on schema vertex_private from public, anon, authenticated;

create or replace function vertex_private.reset_empty_registration_references()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('vertex:registration-references',0));
  if not exists (select 1 from public.registrations) then
    -- A fixed older snapshot could miss a concurrently committed registration.
    if TG_OP = 'DELETE' and current_setting('transaction_isolation') <> 'read committed' then
      raise exception 'reference_reset_requires_read_committed' using errcode = '25001';
    end if;
    -- Transactional RESTART is rolled back if the deletion is rolled back.
    alter sequence public.registration_reference_seq restart with 1;
  end if;
  return null;
end $$;

revoke all on function vertex_private.reset_empty_registration_references()
  from public, anon, authenticated, service_role;

drop trigger if exists reset_empty_registration_references on public.registrations;
create trigger reset_empty_registration_references
  after delete or truncate on public.registrations
  for each statement execute function vertex_private.reset_empty_registration_references();

-- Apply the same rule to the empty database left by the authorized test cleanup.
do $$ begin
  if not exists (select 1 from public.registrations) then
    alter sequence public.registration_reference_seq restart with 1;
  end if;
end $$;

commit;
