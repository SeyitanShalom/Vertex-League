# Vertex League — agreed requirements

This file records the decisions from the requirements discussion. Implementation stays in test mode until the organizer finishes testing and provides live configuration.

- One football competition, with no fixed team limit.
- Brand colors: navy `#000080` is the main color; yellow `#ffd800` is the accent.
- White page backgrounds, navy text and key controls, with yellow accents.
- Primary typeface: Mark Pro, paired with Anton for display headings. Supplied local font files are loaded automatically; Manrope remains available as a fallback.
- Team and manager information is collected online; player details are collected at physical screening.
- Managers create an email/password account and confirm their email before Phase 1. The verified email is prefilled; contact phone and WhatsApp are entered separately. One manager account owns one team per environment. Unfinished form details can be saved as a cross-device draft without reserving a place. **Save & continue to payment** submits the team and opens Phase 2 with bank details and an account-number copy control.
- Team logos/images are sent directly in the organizer's WhatsApp chat alongside payment receipts. There are no logo/image upload forms on the website.
- One team per manager; repeated team registrations are blocked.
- Test fee: NGN 100. Live fee: NGN 34,000. Each registration keeps its original fee snapshot.
- Manual bank transfer; receipt and team logo submission through a standard WhatsApp chat link.
- WhatsApp does not attach files, send messages, confirm receipt, or synchronize acknowledgment with the website.
- Only the authorized organizer's **Payment received** action confirms money arrived and provisionally books a place.
- Physical team/player screening takes place after the registration deadline.
- Only a separate **Approve team** action after verified payment and a confirmed screening pass completes entry.
- Teams can correct details and resubmit payment proof under the same reference.
- Paid teams that fail eligibility approval receive the full fee actually paid, with no deductions.
- Refunds are transferred manually and recorded separately after completion.
- Older registrations can be linked once using the prior private link and a confirmed account matching the registration email. The link stops working after claim; unclaimed legacy registrations retain access during migration. Registrations without a matching email require organizer-assisted identity checks.
- All initial registration, bank, and contact configuration is for testing. Test entries are excluded from live mode.

## Working policies selected for the first version

- Managers can edit submitted details before the deadline. After payment, an admin can explicitly enable corrections. Approved/rejected records are locked for manager edits.
- Duplicate names are normalized for case, punctuation and spacing. A manager's primary/WhatsApp number cannot be reused for another team, including cross-field reuse.
- Phone-based duplicate checks do not establish a person's legal identity. Physical screening must catch identity misrepresentation or someone using entirely different numbers. No identity documents are collected online.
- There is no player roster, match scheduling, score reporting, automatic bank reconciliation, WhatsApp API, automatic refund transfer or public team directory.
- Eligibility criteria, competition format, dates, screening location and official assets remain organizer configuration. No invented competition facts are published.
- Test mode can exercise screening without a deadline; live mode requires a deadline and prevents approval before it passes.

## Operator inputs still required

Supabase test project credentials, enabled email/password Auth with email confirmation, a verified Resend sending domain and Supabase custom SMTP configuration, a generated token secret for legacy compatibility, test bank details, organizer WhatsApp number, initial administrator, and any dates/venues/rules ready to publish. An actual test transfer requires a valid bank account; sample account details only test presentation.
