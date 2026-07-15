# Deployment & Operations

Pre-launch checklist for the items the system-design review flagged as
operational (observability + connection pooling) plus the new email worker.

## 1. Database migrations
Apply everything in `supabase/migrations/` in order. The latest additions:
- `0019_order_idempotency.sql` — idempotency key + dedupe in `create_order_atomic` (no double orders on retry/double-click).
- `0020_email_queue.sql` — `pending_emails` durable queue (RLS-locked; only the service role touches it).
- `0022_product_images_storage.sql` — public `product-images` Storage bucket + policies (product images are now uploaded files, not base64 in the DB).

```bash
supabase db push          # or: psql "$DATABASE_URL" -f supabase/migrations/00XX_*.sql
```

## 2. Postgres connection pooler  (review §6.2 — do before launch)
Serverless functions open many short-lived connections; the direct `:5432`
connection will exhaust Postgres under load. Point the app at Supabase's
**transaction-mode pooler (PgBouncer)**:

- Host: `…-pooler.supabase.com`, **port `6543`**, `?pgbouncer=true`.
- Use the direct `:5432` string only for migrations/admin scripts.

Supabase dashboard → Project → Database → Connection string → **Transaction** mode.

## 3. Error monitoring — Sentry  (review §6.1)
Config is committed and inert until a DSN is set (`instrumentation.ts`,
`instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`).
Set in the hosting env to turn it on:

```
SENTRY_DSN=...              # server / edge
NEXT_PUBLIC_SENTRY_DSN=...  # browser
```

## 4. Email worker  (review §6.4)
Order confirmation+invoice and shipped/delivered emails are enqueued in
`pending_emails`, sent **inline best-effort** immediately, and any job left
pending is retried by a cron worker with exponential backoff (2→4→8→16→32→60 min,
5 attempts).

1. Set `CRON_SECRET` in the hosting env (any long random string).
2. `vercel.json` already schedules `/api/cron/process-emails` every 5 minutes.
   Vercel automatically sends `Authorization: Bearer $CRON_SECRET`.
3. Without `CRON_SECRET` the endpoint returns 503 and refuses to run — inline
   sends still deliver; only the retry safety-net is disabled.

Manual drain (e.g. local):
```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/process-emails
```

## 5. Backups
Enable **PITR** on the Supabase plan (review §4: RPO/RTO depend on it).

## 6. Rate limiting  (review §6.6)
`/api/extract-fabric` and `/api/payment/razorpay/create-order` are rate-limited
when Upstash env vars are present (inert otherwise). Set `UPSTASH_REDIS_REST_URL`
and `UPSTASH_REDIS_REST_TOKEN` to enable.

## 7. Owner / admin login
The store owner is **arpantyagi88@gmail.com** (migration `0023_owner_admin.sql`).
To activate the dashboard login:

1. Create the account once, either:
   - **Supabase dashboard** → Authentication → Users → *Add user* → enter the email + a
     strong password and tick *Auto Confirm User* (no email step needed); or
   - the storefront **/signup** page, then click the confirmation link Supabase emails.
2. Apply migrations (`0023` grants that email the `admin` role automatically — on
   signup via the trigger, and immediately via its promote step if the account
   already exists).
3. Sign in at **/login** or **/admin/login** → you land on `/admin/dashboard`.

Both login forms run the same hardened server action (failed-attempt lockout +
security-alert email). To require email verification for all users, keep
*Confirm email* enabled in Supabase → Authentication → Providers → Email.
