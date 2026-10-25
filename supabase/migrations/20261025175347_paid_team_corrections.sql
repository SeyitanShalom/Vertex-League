begin;

-- A non-null approval records the organizer's verification of the separate fee.
-- Existing correction requests stay locked until that payment is verified.
alter table public.registrations
  add column correction_approved_at timestamptz,
  add constraint registrations_correction_approval_status
    check (correction_approved_at is null or registration_status = 'correction_required');

create or replace function public.correct_team_registration(
  p_id uuid, p_token_hash text, p_data jsonb
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.registrations;
  v_old jsonb;
  v_payment_status text;
  v_status text;
begin
  select * into r from public.registrations
    where id = p_id and status_token_hash = p_token_hash for update;
  if not found then raise exception 'access_denied'; end if;
  if r.registration_status <> 'correction_required' or r.correction_approved_at is null then
    raise exception 'editing_locked';
  end if;

  select payment_status into v_payment_status from public.payments
    where registration_id = r.id and is_current;
  v_status := case when v_payment_status = 'confirmed' then 'awaiting_screening' else 'submitted' end;
  select jsonb_build_object('team_name', team_name, 'location', location)
    into v_old from public.teams where id = r.team_id;
  update public.teams set
    team_name = p_data->>'team_name', manager_name = p_data->>'manager_name',
    phone = p_data->>'phone', whatsapp_number = p_data->>'whatsapp_number',
    email = nullif(p_data->>'email', ''), location = p_data->>'location',
    additional_information = nullif(p_data->>'additional_information', ''), updated_at = now()
    where id = r.team_id;
  delete from public.manager_contacts where team_id = r.team_id;
  insert into public.manager_contacts(mode, phone, team_id)
    select r.mode, n, r.team_id
    from (select distinct unnest(array[p_data->>'phone', p_data->>'whatsapp_number']) n) contacts;

  -- The row lock makes one approval usable for one successful submission only.
  update public.registrations set
    registration_status = v_status, correction_approved_at = null,
    public_message = null, updated_at = now()
    where id = r.id;
  insert into public.admin_audit_logs(registration_id, action, previous_value, new_value)
    values(r.id, 'manager_corrected_details', v_old,
      jsonb_build_object('team_name', p_data->>'team_name', 'location', p_data->>'location',
        'registration_status', v_status, 'correction_approval_consumed', true));
end $$;

create or replace function public.admin_registration_action(
  p_id uuid, p_action text, p_reason text default '', p_details jsonb default '{}'
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.registrations;
  p public.payments;
  s public.competition_settings;
  v_before jsonb;
  v_date timestamptz;
begin
  if not public.is_vertex_admin() then raise exception 'access_denied'; end if;
  if length(p_reason) > 2000 then raise exception 'invalid_reason'; end if;
  select * into r from public.registrations where id = p_id for update;
  if not found then raise exception 'registration_not_found'; end if;
  select * into s from public.competition_settings where mode = r.mode for update;
  select * into p from public.payments where registration_id = r.id and is_current for update;
  v_before := jsonb_build_object('payment_status', p.payment_status,
    'registration_status', r.registration_status, 'refund_status', r.refund_status);

  if p_action = 'payment_received' then
    if p.payment_status = 'confirmed' or r.registration_status in ('approved', 'rejected') then
      raise exception 'invalid_transition';
    end if;
    if s.maximum_teams is not null and (
      select count(*) from public.registrations reg
      join public.payments pay on pay.registration_id = reg.id and pay.is_current
        and pay.payment_status = 'confirmed'
      where reg.mode = r.mode and reg.id <> r.id
        and reg.registration_status in ('awaiting_screening', 'approved', 'correction_required')
        and reg.refund_status = 'none'
    ) >= s.maximum_teams then raise exception 'capacity_reached'; end if;
    update public.payments set payment_status = 'confirmed', verified_by = auth.uid(),
      verified_at = now(), rejection_reason = null, updated_at = now() where id = p.id;
    update public.registrations set
      registration_status = case when r.correction_approved_at is not null
        then 'correction_required' else 'awaiting_screening' end,
      public_message = case when r.correction_approved_at is not null then r.public_message else null end,
      updated_at = now() where id = r.id;

  elsif p_action = 'reject_payment' then
    if p.payment_status = 'confirmed' or r.registration_status in ('approved', 'rejected')
      or length(trim(p_reason)) < 3 then raise exception 'invalid_transition'; end if;
    update public.payments set payment_status = 'rejected', rejection_reason = p_reason,
      updated_at = now() where id = p.id;

  elsif p_action = 'approve' then
    if p.payment_status <> 'confirmed' or r.refund_status <> 'none'
      or r.registration_status <> 'awaiting_screening'
      or coalesce(p_details->>'screening_passed', 'false') <> 'true' then
      raise exception 'screening_and_payment_required';
    end if;
    if s.registration_deadline is not null and now() <= s.registration_deadline then
      raise exception 'screening_after_deadline';
    end if;
    if r.mode = 'live' and s.registration_deadline is null then
      raise exception 'screening_after_deadline';
    end if;
    update public.registrations set registration_status = 'approved', approved_by = auth.uid(),
      approved_at = now(), screening_passed_at = now(), public_message = null,
      correction_approved_at = null, updated_at = now() where id = r.id;

  elsif p_action = 'reject' then
    if r.registration_status in ('approved', 'rejected') or length(trim(p_reason)) < 3 then
      raise exception 'reason_required';
    end if;
    update public.registrations set registration_status = 'rejected', rejected_at = now(),
      rejection_reason = p_reason,
      public_message = 'Your team has not been approved. Please contact the organizer for details.',
      refund_status = case when p.payment_status = 'confirmed' then 'pending' else 'none' end,
      correction_approved_at = null, updated_at = now() where id = r.id;

  elsif p_action = 'request_correction' then
    if r.registration_status in ('approved', 'rejected') or r.correction_approved_at is not null then
      raise exception 'invalid_transition';
    end if;
    if length(trim(p_reason)) < 3 or length(p_reason) > 1000 then
      raise exception 'reason_required';
    end if;
    if coalesce(p_details->>'correction_payment_received', 'false') <> 'true'
      or coalesce(p_details->>'correction_fee_amount', '') <> '2000' then
      raise exception 'correction_payment_required';
    end if;
    update public.registrations set registration_status = 'correction_required',
      correction_approved_at = now(), public_message = p_reason, updated_at = now()
      where id = r.id;

  elsif p_action = 'notes' then
    update public.registrations set admin_notes = p_reason, updated_at = now() where id = r.id;

  elsif p_action = 'refund' then
    if r.registration_status <> 'rejected' or p.payment_status <> 'confirmed'
      or r.refund_status <> 'pending' then raise exception 'invalid_transition'; end if;
    if length(trim(coalesce(p_details->>'transfer_reference', ''))) < 3 then
      raise exception 'refund_reference_required';
    end if;
    v_date := (p_details->>'refunded_at')::timestamptz;
    if v_date is null or v_date > now() + interval '5 minutes' or v_date < p.verified_at then
      raise exception 'invalid_refund_date';
    end if;
    insert into public.refunds(registration_id, amount, transfer_reference, refunded_at, recorded_by)
      values(r.id, r.registration_fee, p_details->>'transfer_reference', v_date, auth.uid());
    update public.registrations set refund_status = 'refunded', updated_at = now() where id = r.id;

  elsif p_action = 'recover_access' then
    if length(trim(p_reason)) < 3 or coalesce(p_details->>'token_hash', '') !~ '^[a-f0-9]{64}$' then
      raise exception 'reason_required';
    end if;
    update public.registrations set status_token_hash = p_details->>'token_hash',
      updated_at = now() where id = r.id;
  else raise exception 'invalid_action';
  end if;

  insert into public.admin_audit_logs(admin_id, registration_id, action, previous_value, new_value, reason)
    select auth.uid(), r.id, p_action, v_before,
      jsonb_build_object('payment_status', pay.payment_status,
        'registration_status', reg.registration_status, 'refund_status', reg.refund_status,
        'amount', case when p_action = 'refund' then reg.registration_fee else null end)
      || case when p_action = 'request_correction' then
        jsonb_build_object('correction_fee_amount', 2000, 'correction_payment_verified', true,
          'correction_approved_at', reg.correction_approved_at)
        else '{}'::jsonb end,
      nullif(p_reason, '')
    from public.registrations reg
    join public.payments pay on pay.registration_id = reg.id and pay.is_current
    where reg.id = r.id;
end $$;

revoke all on function public.correct_team_registration(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.correct_team_registration(uuid, text, jsonb) to service_role;
revoke all on function public.admin_registration_action(uuid, text, text, jsonb) from public, anon;
grant execute on function public.admin_registration_action(uuid, text, text, jsonb) to authenticated, service_role;

commit;
