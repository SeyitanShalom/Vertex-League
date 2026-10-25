# Live registration handoff - 25 October 2026

The organizer confirmed testing is finished, the recorded NGN 100 payment was simulated, and both test registrations and the saved test draft should be removed. The replacement bank/contact values were supplied in `.env.local`.

## Cleanup and backups

Removed test references `VL-TEST-2026-000026` and `VL-TEST-2026-000027`, two linked payment records, two contact records, their four submission/review audit records, the two teams and one test draft. A separate cleanup audit event remains. Test registration is closed. Existing Auth users, organizer membership and the registration sequence are preserved.

The pre-cleanup database snapshot, local environment backup and cleanup result are in `.local-ops/launch-2026-10-25T06-52-49-394Z/`. These files contain private data and are excluded from Git. The database snapshot's SHA-256 is `9e4d8403a19ed4bd6547c5bdb9851b181d5bbd7e7b91c09b2609fbcfa12ef22c`.

## Confirmed live values

| Setting                | Value                                         |
| ---------------------- | --------------------------------------------- |
| Registration fee       | NGN 35,000 per team                           |
| Closing time           | 21 November 2026, 23:59 Africa/Lagos (WAT)    |
| Stored deadline        | `2026-11-21T22:59:00Z`                        |
| Team capacity          | Unlimited (`maximum_teams = null`)            |
| Registration reference | `VL`, year `2026`; existing sequence retained |
| Bank                   | Kolomoni MFB                                  |
| Beneficiary            | Apex League Enterprises                       |
| Account                | Replacement account ending `8437`             |
| Organizer WhatsApp     | Replacement number ending `1759`              |
| Contact email          | `hello.vertexleague@gmail.com`                |
| Canonical website      | `https://vertexleague.com.ng`                 |

The hosted live row is enabled with these values, and the test row is disabled. A read after the update verified both rows and zero remaining test teams, registrations, contacts or drafts. All four Auth accounts are preserved.

Event/screening dates and venues remain blank until the organizer finalizes them. The current Supabase project is retained with its existing email confirmation/SMTP setup; application records remain separated by mode. No test registrations were converted into live registrations.

## Production environment and deployment

`.env.local` now selects `COMPETITION_MODE=live`; its localhost URL is retained for local development. Editing this ignored file does not update Vercel.

The Git-ignored `.local-ops/vercel-production.env` contains the exact replacement bank/contact values and the production overrides below. It contains no Supabase or token secrets.

The eight nonblank values are now saved in Vercel Production and deployed. Optional event/screening values remain unset. Existing Supabase keys and the status-token secret were preserved.

- `COMPETITION_MODE=live`
- `SITE_URL=https://vertexleague.com.ng`
- `BANK_NAME`, `BANK_ACCOUNT_NAME`, `BANK_ACCOUNT_NUMBER`
- `ORGANIZER_WHATSAPP`, `CONTACT_EMAIL`
- `TRUST_VERCEL_IP=true` for Vercel's trusted ingress
- Blank `COMPETITION_VENUE`, `COMPETITION_DATES`, `SCREENING_VENUE`, `SCREENING_DATE`

In Vercel, select **vertex-league → Settings → Environment Variables → Production**. Update existing keys to match this file, save, then redeploy Production. Keep the existing Supabase keys and `STATUS_TOKEN_SECRET` in their server/public scopes. The registration fee and deadline belong in `competition_settings`, not new environment variables.

Environment changes require a new deployment: [Vercel environment variable documentation](https://vercel.com/docs/environment-variables).

The saved Vercel login initially returned HTTP 403. Access was rechecked later on 25 October and returned HTTP 200 for the correct project and account, allowing the production update and redeployment to proceed.

## Production deployment - 25 October 2026

The update used account `seyitanoluwapelumi-2280`, project `vertex-league` (`prj_AOWGnaLAgeptiWwi6KvUOticBH19`). Vercel deployment `dpl_CqkbvWQDm7F2dhyj4wW6DBXWroRL` reached `READY` with its production aliases assigned, including `https://vertexleague.com.ng` and `https://vertex-league.vercel.app`.

The deployment reuses the previously validated source commit `c2dd7ecd7139672b5abeb9e23b4e3e7752b8f28b`. Eight existing Production-only variables were updated: mode, canonical URL, the three bank fields, organizer WhatsApp, contact email and the trusted Vercel ingress flag. Other variables were verified unchanged. No application source, database schema or DNS records were changed for this deployment.

Vercel configuration backups, environment update acknowledgments and deployment metadata are in `.local-ops/vercel-production-2026-10-25T09-29-43-176Z/`, excluded from Git.

Read-only Chrome checks passed against the real domain on desktop and mobile. The live fee and deadline rendered correctly, test labels were absent, the homepage no longer carried the test-mode `noindex` header, and `/api/health` returned `ready`. The footer's email and WhatsApp recipient matched the replacement local configuration. The complete entry path through the rules section and Start your registration link correctly required manager sign-in. Manager sign-in and organizer login pages loaded, with no horizontal overflow or browser runtime errors. The first check was adjusted to follow the existing rules-first entry path. Results and screenshots are in the rollout folder's `live-browser-checks/` directory.

These checks created no accounts or registrations and sent no emails, payments or WhatsApp messages. The private bank-instruction page and an actual transfer remain checks for the first real registration; the bank values were validated locally and acknowledged by Vercel's Production environment update.

## Verification completed locally

The production build with `COMPETITION_MODE=live` and the canonical HTTPS `SITE_URL` passed, including TypeScript. One settings read warning occurred during static page generation; the connected production preview subsequently returned `ready` and rendered the hosted live settings correctly.

Read-only Chrome checks passed on desktop (1440px) and mobile (390px): NGN 34,000 in the fee panel, the correct Lagos deadline, no test fee label, a visible registration link, healthy database access, manager sign-in and organizer login pages, no horizontal overflow and no browser runtime errors. Results and screenshots are under `.local-ops/live-browser-checks/`. These checks created no registrations and sent no emails, payments or messages. Documentation formatting and `git diff --check` also passed.

Before the production update, a public website check returned HTTP 200 for `/`, `/api/health` and `/manager/sign-in`, but the homepage still had its test registration label and `noindex` header. That check identified the outstanding Production environment switch; the deployment above completes that switch.

## Live checks after redeployment

1. Confirm the homepage shows NGN 35,000, the correct deadline and an available registration action without test-mode labels.
2. Confirm `/api/health` reports `ready`, and the manager sign-in and organizer login pages load.
3. Verify the first real registration's bank account, beneficiary and WhatsApp recipient against the supplied details before transferring money. No real registration, bank transfer or WhatsApp message is generated by the launch checks.
4. Payment confirmation remains a manual organizer action. Screening and approval remain separate.

To pause real registration, set `public.competition_settings.registration_enabled=false` for `mode='live'`. Closing registration preserves existing records.

## Registration fee update - 25 October 2026

The organizer requested increasing the live fee from NGN 34,000 to NGN 35,000. The hosted live settings row was updated with a guarded write and verified by a fresh read. Test settings, the registration deadline and other live settings were unchanged. There were zero live registrations at the time of the change; existing fee snapshots were not rewritten. A settings backup and audit event were retained. The application fallback amounts and test-mode fee explanation were also updated.

Deployment `dpl_32GZPHNoZMvdmiAZeWmnfTB3nhAT` reached `READY` and was assigned to `https://vertexleague.com.ng`. It was built from an isolated source archive with the two updated application pages; private environment files and operational backups were excluded.

Read-only Chrome checks passed on the live domain at desktop and mobile sizes. Both fee panels displayed NGN 35,000, the deadline was unchanged, the registration entry path required manager sign-in, and health and login pages loaded without browser runtime errors or horizontal overflow. No registrations, accounts, emails, payments or messages were created. Deployment metadata, results and screenshots are retained under `.local-ops/fee-change-2026-10-25T09-48-22-271Z/`.

## Reference reset after complete cleanup - completed 25 October 2026

The organizer requested restarting reference numbering at `000001` only after every registration has been deleted. Migration `20261025112908_reset_registration_references_when_empty.sql` implements this for DELETE and TRUNCATE across the shared live/test registration table. It preserves the counter whenever any registration remains and never renumbers existing entries. Transactional sequence restart rolls back with a failed deletion. Creation and test cleanup use the same lock order to coordinate with reset operations; a private trigger helper has no application-role execute privileges. Final-row DELETE operations require the normal READ COMMITTED isolation level to avoid using an older snapshot.

All 61 database tests passed locally, including a final-row organizer deletion, partial deletion, shared live/test numbering, bulk cleanup, truncation, rollback and helper permissions. Targeted lint and whitespace checks also passed. The redefined creation and test-deletion routines were compared with their prior versions: existing validation and authorization logic are unchanged apart from the added locking.

Applied migration `20261025112908` to hosted project `zoobdteyjoxrejskicxh` through the project-scoped Supabase MCP connection after refreshing its OAuth authorization. Its local filename matches the version recorded by Supabase. The database had zero registrations and the counter was at 28 before the change. Fresh reads confirmed `last_value=1` and `is_called=false`, so the next live reference is `VL-2026-000001`; verification did not consume a number.

All eight hosted migration checks passed. The trigger was exercised as `service_role` using a zero-row DELETE inside a rolled-back transaction, confirming it executes without application-role access to its private helper. No registrations or accounts were created or deleted. Competition settings, existing function privileges and unrelated triggers were verified unchanged. Security and performance advisor findings matched their previous baseline, with no new findings. Backups, migration output and verification results are retained under `.local-ops/reference-reset-2026-10-25T11-24-45-943Z/`, excluded from Git. No Vercel deployment is required for this database-only behavior.
