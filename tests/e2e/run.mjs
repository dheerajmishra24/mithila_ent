#!/usr/bin/env node
// Runs the E2E + accessibility suite against a LOCAL app and the LOCAL
// Supabase stack. Usage (app already running, built against the local stack):
//   REDTEAM_APP_URL=http://localhost:3100 npm run test:e2e:local
import { execSync, spawnSync } from 'node:child_process';

const LOCAL = ['127.0.0.1', 'localhost', '::1'];
const status = JSON.parse(execSync('npx --no-install supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
const appUrl = process.env.REDTEAM_APP_URL || 'http://localhost:3100';
for (const u of [status.API_URL, appUrl]) {
  if (!LOCAL.includes(new URL(u).hostname)) {
    console.error(`Refusing to run: ${u} is not local.`);
    process.exit(2);
  }
}
const env = {
  ...process.env,
  REDTEAM_SUPABASE_URL: status.API_URL,
  REDTEAM_SERVICE_KEY: status.SERVICE_ROLE_KEY,
  REDTEAM_ANON_KEY: status.ANON_KEY,
  REDTEAM_APP_URL: appUrl,
  REDTEAM_MAILPIT_URL: status.MAILPIT_URL || status.INBUCKET_URL || '',
};
const r = spawnSync('npx', ['playwright', 'test', '-c', 'tests/e2e/playwright.config.ts', ...process.argv.slice(2)], {
  env, stdio: 'inherit', shell: process.platform === 'win32',
});
process.exit(r.status ?? 1);
