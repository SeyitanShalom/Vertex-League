begin;

alter table public.registrations
  add column manager_user_id uuid references auth.users(id) on delete restrict;
create unique index registrations_manager_mode_idx
  on public.registrations(mode, manager_user_id)
  where manager_user_id is not null;

create table public.manager_registration_drafts (
  mode text not null references public.competition_settings(mode),
  user_id uuid not null references auth.users(id) on delete cascade,
  form_data jsonb not null check (jsonb_typeof(form_data) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (mode, user_id)
);
create index manager_registration_drafts_user_idx
  on public.manager_registration_drafts(user_id);
alter table public.manager_registration_drafts enable row level security;
revoke all on public.manager_registration_drafts from public, anon, authenticated;
grant all on public.manager_registration_drafts to service_role;

create function public.load_manager_draft(p_mode text, p_user_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select form_data from public.manager_registration_drafts
  where mode = p_mode and user_id = p_user_id;
$$;
revoke all on function public.load_manager_draft(text,uuid)
  from public, anon, authenticated;
grant execute on function public.load_manager_draft(text,uuid) to service_role;

create function public.save_manager_draft(p_mode text, p_user_id uuid, p_data jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' or not exists (
    select 1 from auth.users where id = p_user_id and phone_confirmed_at is not null
  ) then raise exception 'access_denied'; end if;
  perform pg_advisory_xact_lock(hashtextextended('vertex:manager:'||p_mode||':'||p_user_id::text, 0));
  if exists (
    select 1 from public.registrations where mode = p_mode and manager_user_id = p_user_id
  ) then raise exception 'already_registered'; end if;
  insert into public.manager_registration_drafts(mode,user_id,form_data)
    values(p_mode,p_user_id,p_data)
    on conflict(mode,user_id) do update set form_data = excluded.form_data, updated_at = now();
end $$;
revoke all on function public.save_manager_draft(text,uuid,jsonb)
  from public, anon, authenticated;
grant execute on function public.save_manager_draft(text,uuid,jsonb) to service_role;

-- Only the server may call these functions; it obtains the user ID from a verified Auth session.
create function public.create_manager_registration(
  p_mode text, p_data jsonb, p_submission_key uuid,
  p_token_hash text, p_payload_hash text, p_manager_user_id uuid
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_existing public.registrations; v_created jsonb;
begin
  if not exists (
    select 1 from auth.users
    where id = p_manager_user_id
      and phone = p_data->>'phone'
      and phone_confirmed_at is not null
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
revoke all on function public.create_manager_registration(text,jsonb,uuid,text,text,uuid)
  from public, anon, authenticated;
grant execute on function public.create_manager_registration(text,jsonb,uuid,text,text,uuid)
  to service_role;

create function public.claim_manager_registration(
  p_id uuid, p_token_hash text, p_manager_user_id uuid, p_revoked_token_hash text
) returns void
language plpgsql security definer set search_path = '' as $$
declare v_registration public.registrations; v_phone text;
begin
  if p_revoked_token_hash !~ '^[a-f0-9]{64}$' or p_revoked_token_hash = p_token_hash then
    raise exception 'access_denied';
  end if;
  select phone into v_phone from auth.users
    where id = p_manager_user_id and phone_confirmed_at is not null;
  if v_phone is null then raise exception 'access_denied'; end if;
  select * into v_registration from public.registrations
    where id = p_id and status_token_hash = p_token_hash and manager_user_id is null
    for update;
  if not found or not exists (
    select 1 from public.teams
    where id = v_registration.team_id and phone = v_phone
  ) then raise exception 'access_denied'; end if;
  update public.registrations set manager_user_id = p_manager_user_id,
    status_token_hash = p_revoked_token_hash, updated_at = now()
    where id = p_id;
  delete from public.manager_registration_drafts
    where mode = v_registration.mode and user_id = p_manager_user_id;
  insert into public.admin_audit_logs(registration_id,action)
    values(p_id,'manager_claimed_registration');
end $$;
revoke all on function public.claim_manager_registration(uuid,text,uuid,text)
  from public, anon, authenticated;
grant execute on function public.claim_manager_registration(uuid,text,uuid,text) to service_role;

create function public.correct_manager_registration(
  p_id uuid, p_manager_user_id uuid, p_data jsonb
) returns void
language plpgsql security definer set search_path = '' as $$
declare v_registration public.registrations;
begin
  select * into v_registration from public.registrations
    where id = p_id and manager_user_id = p_manager_user_id for update;
  if not found or not exists (
    select 1 from auth.users
    where id = p_manager_user_id and phone = p_data->>'phone'
      and phone_confirmed_at is not null
  ) then raise exception 'access_denied'; end if;
  perform public.correct_team_registration(p_id,v_registration.status_token_hash,p_data);
end $$;
revoke all on function public.correct_manager_registration(uuid,uuid,jsonb)
  from public, anon, authenticated;
grant execute on function public.correct_manager_registration(uuid,uuid,jsonb) to service_role;

commit;
