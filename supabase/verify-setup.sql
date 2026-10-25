-- Run in the test project's SQL Editor after applying all migrations.
-- These checks only read database metadata and competition settings.

-- Expected: 10 rows, with both checks true for every table.
with expected(table_name) as (
  values
    ('admin_members'),
    ('competition_settings'),
    ('teams'),
    ('manager_contacts'),
    ('manager_registration_drafts'),
    ('registrations'),
    ('payments'),
    ('refunds'),
    ('admin_audit_logs'),
    ('rate_limit_buckets')
)
select
  expected.table_name,
  tables.tablename is not null as table_exists,
  coalesce(tables.rowsecurity, false) as row_security_enabled
from expected
left join pg_catalog.pg_tables as tables
  on tables.schemaname = 'public' and tables.tablename = expected.table_name
order by expected.table_name;

-- Fees: test = 100; live = 35000. Enabled states follow the current rollout:
-- after the live switch, test is false and live is true (see docs/LIVE_REGISTRATION.md).
select mode, registration_fee, registration_enabled
from public.competition_settings
order by mode;

-- Expected: 7 rows, all true.
select
  'vertex_league' as migration,
  to_regprocedure('public.create_team_registration(text,jsonb,uuid,text,text)') is not null as applied
union all
select
  'admin_queries',
  to_regprocedure('public.admin_list_registrations(text,text,text,text,integer,date,date)') is not null
union all
select
  'logo_updates',
  to_regprocedure('public.set_team_logo(uuid,text,text)') is not null
union all
select
  'database_access_hardening',
  not coalesce(has_function_privilege('anon', to_regprocedure('public.rls_auto_enable()'), 'execute'), false)
  and not coalesce(has_function_privilege('authenticated', to_regprocedure('public.rls_auto_enable()'), 'execute'), false)
  and (select count(*) = 4 from pg_indexes
    where schemaname = 'public' and indexname in (
      'admin_audit_logs_admin_id_idx', 'payments_verified_by_idx',
      'refunds_recorded_by_idx', 'registrations_approved_by_idx'
    ))
union all
select
  'manager_accounts',
  to_regprocedure('public.create_manager_registration(text,jsonb,uuid,text,text,uuid)') is not null
  and to_regprocedure('public.claim_manager_registration(uuid,text,uuid,text)') is not null
  and to_regprocedure('public.correct_manager_registration(uuid,uuid,jsonb)') is not null
  and to_regprocedure('public.load_manager_draft(text,uuid)') is not null
  and to_regprocedure('public.save_manager_draft(text,uuid,jsonb)') is not null
  and not has_function_privilege('authenticated',
    'public.create_manager_registration(text,jsonb,uuid,text,text,uuid)', 'execute')
union all
select
  'manager_email_auth',
  (select count(*) = 4
   from pg_catalog.pg_proc as functions
   join pg_catalog.pg_namespace as schemas on schemas.oid = functions.pronamespace
   where schemas.nspname = 'public'
     and functions.proname in (
       'save_manager_draft', 'create_manager_registration',
       'claim_manager_registration', 'correct_manager_registration'
     )
     and pg_catalog.pg_get_functiondef(functions.oid) like '%email_confirmed_at%'
     and pg_catalog.pg_get_functiondef(functions.oid) not like '%phone_confirmed_at%')
union all
select
  'delete_test_registrations',
  to_regprocedure('public.delete_test_registration(uuid,text)') is not null
  and not has_function_privilege('anon',
    'public.delete_test_registration(uuid,text)', 'execute')
  and has_function_privilege('authenticated',
    'public.delete_test_registration(uuid,text)', 'execute');
