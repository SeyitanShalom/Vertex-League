# Local verification — 16 October 2026

- `npm run lint`: passed. Additional lint for the final screenshot script and dashboard-query tests also passed.
- `npm run typecheck`: passed; the final production build also passed its TypeScript stage.
- `npm test`: **51 tests passed** across validation, state rules, WhatsApp/CSV helpers and actual SQL migrations executed in PGlite.
- `npm run build`: passed with the final typography and site icon. Next.js generated all public, private and admin routes successfully.
- `npm run test:browser`: **6 tests passed** in desktop and mobile Chrome. Checked navigation, FAQ interaction, form setup states, phone-number convenience control, unauthorized private/admin/export/logo access, security headers, CSP nonce rotation, private-link fragment removal and horizontal overflow.
- Production dependency audit: **0 known vulnerabilities** reported by `npm audit --omit=dev`. The full audit reports five development-tool advisories through `braces`; see SECURITY.md.
- Desktop and mobile landing/registration screenshots were rendered and visually inspected. An initial overly heavy headline was corrected. Preview captures are stored under ignored `test-results/` and can be refreshed with `node scripts/capture-preview.mjs` while the production server runs on port 3100.
- `git diff --check`: passed; Git's Windows line-ending notices are informational.

Initial verification found and corrected a JSX typo, an MFA factor-list typing issue, React lint issues and two ambiguous browser-test selectors. The final reference generator was also tested beyond six digits.

No Supabase credentials or bank/contact details were supplied. Hosted database persistence, PostgREST nesting, Auth/MFA lifecycle, storage uploads, an actual bank transfer, WhatsApp on real devices, refund transfer and organizer screening remain **unverified externally**. Registration and admin sign-in correctly remain in setup states until configured. No public deployment or real payment was performed.

## Brand color update

Applied the supplied navy `#000080` as the main color and yellow `#ffd800` as the accent across the shared theme, pitch illustration and site icon. The production build (including TypeScript) and lint for the changed components passed. Refreshed and inspected desktop/mobile landing and registration captures; registration layouts fit their 1440px and 390px viewports. Yellow on the main navy has a calculated contrast ratio of 11.49:1. Business-workflow tests were not repeated for this styling change.

## White backgrounds and typography update

Changed page backgrounds and form surfaces to white, with navy text and controls, yellow accents, and light-mode success/warning/error colors. Mark Pro is the requested primary font and Anton is the display companion; actual Mark Pro font files are still missing. The current rendered body font is the bundled Manrope fallback. Development/build hooks prepare local font-face declarations when the supplied files are added under `public/fonts`, without requesting missing font URLs.

The production build, TypeScript stage, and lint for the changed pages/layout/font helper passed. Refreshed and inspected desktop/mobile landing and registration captures; registration widths match their 1440px and 390px viewports. Navy on white has a calculated contrast ratio of 16.01:1; body secondary text is 6.39:1. Business-workflow tests were not repeated because the changes affect presentation and font setup only. Mark Pro rendering must be checked again once the actual font assets are supplied.

## Mark Pro activation — 17 October 2026

The supplied `public/fonts/MarkPro.otf` is now recognized as the regular face alongside the `MarkPro-Regular` naming convention. The font preparation script generates 20 declarations covering the supplied weights and italics; weights match the font files' metadata. Anton remains the display typeface and Manrope remains a fallback.

Production build (including TypeScript), lint for the font helper, formatting, and whitespace checks passed. Chrome's rendered-font inspection confirmed `MarkPro` for body copy, `MarkPro-Bold` for buttons, and `MarkPro-BlackItalic` for the brand mark; the hero heading renders with Anton. Landing and registration pages returned HTTP 200 with no page errors or failed font requests on desktop and mobile. Page widths match their 1440px and 390px viewports. Updated captures are stored under ignored `test-results/mark-pro-*.png`. These checks cover the local production build; no deployment was performed.

## Phased registration and WhatsApp logo handoff — 17 October 2026

Registration is labeled Phase 1 and payment is labeled Phase 2. Saving the team/manager form opens the private payment page directly, without an intervening logo upload. The registration form, payment instructions, private status page, landing-page steps, FAQs and prefilled WhatsApp message now direct managers to send their receipt and team logo in the organizer's chat. The registration and private-page upload controls and upload Server Action have been removed. Previously stored logo data and authorized read access are preserved.

The production build (including TypeScript), lint for the changed source files, formatting and whitespace checks passed. All **51 domain/database tests** and **6 desktop/mobile browser checks** passed. Additional Chrome inspection confirmed the Phase 1 label, WhatsApp logo instructions, zero file inputs, no page errors and no horizontal overflow at 1440px and 390px. The registration form captures were visually inspected and are stored under ignored `test-results/phases-*.png`.

This environment still has no configured Supabase, bank or organizer WhatsApp settings. Browser checks exercise the setup state and access restrictions; successful hosted registration creation, the authenticated payment view, a real transfer and WhatsApp file delivery remain unverified externally. The existing manual payment confirmation, physical screening, final approval and full-refund rules are unchanged.

## Hosted Supabase test database — 17 October 2026

Connected to the organizer's empty test project `zoobdteyjoxrejskicxh` through the authenticated project-scoped Supabase MCP connection. Applied the three planned migrations and an advisor-driven hardening migration. Local SQL filenames match the actual hosted migration history:

| Version          | Migration                   |
| ---------------- | --------------------------- |
| `20261017201723` | `vertex_league`             |
| `20261017201726` | `admin_queries`             |
| `20261017201732` | `logo_updates`              |
| `20261017202108` | `database_access_hardening` |

Verified all nine application tables exist with RLS enabled, registration/admin functions are present, anonymous table reads and mutation RPCs are denied, and registration creation is executable by the server role only. Test settings are NGN 100 with registration enabled; live settings remain NGN 34,000 with registration disabled. The compatibility logo bucket is private; website uploads remain removed.

The hardening migration revokes public/anonymous/authenticated execution of Supabase's platform-provided `rls_auto_enable` event-trigger helper without disabling its trigger, caches row-independent policy checks per query, and adds the four missing administrator foreign-key indexes. Hosted checks confirmed the trigger still automatically enables RLS on newly created tables. The initial anonymous-function and RLS query-plan warnings are resolved. The performance advisor now reports only unused-index information, expected for a new database.

The security advisor still reports four intentional authenticated `SECURITY DEFINER` endpoints: `is_vertex_admin`, `admin_registration_stats`, `admin_list_registrations`, and `admin_registration_action`. The three admin RPCs refuse access without the allowlist and MFA; the helper only reports the caller's authorization status and supports admin RLS policies. All four use a fixed search path, and anonymous execution is revoked. They remain available for the authenticated organizer workflow. The two RLS-without-policy notices for `manager_contacts` and `rate_limit_buckets` are intentional: both tables are server-only with no API role grants.

A hosted transaction exercised actual registration creation at NGN 100 with pending payment, idempotent retries, duplicate-manager rejection, anonymous permission denial, and denial of administrator statistics/payment actions to a signed-in non-admin even with an MFA claim. The transaction was rolled back: zero registrations remain and its probe table was removed. Sequence gaps after transaction rollback are expected. The local regression suite applies every migration in filename order and all **51 tests passed**.

This completes database initialization. Website-to-Supabase environment configuration, organizer Auth/MFA provisioning, an authenticated browser registration/payment journey, an actual transfer and WhatsApp file delivery still require configuration and verification. No deployment or external payment was performed.

## Local environment configuration — 17 October 2026

Configured the test project's verified API URL and active modern publishable key in the ignored `.env.local` file, and generated a 48-byte random private-link token secret locally. The application uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Test mode and the localhost site URL are configured.

Next.js environment loading confirms the expected project URL, publishable key and sufficiently long token secret. A read-only request from the local Node runtime to the project's Auth settings endpoint returned HTTP 200 with the publishable key. The organizer then saved the server-only secret key and bank/WhatsApp details locally. The bank account number and international WhatsApp number pass the application's format checks.

A read-only Supabase query using the saved server secret returned HTTP 200 and confirmed test mode, the NGN 100 fee and enabled registration. The running local development website's `/api/health` endpoint returned HTTP 200 with `status: ready`. Chrome inspection of `/register` returned HTTP 200, confirmed the team field, enabled Save & continue to payment button, visible NGN 100 fee, no setup notice, zero file inputs and zero page errors. Neither server secret nor private-link secret appeared in the rendered registration HTML. These checks did not submit a registration.

Local environment configuration is complete. Organizer Auth/MFA provisioning, a successful browser registration/payment journey, an actual transfer and WhatsApp file delivery remain pending. No deployment or payment was performed.

## Centered competition-logo hero — 17 October 2026

Adapted the selected [Modern Hero Section by ravikatiyar162](https://21st.dev/@ravikatiyar162/components/modern-hero-section) into a centered homepage introduction. Replaced the photo collage with the organizer's existing Vertex Premier League, Vertex Championship League and Vertex FA Cup PNG logos in three adjacent columns. Each logo uses the reference's gentle six-second floating motion with staggered phases. Logo columns remain aligned when their captions wrap, including narrow phones, and the existing reduced-motion preference disables the animation. The source logo files are preserved and served through Next.js image optimization. The hero uses Mark Pro with the existing navy, yellow and white palette.

The production build, including TypeScript, targeted source lint, formatting and whitespace checks passed. Chrome checked the local production preview at 1440px, 768px, 390px and 320px: all three logos loaded side by side, the heading was centered, floating movement was observed, reduced motion stopped it, and there was no horizontal overflow or page error. The hero's registration link opened the enabled registration form. The website health endpoint returned HTTP 200 with `status: ready`.

Refreshed desktop/mobile preview captures and the four-viewport check results are under ignored `test-results/competition-hero-*`. The checks cover the local production build; no deployment or registration submission was performed.

## Development runtime recovery — 17 October 2026

Investigated the reported development overlay error `undefined`. The previous development log contained a browser `unhandledRejection: undefined` after a hot refresh, without an application stack identifying its source. Fresh Chrome loads did not reproduce that original rejection, so its precise cause is still unconfirmed.

Found a development server and the earlier production preview sharing port 3000 on different addresses. Stopped the verified production preview, preserved the old generated development cache as a backup inside ignored `.next`, and restarted this project's development server on `127.0.0.1:3000`. The original development log is preserved under ignored `test-results/runtime-dev-before-restart.log`. Temporary diagnostic CSS was removed. Development startup also refreshed Next.js's managed feedback instructions in `AGENTS.md`.

Corrected a separate Next.js 16 smooth-scroll warning by adding `data-scroll-behavior="smooth"` to the root HTML element, matching the site's existing CSS and the [Next.js guidance](https://nextjs.org/docs/messages/missing-data-scroll-behavior). No global promise-rejection suppression was added.

After restart, Chrome checked three desktop homepage loads, mobile rendering, and navigation into the enabled registration form. Final desktop/mobile checks with the corrected markup reported zero runtime errors, console warnings or unhandled rejections; all three logos loaded. The current development log has zero errors or unhandled-rejection entries, and `/api/health` returned HTTP 200 with `status: ready`. Layout lint, formatting and whitespace checks passed. Captures and diagnostic results are stored under ignored `test-results/runtime-*`. An existing browser tab should be hard-refreshed to replace its old development assets and overlay state.

## Blue Jade Sky hero background — 17 October 2026

Adapted the selected [Jade Sky by Serafim](https://21st.dev/@serafimcloud/components/jade-sky), preserving its four radial-gradient positions, stops and soft blur while replacing the green palette with light and medium blues. The decorative background fills the hero behind the content, is hidden from assistive technology and does not intercept clicks. It uses the existing CSS pipeline with no new dependencies or client JavaScript. Navy and secondary hero text have minimum calculated contrast ratios of 8.03:1 and 4.90:1 respectively against the palette. The three original competition logos retain their floating animation and reduced-motion support.

The final production build, including TypeScript, targeted component lint, formatting and whitespace checks passed. Chrome checked the production preview at 1440px, 768px, 390px and 320px: the blue background filled the hero, all three logos loaded side by side, floating motion and reduced-motion behavior worked, and there were zero runtime errors, console warnings or horizontal overflow. The hero registration link opened the enabled Phase 1 form on desktop and mobile. Desktop and phone captures were visually inspected; previews and check results are under ignored `test-results/jade-sky-*`. No registration was submitted and no deployment was performed.

## Fixed background across every page — 17 October 2026

Moved the blue Jade Sky layer into the root layout so every HTML page shares one decorative, viewport-fixed background. Main sections, the header and the closing callout are transparent; form panels, fields and cards keep their white surfaces. The fixed layer stays behind content and ignores pointer input. Global secondary text now uses the darker blue that retains at least 4.90:1 calculated contrast against the gradient palette.

The production build (including TypeScript), targeted lint and source formatting passed. Chrome verified fixed viewport dimensions and unchanged background colour samples while scrolling the homepage at 1440px, 768px, 390px and 320px, including the footer. Desktop/mobile checks also covered registration, private-link access and organizer sign-in, with the same background during scrolling. Client navigation preserves the single background layer; the enabled registration form and mobile menu work. There were zero runtime errors, console warnings or horizontal overflow. Desktop/mobile captures were visually inspected. Results and previews are under ignored `test-results/fixed-background-*`. No registration was submitted or deployment performed.

## Development stylesheet recovery — 17 October 2026

Reproduced the missing background on fresh localhost and IP-address development loads: the root layout contained the current background element, but the served stylesheet still had earlier hero rules and left the new layer static with zero height. A temporary CSS edit did not appear in the open page within 12 seconds; reloading picked up the new stylesheet. Previous fixed-background checks covered the production preview, which did render correctly.

Replaced the custom Tailwind Turbopack loader with the [documented Tailwind/PostCSS setup](https://tailwindcss.com/docs/installation/framework-guides/nextjs), using the matching 4.3.3 plugin, standard PostCSS configuration and updated npm lockfile. Preserved the old generated development cache inside ignored `.next` before restarting the development server on port 3000. The background design, fixed positioning, form surfaces and security headers are unchanged.

Chrome confirmed two stylesheet changes and their removal applied live without a document reload; the temporary diagnostic was fully removed and the stylesheet hash matched its original value. The fixed gradient survived a fresh reload. Both development and production passed background, scrolling, navigation and overflow checks at 1440px, 768px, 390px and 320px. Registration, private-link access and organizer sign-in showed the same background on desktop/mobile; registration stayed enabled and the mobile menu worked. Final browser runs had zero runtime errors or console warnings. Desktop and mobile development captures were visually inspected. The production build including TypeScript, configuration lint, formatting and whitespace checks passed.

The browser diagnostic now tracks background identity in memory; its earlier temporary DOM attribute caused a test-only hydration warning and was removed from the check. Verification results and captures are under ignored `test-results/background-recovery-*` and `test-results/css-refresh-checks.json`. The development server remains running for the organizer. No registration was submitted or deployment performed.

## Visible background motion — 17 October 2026

Confirmed the original animation was running with reduced motion off, but the measured background colour change was barely visible. Replaced the subtle whole-gradient drift with independent soft blue and light clouds. The clouds travel over eight and ten seconds and reverse smoothly, beginning at staggered phases. The original Jade Sky gradient remains as the fixed base, with the same blue palette and reduced-motion support.

The new browser check pauses foreground animations and compares actual background pixels between live screenshots. Both desktop and mobile showed substantial colour changes in development and production, remained fixed while scrolling, respected reduced motion, and reported zero browser errors or warnings. Desktop captures were visually inspected. The production build including TypeScript, CSS formatting and whitespace checks passed. Screenshots and measured results are under ignored `test-results/visible-background-*`. No deployment or registration submission was performed.

## Organizer MFA and hosted workflow verification — 20 October 2026

The organizer account is allowlisted and has a verified authenticator factor. Public Auth signups are disabled. The organizer confirmed that signing in and completing authenticator setup opens the dashboard; a fresh server-side check also confirmed the verified factor. Passwords, setup keys and authenticator codes remain private.

Fixed three issues found while exercising the configured test project. Registration and correction validation now accept optional fields normalized to `null` by the browser form. Authenticator SVG data URLs are encoded before rendering, preventing the QR setup crash caused by raw whitespace and URL fragments. Refund reads now match the hosted one-to-one relationship, which returns an object or `null`; this repairs the organizer detail page and the manager's pending/completed refund views.

All **58 domain/database tests** passed, including new cases for normalized optional fields and QR rendering. Standalone TypeScript, targeted source lint, whitespace checks and the production build passed. An interrupted development browser run was not counted as successful; the complete admin journey was checked against a clean local production preview instead.

The hosted checks used temporary test registrations, a temporary allowlisted administrator, and a real Supabase TOTP session. They verified idempotent registration creation at NGN 100, denial of mutations without both allowlisting and MFA, and denial of direct status updates. Browser checks covered the dashboard and filtered CSV export, the Payment received confirmation dialog, provisional booking with screening still required, recovered private-link access, pending/completed refund displays, the organizer refund reference and sign-out. Hosted actions additionally checked corrections, revocation of the old private token, hidden internal notes, screening approval, paid rejection, full-fee refund recording and the corresponding audit events. The production browser journey emitted no runtime errors.

Earlier browser registration checks successfully saved a pending registration and opened its private payment page, inspected the saved-access download and WhatsApp handoff link, and checked duplicate rejection. The longer multi-registration browser run did not finish and is not reported as a complete end-to-end pass. Financial and screening actions in the admin checks were simulated: no bank transfer, WhatsApp message/file delivery, physical screening or production deployment was performed. The remaining manual acceptance check is an actual NGN 100 test transfer followed by receipt/logo delivery in WhatsApp and organizer confirmation after checking the bank account.

The scripts remove only their marked temporary teams, registrations, payment/refund/audit rows and temporary Auth accounts. The original organizer account and existing test registration are preserved. The full admin-check report is stored under ignored `test-results/hosted-admin-results.json`.

The local Turbopack development session repeatedly stalled on the organizer detail page or interrupted hydration. After switching to Next.js's supported Webpack development mode, a fresh browser check passed the dashboard, CSV export, detail page and Payment received dialog/action with no runtime errors. `npm run dev` now selects Webpack; the production build continues to use Turbopack. The focused development report is under ignored `test-results/hosted-dev-dialog-results.json`. The development server remains available at `http://localhost:3000`.

## WhatsApp Web handoff — 20 October 2026

Added **Use WhatsApp Web** beside the receipt/logo action on the private payment page and the logo action on the private status page. The browser option uses an HTTPS link directly to WhatsApp Web, avoiding the Windows desktop-protocol association required by the app handoff. Both options preserve the same organizer number and encoded registration message; invalid contact numbers still produce no link. The page explains how to use the browser option when the desktop app is unavailable. Managers still attach files and press Send themselves, and payment verification remains an organizer action.

All **31 domain tests**, targeted lint and the production build including TypeScript passed. Chrome checks at 1440px and 390px confirmed visible browser actions on both private pages, preserved recipient/message, no private-access token in the outgoing text, no horizontal overflow and zero browser runtime errors. Clicking the new action opened a browser popup with the expected HTTPS destination. All WhatsApp requests were intercepted locally during verification: no desktop protocol was invoked or message sent. Read-only checks used the existing test registration and confirmed its registration/payment state was unchanged; no probe registration was created.

The payment action rows were visually inspected at both widths. The payment popup was also exercised on the development site at `localhost:3000`. That browser run stopped on the status page's first compilation after 120 seconds; a focused follow-up returned HTTP 200, confirmed the browser action in the status markup and confirmed unchanged registration/payment state. The interrupted development run is not counted as a complete browser pass. Captures and reports are under ignored `test-results/whatsapp-actions-*`, `test-results/whatsapp-web-production-results.json` and `test-results/whatsapp-web-dev-status-results.json`. WhatsApp account linking, receipt/logo attachment and delivery still require the manager's manual verification. No deployment was performed.

## Single WhatsApp choice page — 20 October 2026

Replaced the separate app/browser actions with one receipt/logo button on the payment page and one logo button on the status page. The shared WhatsApp link now opens `https://api.whatsapp.com/send` with `autoload=0`, preserving the organizer and encoded message while waiting for the user to choose an app. Existing organizer/contact links use the same shared behavior. The page hints and troubleshooting instructions explain choosing the app or WhatsApp Web on the next page.

A fresh Chrome session on WhatsApp's real public page, using a dummy number, confirmed visible **Open app** and **Continue to WhatsApp Web** choices. Browser navigation events confirmed no automatic request to the `whatsapp:` desktop protocol with `autoload=0`; the default landing page did request that protocol. Neither choice was pressed during the external check.

All **30 domain tests**, standalone TypeScript and targeted lint passed. Read-only Chrome checks on `localhost:3000` passed at 1440px and 390px for both private pages: exactly one handoff action per purpose, no separate browser button, the correct choice-page URL, preserved recipient/reference, no private token in outgoing text, no overflow and zero browser runtime errors. Outgoing WhatsApp popups were intercepted locally, and registration/payment state was unchanged. The first run stopped during the status page's slow initial development compilation; the subsequent complete run passed and is the recorded result.

Results and captures are under ignored `test-results/whatsapp-choice-results.json`, `test-results/whatsapp-choice-*.png` and `test-results/whatsapp-single-button-landing.png`. This iteration was verified in the development runtime; the production build was not repeated. Sending files/messages and account linking remain manual. No deployment was performed.

## Test registration cleanup and final checks - 23 October 2026

Added an organizer-only delete control to each test registration row and detail page. It requires MFA, the exact reference and confirmation that no bank payment was received. The database refuses live, paid, reviewed, refunded and badge-bearing records. Successful deletion removes the linked test team, contacts, pending payment and submission audit, then retains a minimal deletion audit event.

The complete local suite passed: **89 tests across four files**, plus TypeScript, lint, the production build and `git diff --check`. An initial sandboxed browser run passed four of six checks; its two private-link checks were affected by intermittent Supabase access. The app was then started as a connected local production preview, its `/api/health` returned `ready`, and the browser test was adjusted to wait for the network-dependent invalid-link result and to accept either legitimate health state. The complete rerun passed **8 of 8 desktop/mobile browser checks**. The preview remains at `http://127.0.0.1:3100`.

The hosted test project recorded seven migrations, and `supabase/verify-setup.sql` reported all seven migration checks true. After the organizer confirmed neither old team paid, a guarded cleanup removed exactly the two legacy test registrations from October 20-21. Read-only verification showed zero test registrations, teams, contacts, payments and refunds, with two deletion audit events. One unfinished manager draft was preserved. The new admin button has not been exercised with a real hosted MFA session or deployed to Vercel in this run.
