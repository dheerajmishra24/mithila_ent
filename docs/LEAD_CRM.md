# Lead CRM: setup and operations

Every enquiry lands in one table, `public.leads`, whatever its source:

| Source | How it arrives |
|---|---|
| Contact page | `POST /api/contact` |
| Wholesale form | `POST /api/wholesale` |
| Meta (Facebook/Instagram) lead ads | Webhook `POST /api/webhooks/meta-leads`, then the lead is fetched from the Graph API |
| Google Ads lead forms | Webhook `POST /api/webhooks/google-leads` |

The owner works the pipeline at **Owner Portal → Leads** (`/admin/leads`): new → contacted → qualified → won / lost / spam. You need the owner role and a recent second factor (see `docs/ADMIN_TWO_STEP.md`).

## How it behaves

- **One person, one lead.** A new enquiry from the same e-mail or phone joins the existing lead and adds a history entry. This includes leads that were merged away. A `lost` lead that writes in again reopens as `new`.
- **Replays are harmless.** Each webhook delivery is stored once per `(source, external id)`, enforced by a unique index on `lead_events`.
- **Duplicates the system can't be sure of** (same name, different contact details) appear under "Possible duplicates" on the lead page. **Merge here** moves the other lead's history into this one. Nothing is deleted.
- **CSV export** (`/admin/leads/export`, using the current filters) is owner-only and served with `no-store`. Cells that start with `= + - @` are neutralised so the file can't run formulas in Excel. Ad click IDs are never exported.
- All writes go through the database functions `lead_capture`, `lead_update` and `lead_merge` (migration `0054_lead_crm.sql`). Browser roles cannot write the tables directly.

## Consent model (DPDP)

- The website forms have a separate, **unticked, optional** box: *"let Mithila tell Google and Meta …"*. Ad click IDs (`gclid`, `gbraid`, `wbraid`, `fbclid`) and the `_fbp`/`_fbc` cookies are stored **only** when that box is ticked. Campaign tags (UTM) are always kept, since they don't identify the person.
- Leads from Meta and Google lead forms are stored with `ad_consent = true`, because the person submitted them on that platform under its terms. **Have a CA or lawyer confirm this.**
- Conversions are sent to an ad platform only when the lead has consent, has a click ID or Meta lead id for that platform, and is not a test lead.

## Reporting results back to the ad platforms

Moving a lead to **qualified** or **won** queues a conversion:

| Stage | Meta Conversions API event | Google Ads conversion action |
|---|---|---|
| qualified | `QualifiedLead` | `GOOGLE_ADS_QUALIFIED_ACTION_ID` |
| won | `Purchase`, with the order value in INR | `GOOGLE_ADS_WON_ACTION_ID`, with the order value in INR |

- **Meta:** e-mail, phone, first and last name, city and country are SHA-256 hashed after normalising (Indian phones get the `91` prefix). The Meta lead id, `fbc` and `fbp` are sent unhashed, as Meta requires. `META_CAPI_TEST_CODE` is sent only outside production (`VERCEL_ENV !== 'production'`).
- **Google:** uses the Data Manager API (`datamanager.googleapis.com/v1/events:ingest`), not the legacy click-conversion upload. E-mail (Gmail dots removed) and phone are hashed. Consent is sent as ad user data GRANTED, ad personalisation DENIED.
- Each conversion is tried up to 5 times: straight after the save, then by the daily job. The result shows on the lead page.
- If a platform isn't configured, its conversions wait in the queue and are sent once the keys are added.

## Environment variables (Vercel → Settings → Environment Variables)

Set these for Production. Without them the feature just stays off: forms still save leads, and webhooks answer 401/403.

| Variable | What it is |
|---|---|
| `META_APP_SECRET` | Meta app secret. Used to check `X-Hub-Signature-256` on webhooks (shared with the WhatsApp webhook). |
| `META_LEADS_VERIFY_TOKEN` | A random string you make up; type the same value into the Meta webhook setup. |
| `META_PAGE_ACCESS_TOKEN` | A long-lived **Page** access token with `leads_retrieval` (plus `pages_show_list`, `pages_read_engagement`, `pages_manage_metadata`). |
| `META_LEAD_FORM_IDS` | Optional comma-separated lead form IDs for the daily catch-up. Forms seen in the last 30 days are included automatically. |
| `META_PIXEL_ID` | The dataset / Pixel ID for the Conversions API. |
| `META_CAPI_TOKEN` | Conversions API access token, from Events Manager → Settings. |
| `META_CAPI_TEST_CODE` | Optional. From Events Manager → Test events. Never sent in production. |
| `GOOGLE_LEADS_KEY` | A random string you make up; type the same value as the "Key" in the Google Ads lead form webhook. |
| `GOOGLE_DM_CLIENT_ID`, `GOOGLE_DM_CLIENT_SECRET`, `GOOGLE_DM_REFRESH_TOKEN` | OAuth client and refresh token with scope `https://www.googleapis.com/auth/datamanager`, for a Google user who can access the Ads account. |
| `GOOGLE_ADS_CUSTOMER_ID` | The Ads account that owns the conversion actions (dashes are fine). |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | Optional. The manager (MCC) account, if you sign in through one. |
| `GOOGLE_ADS_QUALIFIED_ACTION_ID`, `GOOGLE_ADS_WON_ACTION_ID` | Conversion action IDs (type "Import → manual / API"). |
| `SUPPORT_EMAIL` | Where the owner alerts go (for example, an expired Meta token). |
| `CRON_SECRET` | Already used by the other scheduled jobs. |

`META_GRAPH_API_BASE`, `GOOGLE_OAUTH_TOKEN_URL` and `GOOGLE_DM_API_BASE` exist **only for local tests**. The app ignores them unless they point at localhost and the app isn't running on Vercel. Never set them in Vercel.

## Connecting the platforms

**Meta lead ads**
1. In the Meta app, open Webhooks → **Page**. Set the callback URL to `https://www.mithilaenterprises.co.in/api/webhooks/meta-leads` and the verify token to `META_LEADS_VERIFY_TOKEN`. Subscribe to the `leadgen` field.
2. Subscribe the app to the Page (`POST /{page-id}/subscribed_apps?subscribed_fields=leadgen`), or use the Leads Access Manager in Business Settings.
3. Submit a lead with Meta's Lead Ads Testing Tool. It appears in `/admin/leads` within seconds, marked **TEST LEAD** if Meta flags it.

**Google Ads lead forms**
1. In the lead form asset, open Lead delivery → Webhook. Set the URL to `https://www.mithilaenterprises.co.in/api/webhooks/google-leads` and the key to `GOOGLE_LEADS_KEY`.
2. Click **Send test data**. The test lead is stored with `is_test` and is never reported back as a conversion.

## Daily job

`/api/cron/leads` runs daily at 01:00 UTC (`vercel.json`). It:
1. retries Meta leads whose Graph fetch failed;
2. pulls the last 48 hours of leads from known Meta forms, catching anything a webhook missed;
3. sends queued conversions;
4. e-mails `SUPPORT_EMAIL` if Meta rejects the Page token.

The owner can also run step 1 from the Leads page (**Retry now**, shown while Meta leads are waiting).

New scheduled work should use Vercel Schedules (the `schedules` key). This job uses the existing `crons` entries so it matches the other jobs; move them together.

**When the Meta token expires:** the Leads page shows a warning and you get an e-mail. Make a new long-lived Page token with `leads_retrieval`, update `META_PAGE_ACCESS_TOKEN` in Vercel, redeploy, and press **Retry now** on the Leads page. Leads that arrived meanwhile are kept in the inbox and fetched then.

## Rollout order

1. Deploy the code. Until migration 0054 exists, the forms fall back to the old `contact_inquiries` / `wholesale_applications` tables, so nothing is lost.
2. Apply `supabase/migrations/0054_lead_crm.sql`. It creates the tables, copies the old enquiries into `leads`, and removes public insert on the old tables.
3. Add the environment variables, then connect Meta and Google as above.

## Tests

- `tests/leads.test.ts`: parsing, normalisation, hashing and payload shapes.
- `supabase/tests/17_lead_crm_test.sql`: RLS, grants, dedupe, merge and conversion queueing.
- `tests/security-redteam/lead-crm.test.ts`: forged and replayed webhooks, capture races, non-admin access, consent bypass, CSV injection.
- `tests/e2e/leads.spec.ts`: contact form to won with both conversions sent, and a Meta lead ad end to end with a merge. It runs against fake Meta/Google endpoints on `127.0.0.1:3198`.
