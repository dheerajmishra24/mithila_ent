import * as Sentry from '@sentry/nextjs';

// Inert until SENTRY_DSN is set, so it never affects local/dev.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: !!process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
});
