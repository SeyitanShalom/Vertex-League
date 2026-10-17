begin;
create function public.admin_registration_stats(p_mode text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.is_vertex_admin() then raise exception 'access_denied'; end if;
  select jsonb_build_object('total',count(*),'pending',count(*) filter(where p.payment_status<>'confirmed' and r.registration_status<>'rejected'),'confirmed',count(*) filter(where p.payment_status='confirmed'),'approved',count(*) filter(where r.registration_status='approved'),'refunds_due',count(*) filter(where r.refund_status='pending')) into result
    from public.registrations r join public.payments p on p.registration_id=r.id and p.is_current where r.mode=p_mode;
  return result;
end $$;
create function public.admin_list_registrations(p_mode text,p_search text default '',p_payment text default '',p_status text default '',p_page integer default 1,p_from date default null,p_to date default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb; v_query text;
begin
  if not public.is_vertex_admin() then raise exception 'access_denied'; end if;
  if p_page not between 1 and 10000 or length(p_search)>80 then raise exception 'invalid_filters'; end if;
  v_query := '%'||replace(replace(replace(p_search,'\','\\'),'%','\%'),'_','\_')||'%';
  with matched as (
    select r.id,r.registration_reference,r.submitted_at,r.registration_fee,r.registration_status,r.refund_status,t.team_name,t.manager_name,t.phone,p.payment_status
    from public.registrations r join public.teams t on t.id=r.team_id join public.payments p on p.registration_id=r.id and p.is_current
    where r.mode=p_mode and (p_payment='' or p.payment_status=p_payment) and (p_status='' or r.registration_status=p_status)
    and (p_search='' or r.registration_reference ilike v_query or t.team_name ilike v_query or t.manager_name ilike v_query)
    and (p_from is null or r.submitted_at >= (p_from::timestamp at time zone 'Africa/Lagos'))
    and (p_to is null or r.submitted_at < ((p_to+1)::timestamp at time zone 'Africa/Lagos'))
  ), page as (select * from matched order by submitted_at desc,id desc limit 20 offset (p_page-1)*20)
  select jsonb_build_object('total',(select count(*) from matched),'rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb)) into result;
  return result;
end $$;
revoke all on function public.admin_registration_stats(text) from public,anon;
grant execute on function public.admin_registration_stats(text) to authenticated;
revoke all on function public.admin_list_registrations(text,text,text,text,integer,date,date) from public,anon;
grant execute on function public.admin_list_registrations(text,text,text,text,integer,date,date) to authenticated;
commit;
