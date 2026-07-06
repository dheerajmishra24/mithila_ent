# Deploy Checklist: Mithila Enterprises — Full Site

**Date:** ____________  **Deployer:** ____________
**Stack:** Next.js 16 + Supabase · GitHub `Arpan-Tyagi/mithila_ent` → Vercel
**DB project:** `nhmarliyovmucuqryceg`

> One-time setup (Vercel env, Supabase Auth URLs, Resend domain, owner account) lives in
> **PRE_DEPLOY_CHECKLIST.md** + **DEPLOYMENT.md**. This file is the per-release ship checklist.

## This release includes
Idempotent orders, durable email queue (+ cron worker), Supabase Storage image pipeline,
owner-admin login + hardened `/admin/login`, dev-only auto-login (local), responsive admin
(mobile nav drawer + tables→cards), storefront-chrome excluded from `/admin`, env-driven
sitemap/robots. **New DB migrations: 0019–0023.**

---

## Pre-Deploy
- [ ] `npm run lint` clean (CI runs this)
- [ ] `npm run build` succeeds (this is where type-checking runs; CI runs it too)
- [ ] `npm test` (vitest: password/pricing/integration) green
- [ ] `npm run test:e2e` (Playwright journeys) green — recommended
- [ ] CI green on `main` (`.github/workflows/main.yml` = lint + build)
- [ ] All Production env vars present in Vercel (Supabase URL/anon/**service_role**, RESEND_API_KEY, EMAIL_FROM, CRON_SECRET, NEXT_PUBLIC_SITE_URL, GEMINI_API_KEY, webhook secrets)
- [ ] `DEV_AUTOLOGIN` / `DEV_ADMIN_PASSWORD` are **NOT** set in Vercel (local-only)
- [ ] `.env.local` not committed (gitignored ✓)
- [ ] Migration plan ready: `npm run supabase:push` (or `supabase/setup/` bundles)
- [ ] Resend sending domain verified + `EMAIL_FROM` set (otherwise customer emails don't deliver)
- [ ] Rollback plan understood (see bottom)

## Deploy
- [ ] **Apply DB migrations first** — `npm run supabase:push` (0019–0023 are additive/idempotent, safe to run before the code ships)
- [ ] Confirm owner account exists + is admin (`arpantyagi88@gmail.com`)
- [ ] Push/merge to `main` → Vercel auto-builds & deploys (or promote a verified Preview)
- [ ] Wait for Vercel build = **Ready** (no build errors)
- [ ] Open the production URL and run smoke tests ↓

## Smoke tests (key user flows)
- [ ] Home / shop / product detail render; product images load (next/image + Storage)
- [ ] Owner login → lands on `/admin/dashboard`; desktop sidebar + mobile drawer both work
- [ ] Add a product (manual + image upload) → appears on `/shop` and its detail page
- [ ] Place a test order → shows in `/account/orders` and admin; **stock decrements once**; **invoice email arrives**; payment + status recorded
- [ ] Request a cancellation → status updates for customer and admin
- [ ] Discount code applies at checkout
- [ ] Mobile (≤375px): no header overlap on `/admin`; admin lists render as cards

## Post-Deploy
- [ ] Sentry shows no error spike (once `SENTRY_DSN` is set)
- [ ] Hit the email worker: `curl -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/process-emails` → `{ ok: true }`
- [ ] Confirm a real customer email actually delivered (Resend dashboard)
- [ ] Update changelog / notify stakeholders
- [ ] **Rotate** `SUPABASE_SERVICE_ROLE_KEY` + `RESEND_API_KEY` (shared in chat) and update Vercel
- [ ] Close related tickets

## Rollback
**Trigger if any of:** checkout / order creation fails · login broken · `/admin` inaccessible to owner ·
error rate clearly elevated in Sentry · a key page 500s · payment webhook failing.

**How:**
- **Code:** Vercel → Deployments → last known-good → **Promote** (instant, no rebuild).
- **DB:** migrations 0019–0023 are additive/idempotent, so a code rollback is safe against them
  (no destructive down-migration needed). If a migration itself is faulty, restore via
  Supabase → Database → **Point-in-Time Recovery / backup**.

## Known caveats for this stack
- **Vercel Cron** at `*/5` (email worker) needs **Vercel Pro**; on Hobby change `vercel.json` to a daily schedule (inline send still works, cron is only the retry net).
- **Tests are not in CI** — `main.yml` runs only lint + build. Run `npm test` / `npm run test:e2e` locally, or add them to CI before relying on it as a gate.
- Sandbox can't run `next build` (SWC limitation here); trust Vercel/CI for the build result.
