# Owner portal: two-step sign-in

Migration `0053_admin_two_step.sql`. Code in `src/app/admin-verify/`, `src/actions/admin-two-step.ts`, `src/lib/otp.ts`, `src/lib/messaging/`, `src/app/api/webhooks/whatsapp/route.ts`.

## What changes for the owner

After the password, the owner portal asks for a 6-digit code. A sign-in lasts 12 hours, then the code is asked again.

| Method | Needs | Always available |
|---|---|---|
| Authenticator app (Google Authenticator, Microsoft Authenticator, 1Password …) | Nothing on the server | Yes |
| Code by WhatsApp, with SMS fallback | WhatsApp Business + DLT SMS set up (below) | Only once configured |

The first time an admin signs in after this ships, they are asked to set up an authenticator app. A WhatsApp/SMS number can then be added under **Settings → Two-step sign-in**.

## How it is enforced

- `public.is_admin()` returns true only for the admin role **and** a second factor checked in the last 12 hours for the calling session:
  - TOTP: the JWT is `aal2` and its `amr` claim has a `totp` entry less than 12 hours old.
  - WhatsApp/SMS: a row in `public.admin_step_up` for the JWT's `session_id`.
- Every admin RLS policy, the DAL (`requireAdmin`, `requireAdminPage`) and the proxy go through `is_admin()`. A password-only session has no admin rights anywhere, including direct API calls.
- One-time codes:
  - 6 digits from `crypto.randomInt`.
  - Stored only as HMAC-SHA256 with `OTP_PEPPER`, which the database never sees.
  - Expire after 10 minutes, work once, and are bound to one session and one purpose.
  - 5 wrong tries lock the code, and a resend keeps the count.
- Send limits:
  - 30 seconds between resends, and 5 sends per code.
  - 3 new codes per admin per hour.
  - No new code for 15 minutes after a lock.
  - Per-IP rate limit when Upstash is configured.
- Delivery: WhatsApp authentication template first. If WhatsApp fails, the SMS goes out at once. If Meta has not reported "delivered" within 15 seconds, the same code is sent by DLT SMS, unless that code was already used, replaced or expired.
- An email notice is sent when an authenticator or phone number is added or removed.
- Supabase only lets an `aal1` session add an authenticator when the user has no verified factor yet. After set-up, a stolen password cannot add another.

## Rollout order (production)

1. Check **Supabase → Authentication → Multi-Factor → TOTP** is enabled. It is on by default for hosted projects.
2. Deploy the code. Until step 3, it falls back to the old admin check, so nothing changes yet.
3. Apply migration `0053`. From then on, every admin session must pass the second step.
4. The owner signs in, sets up an authenticator app, then optionally adds a phone in Settings.

## Environment variables (Vercel; never commit values)

| Variable | Purpose |
|---|---|
| `OTP_PEPPER` | 32+ random characters. Required for WhatsApp/SMS codes. Rotating it invalidates codes in flight only. |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` | WhatsApp Cloud API system-user token and phone number ID |
| `WHATSAPP_AUTH_TEMPLATE` | Name of the approved **Authentication** template, with a "Copy code" button |
| `WHATSAPP_TEMPLATE_LANG` | Template language code, default `en` |
| `META_APP_SECRET` | App secret, used to verify `X-Hub-Signature-256` on `/api/webhooks/whatsapp` |
| `WHATSAPP_VERIFY_TOKEN` | Any random string; enter the same one in the Meta webhook settings |
| `MSG91_AUTH_KEY`, `MSG91_OTP_TEMPLATE_ID` | MSG91 Flow API key, and the MSG91 template linked to the DLT OTP template |

`WHATSAPP_API_BASE` and `SMS_API_BASE` exist for local tests only. They are ignored unless they point at localhost, and they are always ignored on Vercel.

### Meta set-up

1. In WhatsApp Manager, create a template: category **Authentication**, with a "Copy code" button and code expiry set to 10 minutes. Meta writes the text; it contains no links or offers.
2. In the app's **WhatsApp → Configuration** page:
   - Callback URL: `https://www.mithilaenterprises.co.in/api/webhooks/whatsapp`
   - Verify token: `WHATSAPP_VERIFY_TOKEN`
   - Subscribe to `messages`.

### SMS set-up

Register the OTP template in `docs/DLT_OPS_CHECKLIST.md` with the operator. Link it in MSG91 with the variable `otp` mapped to `{#numeric#}`, then set the two MSG91 variables.

## Recovery

- **Lost phone with the authenticator app, but a WhatsApp/SMS number is set:** sign in with a code, then go to **Settings → Two-step sign-in**.
- **No working method:** someone with database access removes the factor. This can't be undone, and the owner then sets up again at next sign-in:
  ```sql
  delete from auth.mfa_factors where user_id = '<owner user id>';
  delete from public.admin_otp_phones where user_id = '<owner user id>';
  ```

## Tests

- `supabase/tests/16_admin_two_step_test.sql`: 54 pgTAP checks.
- `tests/security-redteam/admin-two-step.test.ts`: password-only attacker, session binding, a parallel brute-force race, webhook signature.
- `tests/e2e/admin-two-step.spec.ts`: authenticator set-up; WhatsApp code; the 15-second SMS fallback against a local fake provider; immediate SMS when WhatsApp fails.
- `tests/two-step.test.ts`: unit tests.
