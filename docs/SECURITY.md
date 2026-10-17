# Security model and verification limits

## Boundaries

- Administrative login uses Supabase Auth, a separate `admin_members` allowlist, server-validated users, and mandatory TOTP MFA (`aal2`). There is no public admin signup. Every privileged server action authorizes again.
- All application tables have RLS. Anonymous/authenticated grants are explicitly revoked, then only the required reads/RPC execution are granted. Database mutation functions enforce the admin allowlist and MFA themselves. Administrators cannot directly update status columns through the Data API.
- The Supabase secret/service-role key is imported only by `server-only` modules. It bypasses RLS, so public server operations validate ownership and inputs before using it. Never publish this key.
- A sequential reference is not a credential. Access requires a 256-bit token, stored as a SHA-256 hash. New registration retries derive the same token using a server-secret HMAC and an unpredictable submission key. Database idempotency checks include the payload and token hashes.
- Private links use URL fragments. The access page clears the fragment and exchanges it for a Secure-on-HTTPS, HttpOnly, SameSite=Strict cookie. No access tokens appear in query strings or WhatsApp messages. Link recovery rotates the hash, invalidating old cookies/links.
- Anyone holding a private link can act as that team manager. Treat the saved file/link as a credential. Production request/response capture and analytics must exclude private pages, cookies, Server Action bodies and URL fragments. Browser extensions and anyone with access to the manager's device are outside this application's trust boundary.
- Private pages and image responses are not cached; private pages are excluded from indexing. There are no third-party analytics or remote presentation assets. CSP uses a fresh script nonce per response, blocks framing/objects, and restricts scripts to the application. Inline styles are allowed for framework/UI compatibility.
- Next.js Server Actions provide their built-in origin validation. Form values are validated with Zod on both client and server. Fees and cutoff decisions come from trusted database settings.
- PostgreSQL functions create team/contact/registration/payment rows atomically. A sequence generates references; uniqueness constraints enforce duplicate rules. A locked settings row serializes capacity decisions if an optional cap is configured.
- Registration/correction/link-unlock/auth operations use persistent, atomic rate-limit buckets. Only trusted Vercel ingress IPs are used when explicitly enabled; otherwise callers share a conservative bucket. This is a baseline limiter, not full DDoS protection.
- The website has no file upload forms or upload Server Action. Payment receipts and team logos are sent manually in the organizer's WhatsApp chat; opening that chat does not confirm receipt or payment. Previously stored logos remain private and are served through an authorized, non-cacheable endpoint.
- Payment, screening, rejection and refund mutations are transactional and audited. A rejection after verified payment creates a refund obligation. A completed refund always uses the stored full fee, never a client-provided amount. Internal notes/reasons are not exposed to managers; correction instructions are intentionally public to that manager.
- CSV export requires MFA/administrator access and escapes spreadsheet formulas. It streams paginated results, with an export error interrupting the stream rather than fabricating records.

## Required live verification

Local PostgreSQL tests exercise the actual migrations using PGlite, with a minimal Auth/Storage schema shim. They validate SQL, grants, RLS, role checks, state changes, uniqueness, fee snapshots, cutoff rules, and audits. They do not prove Supabase's hosted Auth, Storage, PostgREST relation inference, refresh-cookie behavior, concurrent sessions, infrastructure or backup configuration.

Before live opening, use a separate hosted Supabase project to exercise the complete flow with two browsers: register, duplicate attempt, transfer, WhatsApp handoff, payment received, permitted corrections, screening approval, rejection, full refund, private-link recovery, admin session expiry/MFA, and CSV export. Attempt cross-team access and unauthorized direct API mutations. Review Supabase Security Advisor, database grants, storage policies, Auth signup settings, HTTPS, backups/restore and deployment logs. Keep dependencies and runtime patched.

## Dependency advisory

The initial full audit reports a stack-exhaustion advisory in `braces`, inherited through development-only Next.js ESLint tooling (`fast-glob`/`micromatch`). The advisory currently lists no patched version. Do not apply the suggested framework downgrade automatically. Production dependencies audit separately with `npm audit --omit=dev`. Track [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) and update when a compatible patch is available. Re-run both audits before release.
