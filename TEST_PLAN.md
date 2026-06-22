# Mithila Enterprises — Test Plan & Handover Readiness

Stack: Next.js 16 (App Router) · React 19 · Supabase (Postgres + Auth + RLS) · Resend (email) · Gemini (AI) · Playwright (e2e).

## 1. Current coverage (baseline)

| Area | Status |
|---|---|
| e2e (Playwright) | Configured (`playwright.config.ts`, port 3006). **Only 2 smoke tests** in `e2e/checkout.spec.ts`. |
| Unit tests | **None** — no Vitest/Jest installed. |
| Integration / DB / RLS tests | **None**. |
| Known failing test | `e2e/checkout.spec.ts > "shop navigation"` asserts the shop `<h1>` contains **"All Fabrics"**, but the page renders **"Fabric Registry"**. This test fails today — fix the assertion to `/Fabric Registry/`. |

**Coverage is effectively ~0% of business logic.** This plan prioritizes the handover-critical paths first.

## 2. Recommended tooling

- **Unit/logic**: add **Vitest** (`npm i -D vitest @vitejs/plugin-react jsdom @testing-library/react`). Fast, ESM-native, fits Next.
- **e2e**: **Playwright** (already present). Use for full-journey + visual/accessibility.
- **DB / RLS / RPC**: a dedicated **Supabase test project** (or local `supabase start`) seeded with `npm run seed`; assert RLS by querying as anon / retail / admin JWTs.
- **External services**: mock **Resend** and **Gemini** in unit/integration; never hit them in CI. Use a Resend test key + Gemini stub.
- **CI**: run `tsc --noEmit`, `eslint`, Vitest, then Playwright against a preview deployment with a seeded test DB.

## 3. Target test pyramid

```
        e2e (Playwright)      ~15 specs — critical journeys only
     integration (DB/RPC)     ~25 — order RPC, RLS, webhooks
  unit (Vitest)               ~60 — pricing, validation, helpers
```
Coverage targets: **business logic 80%+**, **money/auth/RLS paths 100%**, UI components best-effort.

## 4. Test matrix (by area)

Priority: **P0** = handover blocker, **P1** = important, **P2** = nice-to-have.

### 4.1 Auth, OTP & password policy — P0
- Unit: `src/lib/password.ts` `passwordError()` / `isStrongPassword()` — boundary cases (11 vs 12 chars, missing class each). **(pure, easy — do first)**
- Integration: `register()` rejects weak passwords; returns the "check your email" message when no session (email-confirmation on).
- Integration: `login()` rate limiting — 5 failures lock for 15 min via `auth_attempt_record_failure`; lock clears on success (`auth_attempt_clear`).
- e2e: signup → confirmation email gate → login → redirect by role (admin → `/admin/dashboard`, retail → `/account`).
- **OTP/confirmation delivery**: this is Supabase Auth + SMTP — test by configuring SMTP in a test project and asserting an email lands (or use Supabase's `auth.admin.generateLink` to fetch the token in tests rather than relying on inbox delivery).
- Security: reset-password enforces the same 12-char policy (regression test for the gap we fixed).

### 4.2 Products & AI — P1
- Integration: `createProduct` inserts product + variants with correct columns (incl. `count`, `construction`); rejects non-admin (RLS + `assertAdmin`).
- Integration: `updateProduct` / `updateVariant` / `addVariant` persist and are admin-gated.
- API: `/api/extract-fabric` returns **401/403 for non-admin** (regression for the auth we added); returns structured JSON for a valid image (mock Gemini — assert schema, don't call the real model).
- e2e: admin creates a product → it appears on `/shop` and its `/product/[slug]`.

### 4.3 Catalog / storefront — P1
- Integration: shop query returns real DB variants (not mock) when seeded; category filter matches `categories.slug` (regression for the filter fix).
- Unit: shop filter logic (gsm bands, price bands, sort) given a variant array.
- e2e: `/shop` filter by category/color/price updates the grid; `/search?q=` returns title matches; product page variant selector changes the cart line.

### 4.4 Checkout & orders — P0
- Integration (RPC `create_order_atomic`): 
  - server-side pricing (ignores client price); correct tax (18%) + shipping (₹50) + total.
  - **stock decrement is atomic**: two concurrent orders for the last unit → exactly one succeeds (`INSUFFICIENT_STOCK`).
  - `VARIANT_NOT_FOUND` for bogus ids; `EMPTY_CART` for empty; rollback on failure (no orphan order rows).
  - discount applied + `discount_applied`/`applied_discount_id` recorded + `current_uses` incremented; `INVALID_DISCOUNT` path.
- Unit: checkout page total math (subtotal + GST + shipping − discount, free-shipping case).
- e2e: cart → checkout → apply `WELCOME10`/`FREESHIP` → order placed → success page → appears in `/account/orders`.

### 4.5 Payments & order linkage — P0
- Integration: `log_payment_intent` creates a `created` payment row bound to the **order_id**; idempotent (no duplicate intent).
- Integration: `record_payment('captured')` sets `orders.is_paid=true`, status `pending→paid`, stores `payment_intent_id`; appends a `payments` row with the order_id.
- API: `/api/webhooks/payment` rejects without/with wrong `x-webhook-secret` (401); on valid secret calls `record_payment`.
- Security: `record_payment` is **not** callable by anon/authenticated (only service_role) — assert the grant.
- **Gap**: no live gateway initiates a charge — see §6. Until then, test the webhook path with a simulated gateway payload.

### 4.6 Cancellation — P0
- Integration: `request_order_cancellation` — owner + `pending|paid` only; `FORBIDDEN` for non-owner; `NOT_CANCELLABLE` once shipped; sets `cancellation_requested`, logs event.
- Integration: `cancel_order_restock` — admin only; **restocks each line item** back to its variant; status → `cancelled`; logs event; idempotent if already cancelled.
- e2e: customer clicks "Request Cancellation" on a pending order → admin sees the flag → "Cancel & Restock" → stock restored, status cancelled, both sides reflect it.

### 4.7 Invoices — P1
- Integration: `/api/invoice/[id]` returns the **real order** lines/totals; returns **404 for a non-owner** (RLS) and for unknown id.
- Integration: order confirmation email (`createOrder`) renders the PDF and calls Resend with the right recipient (mock Resend; assert payload).
- Manual/staging: verify the email + PDF actually arrive once a Resend domain is verified.

### 4.8 Dashboard / CMS — P1
- Integration: `requireAdmin()` redirects non-admins from every `/admin/*` server page; proxy (`src/proxy.ts`) blocks at the edge.
- Integration: `setUserRole`, `updateCategory`, `updateSiteContent`, `updateStoreSettings` are admin-gated and persist.
- Integration: storefront reflects CMS — announcement bar shows when `announcement` set; footer shows `store_settings`; legal/about/hero fall back to built-in copy when empty.
- e2e: admin edits an announcement → it appears site-wide (after `revalidateTag`).

### 4.9 Security / RLS boundaries — P0 (highest value for this app)
Run each as anon, retail-user-A, retail-user-B, admin:
- `orders` / `order_items` / `payments` / `order_events`: a user reads **only their own**; admin reads all; anon reads none.
- `profiles`: user reads own; admin reads all (regression for the admin policy); no privilege escalation (a retail user cannot `update role`).
- `discounts`: **not enumerable** by anon/retail (regression — only `validate_discount` reveals a single code); admin manages.
- `product_variants`: public read, admin-only write (a retail user cannot change price/stock).
- `auth_attempts`: no direct client read/write (only the SECURITY DEFINER functions).
- All `SECURITY DEFINER` functions have `search_path = public` (assert via `pg_proc`).

## 5. Coverage targets

| Layer | Target |
|---|---|
| Money paths (order RPC, payments, discounts, totals) | **100%** |
| Auth, RLS, security boundaries | **100%** |
| Other business logic (cancellation, CMS actions, filters) | 80%+ |
| Critical e2e journeys | 100% of the §7 list |

## 6. "Standard e-commerce" feature checklist

**Have:** catalog + variants, filters, search, cart, checkout, coupons, GST/shipping totals, orders (history + detail), order tracking field, cancellation request + admin cancel/restock, invoices (PDF + email), inventory with low-stock, audit log + payment ledger, admin CMS (products/orders/customers/content/settings/discounts), roles, RLS, rate-limited auth, password policy.

**Partial / needs setup:** payments (data model ready; **no live gateway** — no real charge), transactional email (code ready; needs verified Resend domain + Supabase SMTP), guest checkout (currently login-required).

**Missing (typical e-commerce extras — decide what you need):** product reviews/ratings, wishlist/favorites, saved address book + multiple addresses, related/recommended products, search autocomplete, back-in-stock notifications, returns/RMA workflow (beyond cancel), shipping-rate calculation by region, multi-currency, abandoned-cart recovery, order-status emails (shipped/delivered), sitemap/SEO completeness, cookie/consent + privacy compliance, analytics, rate-limiting on public APIs (the proxy excludes `/api`).

## 7. Critical e2e journeys (build these first)
1. Signup → email confirm → login.
2. Browse → filter → product → add variant → cart.
3. Checkout with coupon → order created → confirmation + invoice email.
4. Customer views order, payment status, requests cancellation.
5. Admin login → fulfill order (ship/deliver) → cancel+restock.
6. Admin creates product (with AI) → visible on storefront.
7. Webhook marks an order paid → reflected for customer + admin.
8. RLS: user B cannot see user A's order/invoice.

## 8. Prioritized gaps & next steps
1. **Fix the failing existing test** (`All Fabrics` → `Fabric Registry`).
2. Add **Vitest**; write §4.1 password unit tests + §4.4 pricing unit tests (fast wins, no DB).
3. Stand up a **seeded Supabase test project**; write the §4.9 RLS suite and §4.4/4.5/4.6 RPC integration tests (highest risk: money + security).
4. Expand **Playwright** to the §7 journeys against a preview deploy.
5. Wire **CI**: tsc + eslint + vitest + playwright.
6. Resolve the **two external blockers** before "payments received" can be tested for real: live gateway + verified email domain/SMTP.

## 9. Runnable example tests

### 9.1 Unit — password policy (Vitest)
```ts
// tests/password.test.ts
import { describe, it, expect } from 'vitest';
import { isStrongPassword, passwordError } from '@/lib/password';

describe('password policy', () => {
  it('rejects < 12 chars', () => expect(isStrongPassword('Ab1!aaaa')).toBe(false));
  it('rejects missing special', () => expect(isStrongPassword('Abcdefgh1234')).toBe(false));
  it('accepts a strong 12+ password', () => expect(isStrongPassword('Abcdef1!ghij')).toBe(true));
  it('returns an error message when weak', () => expect(passwordError('weak')).toMatch(/12 characters/));
});
```

### 9.2 e2e — order journey (Playwright)
```ts
// e2e/order.spec.ts
import { test, expect } from '@playwright/test';

test('shop renders the fabric registry', async ({ page }) => {
  await page.goto('/shop');
  await expect(page.locator('h1')).toContainText('Fabric Registry'); // corrected
});

test('category filter navigates', async ({ page }) => {
  await page.goto('/shop?category=linen');
  await expect(page).toHaveURL(/category=linen/);
});
// Full checkout journey requires a seeded test user + DB; run against a preview env.
```

### 9.3 Integration — atomic stock (pseudo, against test DB)
```ts
// Seed a variant with stock_quantity = 1, then fire two create_order_atomic calls concurrently.
// Assert exactly one returns an order id and the other throws INSUFFICIENT_STOCK,
// and final stock_quantity = 0 (never negative).
```

### 9.4 Security — RLS (against test DB, as two users)
```ts
// As user B (anon key + B's JWT), select order belonging to user A by id.
// Assert data is null (RLS denies) — no leakage. Repeat for payments, invoices.
```
