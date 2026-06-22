# Mithila Enterprises — System Design Review

Scope: full-stack e-commerce storefront + admin CMS. Verdict up front, details below.

> **Verdict:** For an SMB/D2C fabric store, this is a **well-chosen, modern serverless + BaaS architecture**, and its security model (RLS on every table + `SECURITY DEFINER` RPCs for all money mutations + edge auth proxy + secret-verified webhooks) is genuinely above-average for hand-built e-commerce. It is the *right* design at this scale. The gaps are operational/observability and a few patterns to add **as volume grows** — listed in §6. Nothing here calls for a rewrite.

## 1. Requirements

**Functional:** catalog + variants, filters/search, cart, checkout, coupons, GST/shipping, orders (place/track/cancel), payments + invoices, admin CMS (products/orders/customers/content/discounts/inventory/settings), roles.

**Non-functional (assumed for an SMB store):** ~10–10k orders/month; p95 page < 1s; 99.9% availability; tiny ops team (1–2 devs); cost-sensitive; India-first (INR, GST).

**Constraints:** existing stack is Next.js 16 + Supabase; no dedicated infra/ops team → favors managed services.

## 2. High-level design

```
                         ┌──────────────────────────── Vercel (Next.js 16, App Router) ─────────────────────────┐
  Browser (React 19)     │                                                                                       │
  ├─ RSC pages (ISR)  ───┼─►  proxy.ts (edge)  ─►  Server Components ─┐                                          │
  ├─ Client islands      │     • Supabase session refresh             ├─► Server Actions  ─┐                     │
  │   (cart=Zustand,     │     • /account,/admin guard                │   (mutations)      │   @supabase/ssr     │
  │    checkout, admin)  │     • Upstash rate-limit (non-/api)        │                    ├─► Supabase Postgres │
  └─ Razorpay widget ────┼─►  Route Handlers /api/*  ──────────────────┘                    │   • RLS policies    │
                         │     • webhooks (razorpay/payment/logistics, secret-verified)     │   • SECURITY DEFINER│
                         │     • /api/invoice (RLS), /api/extract-fabric (admin)            │     RPCs (money)    │
                         └──────────────────────────────────────────────────────────────────┘   • Auth (GoTrue)  │
                                  │              │              │              │                  • triggers/audit │
                              Razorpay        Resend         Gemini         Upstash             └─────────────────┘
                              (payments)      (email)        (AI extract)   (rate limit)
                                                                            Sentry (errors — installed, NOT yet configured)
```

**Storage choice:** single Postgres (Supabase) for everything — transactional, relational, with RLS as the authorization layer. Correct for an e-commerce domain (strong consistency on money/stock). Cart is client-side (Zustand + localStorage); the server-side `cart_items` table exists but is unused by the live flow.

## 3. Deep dive

### Data model (Postgres)
`profiles`(role) · `categories` · `products`(+count/construction) · `product_variants`(price/stock) · `orders` · `order_items` · `payments` (ledger) · `order_events` (audit) · `discounts` · `store_settings` (singleton) · `site_content` (CMS) · `auth_attempts` (rate-limit). FKs indexed (migration 0011).

**Core principle (the strongest decision):** *all money- and security-critical logic lives in Postgres `SECURITY DEFINER` functions*, not the app:
- `create_order_atomic` — server-side pricing, `FOR UPDATE` stock locks, discount application, all in one transaction (no oversell, no partial writes).
- `record_payment` (idempotent), `log_payment_intent`, `validate_discount` (prevents coupon enumeration), `request_order_cancellation` / `cancel_order_restock`, `auth_attempt_*`.
This means the **database is the integrity boundary** — even a buggy client or a compromised anon key can't oversell, self-grant a discount, mark itself paid, or read another user's data.

### API surface (REST-ish)
- **Mutations** → Next **Server Actions** (typed, no hand-written endpoints): `createOrder`, `updateOrderStatus`, product/category/settings/content actions, cancellation. Admin actions self-verify role.
- **Route Handlers** for things that need raw HTTP: webhooks (`/api/webhooks/{razorpay,payment,logistics}` — HMAC/secret verified), `/api/payment/razorpay/{create-order,verify}`, `/api/invoice/[id]` (RLS-scoped PDF), `/api/extract-fabric` (admin-gated Gemini).

### Caching
- Catalog/legal pages: **ISR** (`export const revalidate`).
- CMS chrome (settings, content): **`unstable_cache` + `revalidateTag('…','max')`** on save → near-instant propagation without per-request DB hits.
- Cart: client memory (Zustand persist).
- *Note:* the homepage now does a per-request anon read for "latest products" → it's effectively dynamic. Fine at this scale; wrap in `unstable_cache(..., {revalidate:60})` + tag-bust on product writes if homepage traffic grows.

### Events / async
- **Audit**: a trigger writes `order_events` on every order insert/status/paid/tracking change — automatic, can't be forgotten.
- **Payments**: webhook is the source of truth; `record_payment` idempotent so verify-callback + webhook can't double-record.
- *Gap:* invoice/confirmation email is sent **inline, best-effort** inside `createOrder` (try/catch, never blocks). Fine now; at volume move to a queue (see §6).

### Error handling
- Server actions return typed `{success,error}`; RPCs raise coded exceptions (`INSUFFICIENT_STOCK`, `INVALID_DISCOUNT`, …) mapped to user messages.
- Webhooks fail-closed on bad signature.
- Email failures are swallowed so they never break checkout.

## 4. Scale & reliability
- **Compute**: Vercel serverless functions autoscale horizontally; RSC + ISR offload most reads to the edge/CDN.
- **Bottleneck = Postgres connections.** Serverless × many concurrent functions can exhaust Postgres. **Action:** use Supabase's **transaction-mode pooler (PgBouncer)** connection string for the app (not the direct connection). This is the single most important scale setting.
- **Locks**: `create_order_atomic` takes `FOR UPDATE` row locks — correct and contention is per-variant; fine to thousands of orders/day. Lock ordering is per-cart; deadlock risk negligible at SMB scale.
- **Availability**: Vercel + Supabase are both managed/redundant. RPO/RTO depend on Supabase plan (enable PITR backups).
- **Monitoring**: **Sentry is a dependency but not configured** — there is no `sentry.*.config.ts` / `instrumentation.ts`. Today there's effectively **no production error visibility**. Highest-priority operational fix.

## 5. Trade-off analysis
| Decision | Why it's right here | Cost / when it bites |
|---|---|---|
| Supabase BaaS vs custom backend | tiny team, fast, managed auth + RLS + Postgres | vendor lock-in; complex workflows still need functions |
| RLS + `SECURITY DEFINER` as the security layer | integrity enforced at the DB; client can't bypass | RLS is easy to get subtly wrong → must be tested (see TEST_PLAN §4.9) |
| Server Actions vs REST/GraphQL | no endpoint boilerplate, typed, colocated | harder to consume from non-web clients (mobile app later → add REST) |
| Money logic in Postgres functions | atomic, race-free, one source of truth | SQL is less testable/observable than app code; needs DB integration tests |
| Client-side cart | zero server cost, instant | no cross-device cart, no abandoned-cart signal (cart_items table is ready if needed) |
| `ilike` search | trivial, fine for a small catalog | weak relevance/typo-tolerance at scale → pg_trgm/FTS or Algolia |
| External image URLs | nothing to build now | no upload pipeline, no optimization/ownership → add Supabase Storage |
| Stock decrement at order creation (pre-payment) | simplest; admin can cancel+restock | abandoned unpaid orders hold stock → add reservation TTL/expiry |

## 6. What I'd revisit as it grows (prioritized)
1. **Configure Sentry** (it's installed) — `instrumentation.ts` + client/server config + DSN. No prod observability today. *(P0, ~30 min)*
2. **Postgres pooler** connection string for serverless. *(P0, config)*
3. **Idempotency key on `createOrder`** — a double-click/retry currently creates two orders + two stock decrements. Add a client-generated key + unique constraint. *(P1)*
4. **Email → queue with retries** (e.g., a `pending_emails` table + cron, or a provider webhook) instead of inline best-effort; add order-status emails (shipped/delivered). *(P1)*
5. **Image upload pipeline** via Supabase Storage + `next/image`. *(P1)*
6. **Rate-limit `/api/*`** — the proxy matcher excludes `/api`, so webhooks/AI/payment routes aren't rate-limited (webhooks are secret-gated, but add limits anyway). *(P1)*
7. **Inventory reservation TTL** for abandoned unpaid orders (auto-cancel + restock after N minutes). *(P2)*
8. **Search**: move to Postgres FTS/`pg_trgm` (or Algolia) when the catalog grows. *(P2)*
9. **Read replicas / caching tier** only if read load demands it — not yet. *(P3)*

## 7. Bottom line
The architecture is sound and appropriately scaled — serverless Next.js for presentation + a Postgres-centric integrity core with RLS and transactional RPCs. It is the right design for this product. Close the **observability + pooler** items before launch, then adopt §6.3–6.6 as order volume and catalog size grow.
