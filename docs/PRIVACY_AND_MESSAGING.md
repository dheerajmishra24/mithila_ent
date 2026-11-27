# Privacy and messaging (Phase 7)

This phase covers three things that work together:

- the customer **Privacy Centre**: consent choices, data download, and requests to correct, complain or delete;
- the owner's **privacy queue**: handling those requests, including erasure;
- **courier updates** from Shiprocket and **e-mail bounces and spam complaints** from Resend.

Database: migration `supabase/migrations/0055_privacy_and_messaging.sql`. It has been applied locally only, not yet in production.

## What customers see

`/account/privacy` (link "Privacy Centre" in the account menu)

- **Choices.** There is one switch per purpose: offer e-mails, WhatsApp offers, and ad measurement with Google and Meta. Every switch starts off, and each one is saved on its own. Each change is stored with the version of the privacy notice it was made under (`NOTICE_VERSION` in `src/lib/dal/privacy.ts`). Turning ad measurement off also:
  - marks the person's enquiries (leads) as not consenting;
  - removes the ad click IDs from those enquiries;
  - cancels any conversion events still waiting to be sent.
- **Download my data.** A JSON file containing:
  - the account and profile;
  - orders;
  - swatch credit;
  - consent history;
  - privacy requests;
  - enquiries made with the same e-mail.
  
  Each download is logged as an access request. The limit is 10 downloads per day.
- **Requests.** The customer can ask us to correct their data, raise a complaint, or delete their account. Deletion needs an extra "I understand" tick. An open request can be withdrawn. If a request is refused, the form keeps what the customer chose and typed.
- **Grievance officer.** Shown from `GRIEVANCE_OFFICER_NAME` and `GRIEVANCE_OFFICER_EMAIL`. If these are not set, the page links to the contact page.

`/account/orders` shows the courier name and AWB. It also shows a "Courier updates" panel with the expected delivery date, the latest status, and up to 12 scans.

## What the owner sees

`/admin/privacy` (menu item "Privacy")

- **Request queue.** Shows open requests, or all of them. A request is marked overdue after 30 days. For each request the owner can set it to "In progress", "Completed" or "Declined". Declining needs a reason.
- **Erase now.** Only for deletion requests; the owner must type `ERASE`. This:
  - deletes the account, the profile data, consent history, and all linked enquiries, including merged duplicates;
  - removes queued e-mails to that address;
  - removes the customer's e-mail and phone from the order addresses.
  
  Orders and invoices are kept because GST law requires them. Erasure is refused for staff accounts and for anyone with an order that is paid or shipped but not yet delivered.
- **E-mail addresses on hold.** Lists addresses that bounced or marked our mail as spam. "Allow again" removes the hold. Use it only after the customer confirms the address works.

On `/admin/orders/[id]`, the tracking box now has separate Courier and AWB fields. An AWB can be on only one order.

## Settings (environment variables)

| Variable | Used for | Without it |
|---|---|---|
| `SHIPROCKET_WEBHOOK_TOKEN` | Shared token Shiprocket sends as `x-api-key` | Courier webhook rejects every call (401) |
| `RESEND_WEBHOOK_SECRET` | `whsec_…` signing secret from the Resend webhook page | E-mail webhook rejects every call (401) |
| `GRIEVANCE_OFFICER_NAME`, `GRIEVANCE_OFFICER_EMAIL` | Shown in the Privacy Centre | Privacy Centre links to the contact page instead |

Use a long random value for the Shiprocket token. Never put either secret in the code or in `.env.example`.

## Connecting Shiprocket

1. Shiprocket → Settings → API → Webhooks.
2. URL: `https://<your domain>/api/webhooks/courier`. Shiprocket does not accept URLs that contain the words shiprocket, kartrocket, sr or kr, and this path contains none of them.
3. Security token: the value of `SHIPROCKET_WEBHOOK_TOKEN`.
4. Our endpoint answers 200 to every authenticated call, including bodies it cannot use. A bad token gets 401, a body over 256 KB gets 413, and a database error gets 500 so that Shiprocket retries.

How updates are matched and applied:

- An update is matched to an order by AWB first. If no order has that AWB, it is matched by our order reference (`order_id` in the payload: the full order ID, or the 8-character short ID), but only for an order that has no AWB yet.
- The order status only moves forward: paid → shipped → delivered.
- A late or repeated update never moves the status back.
- Repeated deliveries of the same scan are stored once.
- A move to shipped or delivered e-mails the customer.
- Labels such as RTO, UNDELIVERED, LOST or DAMAGED, and any return shipment, e-mail the owner a "Delivery problem" alert.

Not confirmed from Shiprocket's documentation: the full table of numeric status IDs, and a public tracking-page URL. The code therefore works from the status labels, and it does not link to an external tracking page.

## Connecting Resend

1. Resend → Webhooks → Add endpoint: `https://<your domain>/api/webhooks/email`.
2. Events: `email.bounced` and `email.complained`.
3. Copy the signing secret into `RESEND_WEBHOOK_SECRET`.

How events are handled:

- The signature is checked over the raw body using the Resend SDK. The check rejects a wrong key, an edited body, a timestamp more than 5 minutes old, or missing headers, all with 401.
- Each message ID is recorded once, so Resend's retries do no harm.
- A permanent bounce or a spam complaint puts the address on hold. A temporary bounce does not.
- Queued e-mails to an address on hold are marked failed with the reason "Not sent: address on hold (…)". They are not retried.

## Rollout order

1. Deploy the code. The new pages work against the existing database only after step 2, so do both in the same window.
2. Apply migration `0055_privacy_and_messaging.sql` (after 0050–0054).
3. Set the environment variables above, then add the two webhooks.
4. Send a Shiprocket test webhook and a Resend test event, and check they appear: the order page for Shiprocket, and the hold list for a test complaint.

## Things for the owner, CA or lawyer to confirm

- **Reply time.** The system flags requests after 30 days. That is our internal target. Have a lawyer confirm the period the DPDP Rules require.
- **Retention.** Orders, invoices and payment records are kept after erasure for GST purposes. Raw Razorpay webhook payloads also keep contact details for financial records. Agree with your CA how long to keep each.
- **Grievance officer.** Name and e-mail are the owner's to set.
- **Breach response.** If personal data leaks:
  - write down what happened and when;
  - rotate the affected keys;
  - tell affected customers and the Data Protection Board within the time the Rules set.
  
  The detailed runbook is still to be written.
- **Not built yet.** A block on ad measurement for under-18s, an automatic retention/clean-up job, and WhatsApp courier updates (these need an approved utility template).

## Evidence

Code:

- Token check: `src/app/api/webhooks/courier/route.ts:25`
- Size cap: `src/app/api/webhooks/courier/route.ts:30`
- Unusable body ignored with 200: `src/app/api/webhooks/courier/route.ts:41`
- Database call: `src/app/api/webhooks/courier/route.ts:45`
- Signature check over the raw body: `src/app/api/webhooks/email/route.ts:40`
- Hold list enforced in the e-mail queue: `src/lib/email.ts:203-210`

Database, in `supabase/migrations/0055_privacy_and_messaging.sql`:

- RLS enabled on all five tables: lines 118–122.
- Read policies:
  - "Own consent or owner", line 134;
  - "Own requests or owner", line 138;
  - "Scans of own orders or owner", line 142;
  - "Owner reads suppressions", line 151.
- The consent view is `security_invoker`: line 34.

Tests, run locally on 2026-11-27:

| Suite | Result |
|---|---|
| `npm test` (includes `tests/privacy-messaging.test.ts`) | 148 passed |
| `supabase test db` (includes `18_privacy_messaging_test.sql`) | 18 files, 496 tests, PASS |
| `supabase db lint --level warning` | no issues |
| Red-team (includes `tests/security-redteam/privacy-messaging.test.ts`) | 50/50 passed |
| E2E (`tests/e2e/privacy.spec.ts`, desktop and mobile) | 3 passed, 1 skipped (runs on desktop only) |
