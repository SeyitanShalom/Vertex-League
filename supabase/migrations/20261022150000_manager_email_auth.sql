begin;

create or replace function public.save_manager_draft(p_mode text, p_user_id uuid, p_data jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' or not exists (
    select 1 from auth.users where id = p_user_id and email_confirmed_at is not null
  ) then raise exception 'access_denied'; end if;
  perform pg_advisory_xact_lock(hashtextextended('vertex:manager:'||p_mode||':'||p_user_id::text, 0));
  if exists (
    select 1 from public.registrations where mode = p_mode and manager_user_id = p_user_id
  ) then raise exception 'already_registered'; end if;
  insert into public.manager_registration_drafts(mode,user_id,form_data)
    values(p_mode,p_user_id,p_data)
    on conflict(mode,user_id) do update set form_data = excluded.form_data, updated_at = now();
end $$;

create or replace function public.create_manager_registration(
  p_mode text, p_data jsonb, p_submission_key uuid,
  p_token_hash text, p_payload_hash text, p_manager_user_id uuid
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_existing public.registrations; v_created jsonb;
begin
  if not exists (
    select 1 from auth.users
    where id = p_manager_user_id and email_confirmed_at is not null
      and lower(btrim(email)) = lower(btrim(p_data->>'email'))
  ) then raise exception 'access_denied'; end if;
  perform pg_advisory_xact_lock(hashtextextended('vertex:manager:'||p_mode||':'||p_manager_user_id::text, 0));
  select * into v_existing from public.registrations
    where mode = p_mode and manager_user_id = p_manager_user_id for update;
  if found then
    if v_existing.submission_key = p_submission_key and v_existing.payload_hash = p_payload_hash then
      return jsonb_build_object('id',v_existing.id,'reference',v_existing.registration_reference,'team_id',v_existing.team_id);
    end if;
    raise exception 'already_registered';
  end if;
  v_created := public.create_team_registration(p_mode,p_data,p_submission_key,p_token_hash,p_payload_hash);
  update public.registrations set manager_user_id = p_manager_user_id, updated_at = now()
    where id = (v_created->>'id')::uuid and manager_user_id is null;
  if not found then raise exception 'access_denied'; end if;
  delete from public.manager_registration_drafts
    where mode = p_mode and user_id = p_manager_user_id;
  return v_created;
end $$;

create or replace function public.claim_manager_registration(
  p_id uuid, p_token_hash text, p_manager_user_id uuid, p_revoked_token_hash text
) returns void
language plpgsql security definer set search_path = '' as $$
declare v_registration public.registrations; v_email text;
begin
  if p_revoked_token_hash !~ '^[a-f0-9]{64}$' or p_revoked_token_hash = p_token_hash then
    raise exception 'access_denied';
  end if;
  select lower(btrim(email)) into v_email from auth.users
    where id = p_manager_user_id and email_confirmed_at is not null;
  if v_email is null then raise exception 'access_denied'; end if;
  select * into v_registration from public.registrations
    where id = p_id and status_token_hash = p_token_hash and manager_user_id is null
    for update;
  if not found or not exists (
    select 1 from public.teams
    where id = v_registration.team_id and lower(btrim(email)) = v_email
  ) then raise exception 'access_denied'; end if;
  update public.registrations set manager_user_id = p_manager_user_id,
    status_token_hash = p_revoked_token_hash, updated_at = now()
    where id = p_id;
  delete from public.manager_registration_drafts
    where mode = v_registration.mode and user_id = p_manager_user_id;
  insert into public.admin_audit_logs(registration_id,action)
    values(p_id,'manager_claimed_registration');
end $$;

create or replace function public.correct_manager_registration(
  p_id uuid, p_manager_user_id uuid, p_data jsonb
) returns void
language plpgsql security definer set search_path = '' as $$
declare v_registration public.registrations;
begin
  select * into v_registration from public.registrations
    where id = p_id and manager_user_id = p_manager_user_id for update;
  if not found or not exists (
    select 1 from auth.users
    where id = p_manager_user_id and email_confirmed_at is not null
      and lower(btrim(email)) = lower(btrim(p_data->>'email'))
  ) then raise exception 'access_denied'; end if;
  perform public.correct_team_registration(p_id,v_registration.status_token_hash,p_data);
end $$;

commit;
