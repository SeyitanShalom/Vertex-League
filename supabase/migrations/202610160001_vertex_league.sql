begin;

create table public.admin_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.competition_settings (
  mode text primary key check (mode in ('test', 'live')),
  registration_fee numeric(12,2) not null check (registration_fee > 0),
  registration_enabled boolean not null default false,
  registration_deadline timestamptz,
  maximum_teams integer check (maximum_teams is null or maximum_teams > 0),
  reference_prefix text not null check (reference_prefix ~ '^[A-Z0-9-]{2,12}$'),
  reference_year integer not null check (reference_year between 2026 and 2100),
  check (mode <> 'live' or not registration_enabled or registration_deadline is not null)
);
insert into public.competition_settings values
  ('test',100,true,null,null,'VL-TEST',2026),
  ('live',34000,false,null,null,'VL',2026);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  mode text not null references public.competition_settings(mode),
  team_name text not null check (length(team_name) between 2 and 80),
  normalized_name text generated always as (regexp_replace(lower(team_name), '[^a-z0-9]', '', 'g')) stored,
  manager_name text not null check (length(manager_name) between 3 and 100),
  phone text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  whatsapp_number text not null check (whatsapp_number ~ '^\+[1-9][0-9]{7,14}$'),
  email text check (length(email) <= 254),
  location text not null check (length(location) between 2 and 120),
  logo_path text,
  additional_information text check (length(additional_information) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mode, normalized_name),
  check (length(normalized_name) > 0)
);
-- A number cannot be reused in either the phone or WhatsApp field by a different team.
create table public.manager_contacts (
  mode text not null references public.competition_settings(mode),
  phone text not null,
  team_id uuid not null references public.teams(id) on delete restrict,
  primary key (mode,phone)
);
create index manager_contacts_team_idx on public.manager_contacts(team_id);
create sequence public.registration_reference_seq;

create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  mode text not null references public.competition_settings(mode),
  team_id uuid not null unique references public.teams(id) on delete restrict,
  registration_reference text not null unique,
  submission_key uuid not null unique,
  payload_hash text not null,
  status_token_hash text not null check (status_token_hash ~ '^[a-f0-9]{64}$'),
  registration_status text not null default 'submitted' check (registration_status in ('submitted','awaiting_screening','correction_required','approved','rejected')),
  registration_fee numeric(12,2) not null check (registration_fee > 0),
  currency text not null default 'NGN' check (currency = 'NGN'),
  refund_status text not null default 'none' check (refund_status in ('none','pending','refunded')),
  admin_notes text not null default '' check (length(admin_notes) <= 2000),
  public_message text check (length(public_message) <= 1000),
  submitted_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete restrict,
  rejected_at timestamptz,
  rejection_reason text,
  screening_passed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index registrations_mode_status_date_idx on public.registrations(mode,registration_status,submitted_at desc);
create index registrations_team_idx on public.registrations(team_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'NGN' check (currency = 'NGN'),
  payment_method text not null default 'bank_transfer' check (payment_method = 'bank_transfer'),
  payment_status text not null default 'pending' check (payment_status in ('pending','confirmed','rejected')),
  is_current boolean not null default true,
  verified_by uuid references auth.users(id) on delete restrict,
  verified_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index payments_current_idx on public.payments(registration_id) where is_current;
create index payments_status_idx on public.payments(payment_status,registration_id);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null unique references public.registrations(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  transfer_reference text not null unique check (length(transfer_reference) between 3 and 120),
  refunded_at timestamptz not null,
  recorded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users(id) on delete restrict,
  registration_id uuid references public.registrations(id) on delete restrict,
  action text not null,
  previous_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamptz not null default now()
);
create index audit_registration_date_idx on public.admin_audit_logs(registration_id,created_at desc);
create table public.rate_limit_buckets (
  key_hash text primary key,
  hits integer not null,
  expires_at timestamptz not null
);

create function public.is_vertex_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((auth.jwt()->>'aal') = 'aal2',false)
    and exists(select 1 from public.admin_members where user_id = auth.uid());
$$;

-- RLS plus least-privilege grants; mutations are available through constrained RPCs only.
do $$ declare t text; begin
  foreach t in array array['admin_members','competition_settings','teams','manager_contacts','registrations','payments','refunds','admin_audit_logs','rate_limit_buckets'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
  foreach t in array array['competition_settings','teams','registrations','payments','refunds','admin_audit_logs'] loop
    execute format('grant select on public.%I to authenticated',t);
    execute format('create policy admin_read on public.%I for select to authenticated using (public.is_vertex_admin())',t);
  end loop;
end $$;
grant select on public.admin_members to authenticated;
create policy own_admin_membership on public.admin_members for select to authenticated using (user_id = auth.uid());
revoke all on sequence public.registration_reference_seq from public,anon,authenticated;
grant usage,select on sequence public.registration_reference_seq to service_role;

create function public.consume_rate_limit(p_key text,p_limit integer,p_window_seconds integer) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_hits integer;
begin
  if p_key !~ '^[a-f0-9]{64}$' or p_limit < 1 or p_limit > 1000 or p_window_seconds not between 1 and 86400 then raise exception 'invalid_limit'; end if;
  delete from public.rate_limit_buckets where expires_at < now() - interval '1 day';
  insert into public.rate_limit_buckets values(p_key,1,now()+make_interval(secs=>p_window_seconds))
  on conflict(key_hash) do update set
    hits = case when public.rate_limit_buckets.expires_at <= now() then 1 else public.rate_limit_buckets.hits+1 end,
    expires_at = case when public.rate_limit_buckets.expires_at <= now() then now()+make_interval(secs=>p_window_seconds) else public.rate_limit_buckets.expires_at end
  returning hits into v_hits;
  return v_hits <= p_limit;
end $$;

create function public.create_team_registration(p_mode text,p_data jsonb,p_submission_key uuid,p_token_hash text,p_payload_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.competition_settings; r public.registrations; v_team uuid; v_reference text; v_number text;
begin
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

create function public.correct_team_registration(p_id uuid,p_token_hash text,p_data jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.registrations; s public.competition_settings; v_old jsonb;
begin
  select * into r from public.registrations where id=p_id and status_token_hash=p_token_hash for update;
  if not found then raise exception 'access_denied'; end if;
  select * into s from public.competition_settings where mode=r.mode;
  if r.registration_status<>'correction_required' and not (r.registration_status='submitted' and (s.registration_deadline is null or now()<s.registration_deadline)) then raise exception 'editing_locked'; end if;
  select jsonb_build_object('team_name',team_name,'location',location) into v_old from public.teams where id=r.team_id;
  update public.teams set team_name=p_data->>'team_name',manager_name=p_data->>'manager_name',phone=p_data->>'phone',whatsapp_number=p_data->>'whatsapp_number',email=nullif(p_data->>'email',''),location=p_data->>'location',additional_information=nullif(p_data->>'additional_information',''),updated_at=now() where id=r.team_id;
  delete from public.manager_contacts where team_id=r.team_id;
  insert into public.manager_contacts(mode,phone,team_id)
    select r.mode,n,r.team_id from (select distinct unnest(array[p_data->>'phone',p_data->>'whatsapp_number']) n) contacts;
  insert into public.admin_audit_logs(registration_id,action,previous_value,new_value)
    values(r.id,'manager_corrected_details',v_old,jsonb_build_object('team_name',p_data->>'team_name','location',p_data->>'location'));
end $$;

create function public.admin_registration_action(p_id uuid,p_action text,p_reason text default '',p_details jsonb default '{}') returns void
language plpgsql security definer set search_path = '' as $$
declare r public.registrations; p public.payments; s public.competition_settings; v_before jsonb; v_date timestamptz;
begin
  if not public.is_vertex_admin() then raise exception 'access_denied'; end if;
  if length(p_reason)>2000 then raise exception 'invalid_reason'; end if;
  select * into r from public.registrations where id=p_id for update;
  if not found then raise exception 'registration_not_found'; end if;
  select * into s from public.competition_settings where mode=r.mode for update;
  select * into p from public.payments where registration_id=r.id and is_current for update;
  v_before := jsonb_build_object('payment_status',p.payment_status,'registration_status',r.registration_status,'refund_status',r.refund_status);
  if p_action='payment_received' then
    if p.payment_status='confirmed' or r.registration_status in ('approved','rejected') then raise exception 'invalid_transition'; end if;
    if s.maximum_teams is not null and (select count(*) from public.registrations reg join public.payments pay on pay.registration_id=reg.id and pay.is_current and pay.payment_status='confirmed' where reg.mode=r.mode and reg.id<>r.id and reg.registration_status in ('awaiting_screening','approved','correction_required') and reg.refund_status='none')>=s.maximum_teams then raise exception 'capacity_reached'; end if;
    update public.payments set payment_status='confirmed',verified_by=auth.uid(),verified_at=now(),rejection_reason=null,updated_at=now() where id=p.id;
    update public.registrations set registration_status='awaiting_screening',public_message=null,updated_at=now() where id=r.id;
  elsif p_action='reject_payment' then
    if p.payment_status='confirmed' or r.registration_status in ('approved','rejected') or length(trim(p_reason))<3 then raise exception 'invalid_transition'; end if;
    update public.payments set payment_status='rejected',rejection_reason=p_reason,updated_at=now() where id=p.id;
  elsif p_action='approve' then
    if p.payment_status<>'confirmed' or r.refund_status<>'none' or r.registration_status not in ('awaiting_screening','correction_required') or coalesce(p_details->>'screening_passed','false')<>'true' then raise exception 'screening_and_payment_required'; end if;
    if s.registration_deadline is not null and now()<=s.registration_deadline then raise exception 'screening_after_deadline'; end if;
    if r.mode='live' and s.registration_deadline is null then raise exception 'screening_after_deadline'; end if;
    update public.registrations set registration_status='approved',approved_by=auth.uid(),approved_at=now(),screening_passed_at=now(),public_message=null,updated_at=now() where id=r.id;
  elsif p_action='reject' then
    if r.registration_status in ('approved','rejected') or length(trim(p_reason))<3 then raise exception 'reason_required'; end if;
    update public.registrations set registration_status='rejected',rejected_at=now(),rejection_reason=p_reason,public_message='Your team has not been approved. Please contact the organizer for details.',refund_status=case when p.payment_status='confirmed' then 'pending' else 'none' end,updated_at=now() where id=r.id;
  elsif p_action='request_correction' then
    if r.registration_status in ('approved','rejected') or length(trim(p_reason))<3 or length(p_reason)>1000 then raise exception 'reason_required'; end if;
    update public.registrations set registration_status='correction_required',public_message=p_reason,updated_at=now() where id=r.id;
  elsif p_action='notes' then
    update public.registrations set admin_notes=p_reason,updated_at=now() where id=r.id;
  elsif p_action='refund' then
    if r.registration_status<>'rejected' or p.payment_status<>'confirmed' or r.refund_status<>'pending' then raise exception 'invalid_transition'; end if;
    if length(trim(coalesce(p_details->>'transfer_reference','')))<3 then raise exception 'refund_reference_required'; end if;
    v_date := (p_details->>'refunded_at')::timestamptz;
    if v_date is null or v_date>now()+interval '5 minutes' or v_date<p.verified_at then raise exception 'invalid_refund_date'; end if;
    insert into public.refunds(registration_id,amount,transfer_reference,refunded_at,recorded_by) values(r.id,r.registration_fee,p_details->>'transfer_reference',v_date,auth.uid());
    update public.registrations set refund_status='refunded',updated_at=now() where id=r.id;
  elsif p_action='recover_access' then
    if length(trim(p_reason))<3 or coalesce(p_details->>'token_hash','')!~'^[a-f0-9]{64}$' then raise exception 'reason_required'; end if;
    update public.registrations set status_token_hash=p_details->>'token_hash',updated_at=now() where id=r.id;
  else raise exception 'invalid_action';
  end if;
  insert into public.admin_audit_logs(admin_id,registration_id,action,previous_value,new_value,reason)
    select auth.uid(),r.id,p_action,v_before,
      jsonb_build_object('payment_status',pay.payment_status,'registration_status',reg.registration_status,'refund_status',reg.refund_status,'amount',case when p_action='refund' then reg.registration_fee else null end),nullif(p_reason,'')
    from public.registrations reg join public.payments pay on pay.registration_id=reg.id and pay.is_current where reg.id=r.id;
end $$;

revoke all on function public.is_vertex_admin() from public,anon;
grant execute on function public.is_vertex_admin() to authenticated,service_role;
revoke all on function public.consume_rate_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.consume_rate_limit(text,integer,integer) to service_role;
revoke all on function public.create_team_registration(text,jsonb,uuid,text,text) from public,anon,authenticated;
grant execute on function public.create_team_registration(text,jsonb,uuid,text,text) to service_role;
revoke all on function public.correct_team_registration(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.correct_team_registration(uuid,text,jsonb) to service_role;
revoke all on function public.admin_registration_action(uuid,text,text,jsonb) from public,anon;
grant execute on function public.admin_registration_action(uuid,text,text,jsonb) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('team-logos','team-logos',false,2097152,array['image/png','image/jpeg','image/webp'])
on conflict(id) do nothing;
-- Logo reads/writes go through the application after owner/admin authorization.
commit;
