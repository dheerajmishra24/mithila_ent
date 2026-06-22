import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Shared limiter for cost-bearing API routes (AI, payment init). The proxy's
// matcher excludes /api, so routes opt in via checkApiRateLimit(). Inert (allows
// all) when Upstash isn't configured, so it never breaks local/dev.
let limiter: Ratelimit | null = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  limiter = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(10, '60 s'),
    analytics: true,
    prefix: 'api',
  });
}

export async function checkApiRateLimit(identifier: string): Promise<boolean> {
  if (!limiter) return true;
  const { success } = await limiter.limit(identifier);
  return success;
}

export function clientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
}
