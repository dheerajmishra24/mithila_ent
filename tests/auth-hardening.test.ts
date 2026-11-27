import { describe, expect, it } from 'vitest';
import { authRedirectOrigin, configuredOrigin, trustedHosts } from '@/lib/site-origin';
import { loginErrorMessage, loginPageError, signupErrorMessage } from '@/lib/auth-errors';
import { safeNextPath } from '@/lib/safe-next';

const prod = {
  NODE_ENV: 'production',
  NEXT_PUBLIC_SITE_URL: 'https://www.mithilaenterprises.co.in',
  VERCEL_PROJECT_PRODUCTION_URL: 'mithilaenterprises.co.in',
  VERCEL_URL: 'mithila-ent-abc123.vercel.app',
};

describe('authRedirectOrigin (email and OAuth links)', () => {
  it('uses the request host when it is one of the site hosts', () => {
    expect(authRedirectOrigin('www.mithilaenterprises.co.in', 'https', prod)).toBe('https://www.mithilaenterprises.co.in');
    expect(authRedirectOrigin('mithilaenterprises.co.in', 'https', prod)).toBe('https://mithilaenterprises.co.in');
    expect(authRedirectOrigin('mithila-ent-abc123.vercel.app', 'https', prod)).toBe('https://mithila-ent-abc123.vercel.app');
  });

  it('ignores a forged Host header and falls back to the site URL', () => {
    expect(authRedirectOrigin('evil.example', 'https', prod)).toBe('https://www.mithilaenterprises.co.in');
    expect(authRedirectOrigin('www.mithilaenterprises.co.in.evil.example', 'https', prod)).toBe('https://www.mithilaenterprises.co.in');
    expect(authRedirectOrigin('evil.example/@www.mithilaenterprises.co.in', 'https', prod)).toBe('https://www.mithilaenterprises.co.in');
    expect(authRedirectOrigin('', 'https', prod)).toBe('https://www.mithilaenterprises.co.in');
    expect(authRedirectOrigin(null, null, prod)).toBe('https://www.mithilaenterprises.co.in');
  });

  it('never downgrades a real host to http', () => {
    expect(authRedirectOrigin('www.mithilaenterprises.co.in', 'http', prod)).toBe('https://www.mithilaenterprises.co.in');
  });

  it('refuses localhost in production unless it is the configured site', () => {
    expect(authRedirectOrigin('localhost:3000', 'http', prod)).toBe('https://www.mithilaenterprises.co.in');
    const localProd = { NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'http://localhost:3100' };
    expect(authRedirectOrigin('localhost:3100', 'http', localProd)).toBe('http://localhost:3100');
  });

  it('allows any local host in development', () => {
    expect(authRedirectOrigin('localhost:3000', null, { NODE_ENV: 'development' })).toBe('http://localhost:3000');
    expect(authRedirectOrigin('127.0.0.1:3100', 'http', { NODE_ENV: 'development' })).toBe('http://127.0.0.1:3100');
  });

  it('builds the trusted host list with and without www', () => {
    const hosts = trustedHosts(prod);
    expect(hosts.has('www.mithilaenterprises.co.in')).toBe(true);
    expect(hosts.has('mithilaenterprises.co.in')).toBe(true);
    expect(hosts.has('evil.example')).toBe(false);
  });

  it('falls back through the configured URLs', () => {
    expect(configuredOrigin({ VERCEL_PROJECT_PRODUCTION_URL: 'shop.example' })).toBe('https://shop.example');
    expect(configuredOrigin({ VERCEL_URL: 'x.vercel.app' })).toBe('https://x.vercel.app');
    expect(configuredOrigin({})).toBe('http://localhost:3000');
  });
});

describe('auth error messages', () => {
  it('gives one message for a wrong password and an unknown email', () => {
    expect(loginErrorMessage({ code: 'invalid_credentials', status: 400 })).toBe('Incorrect email or password.');
    expect(loginErrorMessage({ code: 'user_not_found', status: 400 })).toBe('Incorrect email or password.');
    expect(loginErrorMessage(null)).toBe('Incorrect email or password.');
  });

  it('says when the service itself is down', () => {
    expect(loginErrorMessage({ status: 503 })).toMatch(/temporarily unavailable/);
  });

  it('maps sign-up errors to fixed text', () => {
    expect(signupErrorMessage({ code: 'weak_password' })).toMatch(/too weak/);
    expect(signupErrorMessage({ code: 'something_new' })).toBe('We could not create your account. Please try again.');
  });

  it('only shows known ?error= codes on the login page', () => {
    expect(loginPageError('Invalid_or_expired_link')).toMatch(/expired/);
    expect(loginPageError('Your account was hacked, call +91...')).toBeNull();
    expect(loginPageError('toString')).toBeNull();
    expect(loginPageError(null)).toBeNull();
  });
});

describe('proxy next= round trip', () => {
  it('keeps the path and query the proxy sets', () => {
    expect(safeNextPath('/account/orders?page=2')).toBe('/account/orders?page=2');
    expect(safeNextPath('/admin/orders/abc')).toBe('/admin/orders/abc');
  });
});
