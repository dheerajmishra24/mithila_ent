import AxeBuilder from '@axe-core/playwright';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { APP_URL, record, SUPABASE_URL, type Persona } from '../security-redteam/harness';

// Shared E2E helpers: cookie sign-in, axe WCAG 2.2 AA audit, console/5xx watch.

export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

export type Issues = { console: string[]; pageErrors: string[]; http5xx: string[]; http404: string[] };

export function watch(page: Page): Issues {
  const issues: Issues = { console: [], pageErrors: [], http5xx: [], http404: [] };
  page.on('console', (m) => { if (m.type() === 'error') issues.console.push(m.text().slice(0, 300)); });
  page.on('pageerror', (e) => issues.pageErrors.push(e.message.slice(0, 300)));
  page.on('response', (r) => {
    if (r.status() >= 500) issues.http5xx.push(`${r.status()} ${r.url()}`);
    if (r.status() === 404) issues.http404.push(r.url());
  });
  return issues;
}

const HYDRATION = /hydrat|did not match|server rendered HTML|Minified React error #(418|423|425)/i;

/** The cookie @supabase/ssr reads: sb-<host label>-auth-token = "base64-" + base64url(session), chunked. */
export async function signIn(context: BrowserContext, p: Persona) {
  const name = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
  const value = 'base64-' + Buffer.from(JSON.stringify(p.session)).toString('base64url');
  const domain = new URL(APP_URL).hostname;
  const chunks = value.length <= 3000 ? [[name, value]] : Array.from({ length: Math.ceil(value.length / 3000) }, (_, i) => [`${name}.${i}`, value.slice(i * 3000, (i + 1) * 3000)]);
  await context.addCookies(chunks.map(([n, v]) => ({ name: n, value: v, domain, path: '/', sameSite: 'Lax' as const })));
}

export async function audit(page: Page, label: string, issues: Issues) {
  // Let entrance animations finish so axe measures the settled colours.
  // Looping animations never finish, so only wait on finite ones, capped at 3 s.
  await page.evaluate(() => Promise.race([
    Promise.all(document.getAnimations()
      .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
      .map((a) => a.finished.catch(() => undefined))),
    new Promise((r) => setTimeout(r, 3000)),
  ]));
  await page.waitForTimeout(1000);
  const axe = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const violations = axe.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, sample: v.nodes[0]?.target?.join(' ') }));
  const hydration = [...issues.console, ...issues.pageErrors].filter((m) => HYDRATION.test(m));
  record(`e2e ${test.info().project.name} ${label}`, {
    axe_violations: violations, console_errors: issues.console, page_errors: issues.pageErrors, http5xx: issues.http5xx, http404: issues.http404, hydration,
  });
  return { violations, hydration };
}

export async function visit(page: Page, path: string, issues: Issues) {
  const res = await page.goto(path, { waitUntil: 'load' });
  expect(res?.status(), `${path} status`).toBeLessThan(500);
  await page.waitForLoadState('domcontentloaded');
}

export function expectClean(label: string, r: { violations: { impact?: string | null }[]; hydration: string[] }, issues: Issues) {
  expect(issues.http5xx, `${label}: 5xx responses`).toEqual([]);
  expect(issues.pageErrors, `${label}: uncaught exceptions`).toEqual([]);
  expect(r.hydration, `${label}: hydration errors`).toEqual([]);
  const blocking = r.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  expect(blocking, `${label}: serious or critical WCAG violations`).toEqual([]);
}
