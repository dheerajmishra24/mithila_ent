# Pre-Deploy Checklist — Mithila Enterprises

Everything to configure before going live. Assumes deploy on **Vercel** + **Supabase**.
Legend: ✅ already done in code · ⬜ you do this.

---

## 0. Already done (code side)
- ✅ Required env vars set locally (`.env.local`) and gitignored
- ✅ Migration bundles prepared in `supabase/setup/`
- ✅ Owner-admin grant for `arpantyagi88@gmail.com` (migration `0023`)
- ✅ Hardened login (rate-limit + lockout) on both `/login` and `/admin/login`
- ✅ Sitemap/robots base URL now reads `NEXT_PUBLIC_SITE_URL`
- ✅ TypeScript clean (0 errors)

---

## 1. Supabase — database
- ⬜ **Apply migrations**: SQL Editor → run `supabase/setup/00_CHECK_STATE.sql`, then the bundle it points to (`01_FULL_SETUP_fresh_db.sql` or `02_NEW_MIGRATIONS_only.sql`).
- ⬜ **Create owner account**: Authentication → Users → Add user → `arpantyagi88@gmail.com` + strong password → tick **Auto Confirm User**. (Becomes admin automatically via `0023`.)
- ⬜ **Verify Storage**: confirm the `product-images` bucket exists and is **public** (created by `0022`).
- ⬜ **Backups**: Settings → Database → enable **Point-in-Time Recovery** (paid plans) or note the daily backup window.

## 2. Supabase — Auth URLs (CRITICAL — password reset / email confirm break without this)
- ⬜ Authentication → **URL Configuration**:
  - **Site URL** = `https://yourdomain.com`
  - **Redirect URLs**: add `https://yourdomain.com/**` (covers `/api/auth/callback` used by password reset).
- ⬜ Authentication → Providers → **Email**: keep **Confirm email ON** for production (recommended).
- ⬜ (Optional) Customize the confirmation / reset email templates with your branding.

## 3. Email delivery (Resend) — CRITICAL
> Right now `EMAIL_FROM` is blank, so the app sends from `onboarding@resend.dev`, which **only delivers to your own Resend account inbox** — customers get nothing.
- ⬜ Resend → **Domains → Add Domain** → add the shown **SPF + DKIM** DNS records at your domain registrar → wait for **Verified**.
- ⬜ Set `EMAIL_FROM="Mithila Enterprises <orders@yourdomain.com>"` in `.env.local` **and** Vercel.
- ⬜ **Rotate** the Resend API key (it was shared in chat) → Resend → API Keys → recreate → update `.env.local` + Vercel.

## 4. Environment variables on Vercel
Add **every** variable from `.env.local` under Vercel → Project → Settings → **Environment Variables** (Production + Preview). `NEXT_PUBLIC_*` are read at **build time**, so they must exist before the build.

**Required**
- ⬜ `NEXT_PUBLIC_SUPABASE_URL`
- ⬜ `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- ⬜ `SUPABASE_SERVICE_ROLE_KEY` *(secret)*
- ⬜ `RESEND_API_KEY` *(secret)*
- ⬜ `EMAIL_FROM`
- ⬜ `CRON_SECRET` *(secret)*
- ⬜ `NEXT_PUBLIC_SITE_URL` = your real domain
- ⬜ `GEMINI_API_KEY` *(AI fabric extraction)*
- ⬜ `PAYMENT_WEBHOOK_SECRET`, `LOGISTICS_WEBHOOK_SECRET`

**Optional (feature-gated — leave unset to keep the feature off)**
- ⬜ `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` — error monitoring
- ⬜ `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — rate limiting
- ⬜ `RAZORPAY_KEY_ID`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` — online payments

## 5. Email worker cron
- The site sends emails **instantly inline**; the cron at `/api/cron/process-emails` is the **retry safety-net**.
- ⬜ `vercel.json` schedules it every 5 min — that cadence needs **Vercel Pro**. On **Hobby**, crons run **daily only**: either change the schedule in `vercel.json` to `"0 9 * * *"` (daily 9am) or upgrade. (Inline send still works regardless.)
- ⬜ Ensure `CRON_SECRET` is set in Vercel (Vercel auto-sends it as the cron's `Authorization` header).

## 6. Payments (Razorpay) — only if launching with online payments
- ⬜ Razorpay → Settings → **API Keys** (live mode) → set `RAZORPAY_KEY_ID`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`.
- ⬜ Razorpay → Settings → **Webhooks** → add `https://yourdomain.com/api/webhooks/razorpay` → copy the signing secret into `RAZORPAY_WEBHOOK_SECRET`.
- Skip this entirely and checkout uses the current (non-gateway) flow.

## 7. SEO / PWA
- ⬜ Set `NEXT_PUBLIC_SITE_URL` (drives `sitemap.xml` + `robots.txt`).
- ⬜ (Optional) add `metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL!)` to `src/app/layout.tsx` metadata for correct social-share image URLs.
- ✅ `public/manifest.json` present (PWA).

## 8. Build & deploy
- ⬜ Run `npm run build` locally once (or let Vercel build) — must succeed. TypeScript is already clean.
- ⬜ Connect the repo to Vercel (framework auto-detected as Next.js) → deploy.
- ⬜ Add your **custom domain** in Vercel → Settings → Domains (TLS/HTTPS is automatic).

## 9. Security final pass
- ⬜ **Rotate** the `SUPABASE_SERVICE_ROLE_KEY` and `RESEND_API_KEY` (both shared in chat) after launch.
- ✅ `.env.local` is gitignored and untracked — never commit secrets.
- ✅ Security headers (HSTS, X-Frame-Options, nosniff) set in `proxy.ts`; RLS + admin guards in place.

## 10. Post-deploy smoke test
- ⬜ Sign up a test customer → confirmation email arrives (if confirm-email on).
- ⬜ Owner login at `/login` → lands on `/admin/dashboard`.
- ⬜ Add a product (manual entry + image upload) → appears on `/shop` and its `/product/[slug]` page.
- ⬜ Place a test order → shows in `/account/orders` and the admin orders list; **invoice email arrives**; payment + status recorded.
- ⬜ Request a cancellation → status updates in both customer and admin views.
- ⬜ Mark an order shipped in the dashboard → customer gets the "shipped" email.
- ⬜ (If cron configured) `curl -H "Authorization: Bearer <CRON_SECRET>" https://yourdomain.com/api/cron/process-emails` → returns `{ ok: true }`.

---

### The 4 things people most often forget
1. **Resend domain verification + `EMAIL_FROM`** — or customer emails silently don't send.
2. **Supabase Auth → Redirect URLs** — or password reset / email confirmation links break.
3. **`NEXT_PUBLIC_*` vars in Vercel before the build** — they're baked in at build time.
4. **Vercel cron needs Pro** for the 5-min schedule — downgrade to daily on Hobby.
