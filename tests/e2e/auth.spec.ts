// Authentication flows, end to end through the real UI, against the LOCAL
// stack only (harness assertLocal refuses any other host).
// Run with: npm run test:e2e:local
import { expect, test, type Page } from '@playwright/test';
import crypto from 'crypto';
import { appEnabled, assertLocal, record, service, SUPABASE_URL, totp } from '../security-redteam/harness';

const MAILPIT = process.env.REDTEAM_MAILPIT_URL || SUPABASE_URL.replace(/:\d+$/, ':54324');
if (appEnabled) assertLocal(MAILPIT);

type Account = { id: string; email: string; password: string };

const strongPassword = () => `Auth-${crypto.randomUUID()}!`;

async function account(tag: string, opts: { admin?: boolean } = {}): Promise<Account> {
  const svc = service();
  const email = `auth-${tag}-${crypto.randomUUID().slice(0, 8)}@example.test`;
  const password = strongPassword();
  const { data, error } = await svc.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser ${tag}: ${error?.message}`);
  if (opts.admin) {
    const r = await svc.from('user_roles').upsert({ user_id: data.user.id, role: 'admin' }, { onConflict: 'user_id' });
    if (r.error) throw new Error(`grant admin: ${r.error.message}`);
  }
  return { id: data.user.id, email, password };
}

// Next.js adds an empty role=alert route announcer; look only at the form's alert.
const formAlert = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');
const ACCOUNT = /\/account(\/profile)?$/;

async function signIn(page: Page, email: string, password: string) {
  await page.getByLabel('Email').fill(email);
  await page.locator('#login-password').fill(password);
  // Wait for the server action to answer, so rapid attempts are not dropped
  // while the button is disabled.
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/login'),
    page.getByRole('button', { name: /^sign in$/i }).click(),
  ]);
}

async function latestMailTo(email: string): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
    const list = (await res.json()) as { messages?: { ID: string }[] };
    if (list.messages?.length) {
      const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${list.messages[0].ID}`)).json()) as { Text: string; HTML: string };
      return `${msg.Text}\n${msg.HTML}`;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no email for ${email}`);
}

test.describe('authentication', () => {
  test.skip(!appEnabled, 'needs the local stack (npm run test:e2e:local)');
  // Flows are browser-independent; run them once, on the desktop project.
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', 'auth flows run on one viewport');
  });

  test('protected page sends you to login and back again', async ({ page }) => {
    const a = await account('next');
    await page.goto('/account/orders');
    await expect(page).toHaveURL(/\/login\?next=%2Faccount%2Forders$/);
    await signIn(page, a.email, a.password);
    await expect(page).toHaveURL(/\/account\/orders$/);
  });

  test('wrong password and unknown email get the same message', async ({ page }) => {
    const a = await account('wrongpw');
    await page.goto('/login');
    await signIn(page, a.email, 'Not-the-password-1!');
    const wrong = await formAlert(page).textContent();
    await page.goto('/login');
    await signIn(page, `nobody-${crypto.randomUUID().slice(0, 8)}@example.test`, 'Not-the-password-1!');
    const unknown = await formAlert(page).textContent();
    expect(wrong?.trim()).toBe('Incorrect email or password.');
    expect(unknown?.trim()).toBe(wrong?.trim());
    record('auth.login_error_message', wrong?.trim());
  });

  test('five failures lock the account, even against the right password', async ({ page }) => {
    const a = await account('lockout');
    await page.goto('/login');
    for (let i = 1; i <= 5; i++) {
      await signIn(page, a.email, `Wrong-guess-${i}-xx!`);
      await expect(formAlert(page)).toBeVisible();
    }
    await expect(formAlert(page)).toContainText(/temporarily locked/i);
    await signIn(page, a.email, a.password);
    await expect(formAlert(page)).toContainText(/temporarily locked/i);
    await expect(page).toHaveURL(/\/login/);
    const { data } = await service().from('auth_attempts').select('attempts, locked_until').ilike('email', a.email);
    record('auth.lockout_row', data);
    expect(data?.some((r) => r.locked_until && new Date(r.locked_until) > new Date())).toBe(true);
  });

  test('next= cannot send you to another site', async ({ browser }) => {
    const a = await account('openredirect');
    for (const evil of ['//evil.example/x', 'https://evil.example', '/\\evil.example']) {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.goto(`/login?next=${encodeURIComponent(evil)}`);
      await signIn(page, a.email, a.password);
      await page.waitForURL((u) => !u.pathname.startsWith('/login'));
      expect(new URL(page.url()).host).toBe(new URL(process.env.REDTEAM_APP_URL || 'http://localhost:3100').host);
      expect(new URL(page.url()).pathname).toMatch(ACCOUNT);
      await ctx.close();
    }
  });

  test('logout ends the session, and its old cookies stop working', async ({ page, browser }) => {
    const a = await account('logout');
    await page.goto('/login');
    await signIn(page, a.email, a.password);
    await expect(page).toHaveURL(ACCOUNT);
    const stolen = await page.context().cookies();
    expect(stolen.some((c) => c.name.startsWith('sb-') && c.name.includes('auth-token'))).toBe(true);

    await page.getByRole('button', { name: /log ?out|sign ?out/i }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto('/account');
    await expect(page).toHaveURL(/\/login/);

    // Replay the cookies captured before logout in a fresh browser.
    const replay = await browser.newContext();
    await replay.addCookies(stolen);
    const p2 = await replay.newPage();
    await p2.goto('/account');
    record('auth.replayed_cookie_after_logout', p2.url());
    await expect(p2).toHaveURL(/\/login/);
    await replay.close();
  });

  test('customers cannot open the admin area; admins land on it', async ({ page }) => {
    const c = await account('notadmin');
    await page.goto('/login');
    await signIn(page, c.email, c.password);
    await expect(page).toHaveURL(ACCOUNT);
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/$/);

    await page.context().clearCookies();
    const admin = await account('admin', { admin: true });
    await page.goto('/login');
    await signIn(page, admin.email, admin.password);
    // A password alone is not enough (migration 0053): set up the second step.
    await expect(page).toHaveURL(/\/admin-verify$/);
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/admin-verify$/);
    await page.getByRole('button', { name: 'Set up an authenticator app' }).click();
    const secret = (await page.locator('span.font-mono').innerText()).trim();
    await page.getByLabel('Then enter the 6-digit code it shows').fill(totp(secret));
    await page.getByRole('button', { name: 'Finish set-up' }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard$/);
  });

  test('sign-up enforces the password policy, then signs you in', async ({ page }) => {
    const email = `auth-signup-${crypto.randomUUID().slice(0, 8)}@example.test`;
    await page.goto('/signup');
    await page.getByLabel(/name/i).fill('Auth Test');
    await page.getByLabel('Email').fill(email);
    await page.locator('#signup-password').fill('short1!');
    await page.getByRole('button', { name: /create account|sign up|register/i }).first().click();
    await expect(page.getByText(/at least 12 characters/i).first()).toBeVisible();
    await expect(page).toHaveURL(/\/signup/);

    // The form keeps the name and email after a failed attempt.
    await expect(page.getByLabel('Email')).toHaveValue(email);
    await page.locator('#signup-password').fill(strongPassword());
    await page.getByRole('button', { name: /create account|sign up|register/i }).first().click();
    await expect(page).toHaveURL(ACCOUNT);
  });

  test('Supabase itself rejects a weak password sent straight to the API', async () => {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: { apikey: process.env.REDTEAM_ANON_KEY ?? '', 'content-type': 'application/json' },
      body: JSON.stringify({ email: `auth-api-${crypto.randomUUID().slice(0, 8)}@example.test`, password: 'abc123' }),
    });
    const body = (await res.json()) as { code?: number; error_code?: string };
    record('auth.api_weak_password', { status: res.status, code: body.error_code });
    expect(res.status).toBe(422);
    expect(body.error_code).toBe('weak_password');
  });

  test('password reset by email, then the old password stops working', async ({ page }) => {
    const a = await account('reset');
    await page.goto('/forgot-password');
    await page.getByLabel('Email').fill(a.email);
    await page.getByRole('button', { name: /send link/i }).click();
    await expect(page.getByRole('status')).toContainText(/if an account exists/i);

    const mail = await latestMailTo(a.email);
    const link = mail.match(/https?:\/\/[^\s"'<>)\]]+\/auth\/v1\/verify\?[^\s"'<>)\]]+/)?.[0]?.replace(/&amp;/g, '&');
    expect(link, 'reset link in email').toBeTruthy();
    await page.goto(link!);
    await expect(page).toHaveURL(/\/reset-password$/);

    const fresh = strongPassword();
    await page.locator('#reset-password').fill(fresh);
    await page.getByRole('button', { name: /update password/i }).click();
    await expect(page).toHaveURL(ACCOUNT);

    // A used link cannot be replayed.
    await page.context().clearCookies();
    await page.goto(link!);
    await expect(page).not.toHaveURL(/\/reset-password$/);

    await page.goto('/login');
    await signIn(page, a.email, a.password);
    await expect(formAlert(page)).toHaveText('Incorrect email or password.');
    await page.goto('/login');
    await signIn(page, a.email, fresh);
    await expect(page).toHaveURL(ACCOUNT);
  });

  test('reset page without a valid link says so', async ({ page }) => {
    await page.goto('/reset-password');
    await expect(page.getByRole('heading', { name: /link expired/i })).toBeVisible();
  });

  test('login page shows only known ?error= codes', async ({ page }) => {
    await page.goto('/login?error=Invalid_or_expired_link');
    await expect(formAlert(page)).toContainText(/invalid or has expired/i);
    await page.goto(`/login?error=${encodeURIComponent('Call +91 00000 00000 to unlock')}`);
    await expect(formAlert(page)).toHaveCount(0);
    await expect(page.getByText('+91 00000')).toHaveCount(0);
  });

  test('Google sign-in fails cleanly when the provider is off', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /sign in with google/i }).click();
    await expect(page).toHaveURL(/\/login\?error=google_unavailable$/);
    await expect(formAlert(page)).toContainText(/google sign-in is not available/i);
  });
});
