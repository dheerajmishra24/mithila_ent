# Security Red-Team Report (Playbook Step 5)

**Date:** 2026-11-27
**Target:** local Supabase stack (`supabase start`, API on 127.0.0.1:54321) with all migrations through 0049, plus a production build of the app (`next build` / `next start -p 3100`) wired to that stack.
**Not tested:** production. The harness refuses any non-localhost target (`tests/security-redteam/harness.ts:24-31`, `tests/security-redteam/run.mjs`).

## How to reproduce

```powershell
npx supabase start
npx supabase db reset --local
npm run test:redteam
```

That runs the database suites (races and access control). For the HTTP suite as well, build and start the app against the local stack with `RAZORPAY_WEBHOOK_SECRET=rt_whsec_local`, `CRON_SECRET` and `LOGISTICS_WEBHOOK_SECRET` set to throwaway values, then:

```powershell
$env:REDTEAM_APP_URL = 'http://localhost:3100'; npm run test:redteam
```

`run.mjs` reads `supabase status -o json`, refuses a non-local API or app URL, and passes the keys to vitest through `REDTEAM_*` variables. Without them every suite is skipped, so plain `npm test` and CI without a database stay green. Every probe prints a `REDTEAM <name> <json>` line; the values below are copied from the final run.

**Final run:** `Test Files 3 passed (3)`, `Tests 22 passed (22)`.

## Findings

### RT-01 — Discount codes could be enumerated by anyone (FIXED)

- **Where:** `public.validate_discount(text, numeric)` was executable by `anon` and `authenticated` through PostgREST (`POST /rest/v1/rpc/validate_discount`). The storefront also called it from `previewDiscount` with no sign-in and no rate limit.
- **Evidence (before the fix):** `REDTEAM validate_discount_direct {"anon":"ALLOWED","customer":"ALLOWED"}`.
- **Impact:** an anonymous script could brute-force or dictionary-test codes against the public API with no throttle, and learn each valid code's type and value. Private B2B or influencer codes leak, and margin is lost on every order that uses them. Discount codes themselves are not readable from the `discounts` table (RLS denies it, `supabase/tests/04_catalog_discounts_test.sql:45,54`); this RPC was the side door.
- **Fix:**
  - `supabase/migrations/0049_validate_discount_server_only.sql` revokes `EXECUTE` from `PUBLIC`, `anon` and `authenticated` and grants it to `service_role` only.
  - `src/actions/orders.ts:224-235`: `previewDiscount` now requires a signed-in user (`requireUser()`, line 228), applies a per-user rate limit (`discount-preview:<userId>`, line 232), and calls the RPC with the service-role client.
  - Checkout is unaffected: `create_order_atomic` validates and redeems the code inside the database.
- **Evidence (after):**
  - `REDTEAM validate_discount_direct {"anon":"42501","customer":"42501"}`
  - pgTAP `supabase/tests/12_validate_discount_test.sql` (anon and authenticated denied, service_role allowed, discount maths unchanged) and the updated assertion in `supabase/tests/04_catalog_discounts_test.sql:46-47`. Run: `Files=12, Tests=190, Result: PASS`.
- **CVSS v4.0:** Unscored. Running the FIRST calculator was declined in this session, and this report does not estimate scores. Remediation priority: High (unauthenticated, no throttle, direct revenue loss). Confidence: Confirmed (reproduced, then shown closed).
- **Residual:** `checkApiRateLimit` returns `true` when Upstash is not configured (`src/lib/ratelimit.ts:8,18`). If production lacks `UPSTASH_REDIS_REST_URL`/`TOKEN`, the preview limit is a no-op; sign-in is still required. Confirm those variables on Vercel.
- **Production status:** 0049 is applied locally only. It must be applied to the production database before or with the code that calls the RPC through the service-role client.

No other Critical or High issue was found.

## Concurrency races (TOCTOU)

Each test fires N calls at once with `Promise.all` (all promises created before any is awaited; `harness.ts:97-109`) at the same RPCs the server uses, then checks the invariant in the database.

| Attack | Burst | Outcome histogram | Invariant checked | Result |
|---|---|---|---|---|
| Single-use coupon (`max_uses: 1`) | 20 checkouts | `{"ok":1,"INVALID_DISCOUNT":19}` | `current_uses` 1, 1 order carries the coupon | PASS |
| Per-user coupon (`max_uses_per_user: 1`) | 20 checkouts, one customer | `{"ok":1,"INVALID_DISCOUNT":19}` | 1 order with the coupon | PASS |
| Oversell last stock (stock 3, qty 2 each) | 15 orders | `{"INSUFFICIENT_STOCK":14,"ok":1}` | stock_after 1, never negative | PASS |
| Admin `adjust_stock` (−1 / +2 mixed) | 20 calls | 20 ok | stock 10 → 20 exactly (no lost update) | PASS |
| Partial cancel of one line (restock) | 20 calls | `{"ITEM_ALREADY_CANCELLED":19,"ok":1}` | stock back to 50 once | PASS |
| Full cancel (restock) | 20 calls | `{"ok":20}` (idempotent) | stock back to 30 once, status `cancelled` | PASS |
| `record_payment` same payment id | 20 calls | `{"ok":20}` (idempotent) | 1 `payments` row, order `is_paid` | PASS |
| Webhook inbox, same event id | 20 inserts | 1 claimed | 1 `webhook_events` row | PASS |

Tests: `tests/security-redteam/races.test.ts:33-164`.

## Access control (IDOR, escalation, mass assignment)

Every persona uses its own JWT against the public PostgREST API. A positive control runs first, so an empty result can't pass by accident.

| Probe | Evidence | Result |
|---|---|---|
| Positive control: owner and admin read the order | `{"owner_rows":1,"admin_rows":1}` | PASS |
| Customer B reads, updates or deletes A's order and items | `{"read_rows":0,"item_rows":0,"update":0,"delete":"42501"}`; total and `is_paid` unchanged | PASS |
| Owner rewrites own total or marks own order paid | 0 rows updated; `is_paid` still false | PASS |
| Customer calls server-only money RPCs | all `42501`: `create_order_atomic`, `record_payment`, `cancel_order_restock`, `partial_cancel_order_item`, `adjust_stock` | PASS |
| Customer makes self admin | `profiles.role` 42501, `user_roles` 42501, `is_admin` false; own `full_name` update allowed (control) | PASS |
| Customer inserts a paid order directly | `42501` | PASS |
| Anonymous sweep of 8 private tables | 0 rows or 42501 on every table | PASS |

Tests: `tests/security-redteam/idor.test.ts:34-122`.

## HTTP layer (real app, local stack)

| Probe | Evidence | Result |
|---|---|---|
| `x-middleware-subrequest` bypass (CVE-2025-29927 forms: middleware, src/middleware, proxy, src/proxy) on `/admin/dashboard`, `/admin/orders`, `/account` | all 12 requests → 307 to `/login` | PASS |
| Signed-in customer opens `/admin/dashboard` | 307 to `/` | PASS |
| Invoice download `/api/invoice/<id>` | owner 200 `application/pdf` starting `%PDF-`, `Cache-Control: private, no-store`; customer B 404, anon 404, non-UUID 404 | PASS |
| Admin AI endpoint `/api/extract-fabric` | anon 401, customer 403 | PASS |
| Cron routes (`timeouts`, `process-emails`, `webhook-retry`), none and wrong bearer | all 401 | PASS |
| Logistics webhook, wrong secret | 401 | PASS |
| `/api/dev/login` in a production build | 404 | PASS |
| Removed `/api/webhooks/payment` | 404 | PASS |
| Razorpay webhook: forged signature, tampered body | 401, 401 | PASS |
| Razorpay webhook: 20 parallel replays of one signed event | 20 × 200; 1 payment row; order paid; event outcome `recorded_capture`, attempts 1 | PASS |

Tests: `tests/security-redteam/http.test.ts:49-163`.

## Not testable: feature missing

These attack classes from the playbook have nothing to attack yet. They are recorded as **MISSING** (No-Go blockers), not as passes:

- **OTP brute force and replay:** there is no phone or WhatsApp OTP flow.
- **Swatch-credit double spend:** there is no swatch-credit ledger.
- **Roll, dye-lot and meterage races:** there are no `fabric_rolls` or fractional-meterage tables; stock is an integer per variant.
- **Refund double-submit:** the admin partial cancel computes a refund amount (`src/actions/orders.ts:319-339`, covered by the partial-cancel race above), but there is no customer refund-request table and no Razorpay refund API call, so the money still moves by hand.
- **Meta / Google lead webhooks:** not built.

Build plan and ownership: `docs/INTEGRATIONS_COMPLIANCE_REPORT.md` and `docs/PRODUCTION_CHECKLIST.md`.

## Authentication review (2026-11-27)

Every flow was driven through the real UI on the local stack (`tests/e2e/auth.spec.ts`, 12 tests, all passing) plus unit tests (`tests/auth-hardening.test.ts`, 12 tests).

| Flow | Result | Evidence |
|---|---|---|
| Protected page → login → back to the page | Pass | proxy now keeps `next` (`src/lib/supabase/middleware.ts`) |
| Wrong password vs unknown email | Same message | `REDTEAM auth.login_error_message "Incorrect email or password."` |
| 5 failures lock the account, right password still refused | Pass | `REDTEAM auth.lockout_row [{"attempts":5,"locked_until":…}]` |
| `next=` open redirect (`//host`, `https://host`, `/\host`) | Stays on site | auth.spec "next= cannot send you to another site" |
| Logout, then replay the old cookies in a new browser | Refused | `REDTEAM auth.replayed_cookie_after_logout ".../login?next=%2Faccount"` |
| Customer opens /admin; admin signs in | Customer → `/`; admin → dashboard | proxy and login use `is_admin()` (user_roles), same as the DAL |
| Sign-up password policy (app) | Enforced | auth.spec sign-up test |
| Weak password sent straight to the Auth API | 422 `weak_password` locally | `REDTEAM auth.api_weak_password` (needs the same setting in production, below) |
| Password reset by email, link reuse, old password | Works; link single-use; old password refused | auth.spec reset test (Mailpit) |
| Reset page opened without a link | "Link expired" page | auth.spec |
| `/login?error=` text injection | Only fixed codes render | `loginPageError` allowlist |
| Google provider off | Back to /login with a message, not raw JSON | auth.spec |

Fixed in this change:
- Email-confirmation and OAuth links were built from the request's Host header; now only the site's own hosts are trusted (`src/lib/site-origin.ts`).
- Raw Supabase error text is no longer shown on login and sign-up (`src/lib/auth-errors.ts`).
- Post-login admin redirect and the proxy read `is_admin()` instead of `profiles.role`.
- Forgot-password gives the same reply for any address; reset signs out other devices and handles expired links.
- Login and sign-up keep the typed email after a failed attempt.
- Local `supabase/config.toml`: password policy matches the app (12 characters, all four classes); redirect URLs include the local app.

Production Auth settings (read 2026-11-27 from the public `/auth/v1/settings` endpoint): Google on, email sign-up on, **email confirmation off** (`mailer_autoconfirm: true`). Owner actions in the Supabase dashboard (Authentication):
1. Turn on **Confirm email**. Without it anyone can open an account under someone else's address. The sign-up page already handles the "check your email" case.
2. Set the password policy to minimum 12 characters with lowercase, uppercase, digits and symbols, and turn on leaked-password protection. The app enforces this, but the public Auth API does not until it is set there.
3. URL Configuration: Site URL `https://www.mithilaenterprises.co.in`; redirect URLs `https://www.mithilaenterprises.co.in/**` and `https://mithilaenterprises.co.in/**`.

Not covered: Google sign-in end to end (needs real Google credentials), and `/admin/login`, which is unreachable while signed out because the admin layout guards it (signed-out visitors go to `/login`, which works for admins).
