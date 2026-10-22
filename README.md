# Vertex League

A Next.js football competition website with manager phone sign-in, persistent team registration, bank-transfer instructions, WhatsApp receipt handoff, account-protected team status, and an authenticated organizer dashboard. Initial configuration: **test mode, NGN 100 per team**. Live mode defaults to NGN 34,000 and stays closed until a deadline is configured.

## Run locally

Requirements: Node.js 22.16+ and npm. From this `vertex` directory:

```powershell
npm.cmd ci
Copy-Item .env.example .env.local
npm.cmd run dev
```

Open http://localhost:3000. Without credentials the public pages render, while registration and sign-in show setup states. No mock registrations or fake payment successes are generated.

Development uses Webpack after local Turbopack sessions stalled on organizer detail pages. Production builds still use Turbopack. See the latest [validation notes](docs/VALIDATION.md) for the verified workflow and runtime checks.

## Connect Supabase for testing

1. Create a dedicated Supabase **test** project. Use a separate project and deployment for live data.
2. Apply the files in `supabase/migrations/` in filename order using Supabase MCP's `apply_migration`, or initialize/link the Supabase CLI and run `supabase db push`. These methods record migration history; apply only pending migrations to an existing database. The new `202610210001_manager_accounts.sql` migration has **not** been applied to the hosted test project by this code change. Migrations create the tables, reference sequence, RLS/grants, constrained RPCs and private storage compatibility for previously stored logos. Run the read-only checks in `supabase/verify-setup.sql` to verify the setup.
3. Set the project URL, publishable key and server secret key in `.env.local`. A legacy service-role key can be used as `SUPABASE_SECRET_KEY`; it must remain server-only.
4. Generate a token secret and copy the result into `STATUS_TOKEN_SECRET`:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

5. Keep `COMPETITION_MODE=test`. Add the test bank name, beneficiary name, ten-digit Nigerian account number and organizer WhatsApp number in full international format (`234...`). Blank payment/contact values close registration safely. A real test transfer requires a valid account and involves real money; invented account details only test presentation.
6. Set `SITE_URL=http://localhost:3000` locally, or the exact HTTPS origin of the deployed test site. Restart after environment changes.
7. In Supabase Auth, allow new users to sign up, enable phone sign-in, and configure an SMS provider. Set Auth OTP/rate limits. CAPTCHA challenge/token handling is **not wired yet**, so do not enable enforced CAPTCHA in Supabase until that is implemented and tested before public launch. The website sends codes through Supabase Auth; no SMS provider credentials belong in this app's `.env.local`. Add an email/password administrator through Authentication → Users with confirmed email and a strong password. Authorize its UUID in SQL:

   ```sql
   insert into public.admin_members(user_id) values ('YOUR_ADMIN_USER_UUID');
   ```

8. Visit `/manager/sign-in` and verify real SMS delivery with a test phone before opening registration. Visit `/admin/login`; first admin login requires enrolling an authenticator app, and subsequent logins require its six-digit code. The server and database both enforce the admin allowlist and MFA. If an authenticator is lost, a trusted Supabase project administrator must recover/reset its factor before re-enrollment; there is no public MFA bypass.
9. Review Supabase Security Advisor. Do not add broad public policies or public storage access to work around configuration errors.

## Configuration

Public copy, FAQs and rules live in `src/lib/config/competition.ts`. Add only organizer-supplied dates, eligibility criteria and facts. The header and footer use the supplied `public/LOGO 5.png`, framed to exclude the PNG's transparent margins. Fonts are bundled locally.

Brand colors are navy `#000080` (main) and yellow `#ffd800` (accent), on white page backgrounds. The shared palette and related surface colors are defined in `src/app/globals.css`; the standalone site icon uses the same colors. Typography uses the supplied Mark Pro files with Anton display headings and Manrope as a fallback. The development/build hooks prepare the font stylesheet automatically; supported filenames and formats are described in `public/fonts/README.md`.

Operational settings are centralized in `public.competition_settings`, one row per mode. Application pages and database transactions read the same fee/deadline rules:

```sql
update public.competition_settings
set registration_fee=100, registration_enabled=true,
    reference_prefix='VL-TEST', reference_year=2026, maximum_teams=null
where mode='test';

-- Explicitly close registration:
update public.competition_settings set registration_enabled=false where mode='test';
```

When decided, set `registration_deadline` to the actual ISO timestamp with its offset. Nigerian local times use `+01:00`. Both server and database enforce the cutoff. Existing registrations retain their fee snapshot. Sequence gaps are expected. Vertex League has no fixed capacity (`maximum_teams=null`). Optional capacity checks exist; with manual transfers, late/excess payments still require the organizer's attention.

| Environment variable                                    | Purpose                                                                                             |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `COMPETITION_MODE`                                      | `test` by default; explicitly `live` for launch                                                     |
| `NEXT_PUBLIC_SUPABASE_URL`                              | Project URL                                                                                         |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`                  | Public project key, protected by RLS                                                                |
| `SUPABASE_SECRET_KEY`                                   | Server-only elevated project key                                                                    |
| `STATUS_TOKEN_SECRET`                                   | At least 64 characters; use the generator above                                                     |
| `SITE_URL`                                              | Canonical origin; HTTPS when deployed                                                               |
| `BANK_NAME`, `BANK_ACCOUNT_NAME`, `BANK_ACCOUNT_NUMBER` | Deployment-specific payment instructions                                                            |
| `ORGANIZER_WHATSAPP`                                    | Full international organizer number                                                                 |
| `CONTACT_EMAIL`                                         | Optional contact email                                                                              |
| `COMPETITION_VENUE`, `COMPETITION_DATES`                | Optional factual event details                                                                      |
| `SCREENING_VENUE`, `SCREENING_DATE`                     | Optional factual screening details                                                                  |
| `TRUST_VERCEL_IP`                                       | `true` only behind trusted Vercel ingress; otherwise callers share a conservative rate-limit bucket |

Never put secrets in `NEXT_PUBLIC_` variables. `.env.local` is ignored; `.env.example` contains placeholders only.

Motion powers the hero entrances, scroll reveals, staggered cards, and mobile menu. Shared timing and reduced-motion defaults live in `src/components/motion/motion-provider.tsx`; `reveal.tsx` provides the reusable reveal component. Reveals run once as content enters the viewport and render without hidden initial animation styles. The existing CSS logo and background animations also respect reduced-motion preferences. JavaScript-disabled browsing still displays the Next.js streaming loading fallback.

## Registration and administration

1. A manager verifies a phone code at `/manager/sign-in`, then completes `/register`. The verified phone is prefilled and cannot be edited in the form. **Save progress for later** stores an unfinished draft against the account; it does not reserve a place. Submission atomically links one team to the manager account and saves the fee snapshot, pending payment and reference. Idempotent retries avoid duplicate records.
2. `/payment/[reference]` displays the stored fee and configured bank account to the signed-in manager. The manager transfers the fee, opens WhatsApp, attaches the receipt and presses Send. The website does not read WhatsApp messages or automatically attach/send files.
3. The organizer checks the actual bank account and clicks **Payment received** in `/admin`. The team's place is provisionally booked; it is not yet approved.
4. After the deadline the team/players attend physical screening. The admin attests that screening passed and clicks **Approve team** to complete entry. Player details are collected physically.
5. A rejected paid team becomes eligible for a full refund. After returning the full fee manually, the organizer records **Record full refund**, the transfer reference and completion time. This action records a transfer; it does not send money.

Payment rejection permits proof resubmission in the same WhatsApp chat/reference. Managers can edit submitted details before the deadline; an admin can explicitly **Request corrections** for paid teams. Correction instructions are shown to that manager; internal notes and other reasons remain private. Approved/rejected manager records are locked.

Existing registrations created before manager accounts can be linked once at `/manager/claim` using the original private link and a code sent to the registration's primary phone. After a successful claim, the old link no longer opens the team. Legacy registrations remain accessible by link until claimed. Account recovery after loss of the phone number is not yet automated; the organizer must verify identity before a future recovery/number-change workflow is implemented.

## Pages, files and data

- `/`: landing page, registration information, rules, full-refund policy and FAQs.
- `/manager/sign-in`: manager phone-code sign-in.
- `/manager/claim`: one-time linking of an older registration to a verified account.
- `/team`: routes the manager to their draft, legacy claim or registered team's status.
- `/register`: signed-in Phase 1 team/manager form with optional email and cross-device draft saving.
- `/payment/[reference]`: Phase 2 protected bank instructions, account-number copying and WhatsApp handoff for payment receipts and team logos.
- `/registration/[reference]`: account-protected status, corrections, WhatsApp team-logo handoff and refund progress.
- `/access`: legacy private-link exchange for registrations not yet claimed.
- `/admin/login`, `/admin/mfa`: allowlisted sign-in and mandatory TOTP verification/enrollment.
- `/admin`: actual statistics, search, date/status filters, pagination and filtered CSV export.
- `/admin/registrations/[id]`: review, actions, notes, latest 50 audit events and legacy link recovery.
- `/api/health`: minimal readiness response; 503 until the database is configured.
- `src/app/actions/`: validated registration/auth/admin mutations.
- `src/lib/`: config, server-only Supabase clients, authorization, tokens, validation and query helpers.
- `src/components/ui/`, `components.json`: locally maintained shadcn-style primitives built with Radix/CVA.
- `supabase/migrations/`: schema, policies and constrained database functions.

Tables: `competition_settings`, `teams`, `manager_contacts`, `manager_registration_drafts`, `registrations`, `payments`, `refunds`, `admin_members`, `admin_audit_logs` and `rate_limit_buckets`. Payments support a current record and future attempt history; current state changes are audited.

## Verification commands

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run test:browser
npm.cmd audit --omit=dev
```

Vitest tests validation, cutoffs, edit rules, WhatsApp URL encoding, CSV formula escaping and the actual PostgreSQL migrations using PGlite. PGlite uses a minimal Auth/Storage schema shim; it does not verify hosted Supabase Auth, Storage or PostgREST behavior.

Browser tests use installed Google Chrome via Playwright and the production build on port 3100. They check desktop/mobile navigation, setup states, private access denial, unauthorized admin/export requests, security headers, nonce rotation, token-fragment clearing and overflow. Install Chrome or change the channel to an installed browser. These tests expect an unconfigured deployment: run them without real `.env.local` credentials, or extend them for a dedicated hosted integration environment. Screenshots/traces are ignored under `test-results/`.

To manage the test server separately, start `npm.cmd run start -- --hostname 127.0.0.1 --port 3100`, set `$env:PLAYWRIGHT_EXTERNAL_SERVER='true'`, then run browser tests. Stop your owned server afterwards.

## Vercel-compatible deployment and live switch

Import this `vertex` directory as the Vercel project root, select Next.js, install with `npm ci` and build with `npm run build`. Configure a dedicated **test** Supabase project and test values first. Keep test mode visible while reviewing it. No deployment is performed by the local build.

After testing, create a separate live Supabase project, apply the migrations and provision its admin. Configure real bank/contact/event details, a new token secret and the HTTPS origin. Set the live database row's actual deadline/year, NGN 34,000 fee, unlimited capacity and `registration_enabled=true`, then set deployment `COMPETITION_MODE=live`. Do not copy test registrations into the live project. Run the live smoke checks in [security notes](docs/SECURITY.md) before opening registration.

## Troubleshooting

- **Setup state:** check environment variables, token-secret length, all migrations, bank details and WhatsApp format. `/api/health` intentionally returns 503 during setup.
- **Manager sign-in fails:** confirm the new migration, Auth public signups, phone provider, SMS delivery and Auth rate limits. Admin sign-in still requires a confirmed user, `admin_members` UUID and authenticator enrollment; there is no public admin authorization.
- **RPC/relationship errors:** apply all migrations in order. Refresh PostgREST's schema cache if needed with `notify pgrst, 'reload schema';` in the SQL editor.
- **Duplicate team:** sign in to the existing account or link a legacy registration; do not create another team under a reused number.
- **Approval blocked:** confirm payment and physical screening, and ensure the registration deadline has passed in live mode.
- **Edits locked:** ask the organizer to Request corrections; final records stay locked.
- **Team logo:** send the image directly to the organizer on WhatsApp using the payment or team status page's chat link. Include the saved registration reference; the website does not upload files or synchronize WhatsApp attachments.
- **WhatsApp desktop app will not open:** the receipt/logo button opens WhatsApp's choice page. Select **Continue to WhatsApp Web**, link your phone if prompted, then attach the receipt/logo and press Send in WhatsApp.
- **Rate limit reached locally:** unknown/local ingress uses a shared persistent bucket; wait for expiry rather than disabling live protection.
- **CSV interrupted:** a query/network failed; retry. Internal notes and private tokens/links are omitted.
- **Development dependency advisory:** see [security notes](docs/SECURITY.md); production packages are audited separately.

See [agreed requirements](docs/REQUIREMENTS.md) and [validation notes](docs/VALIDATION.md). The hosted test configuration, organizer MFA and simulated admin workflow are verified. An actual test transfer, receipt/logo delivery through WhatsApp, physical screening and production deployment remain to be verified manually.
