// Origin for links that Supabase Auth puts in emails (sign-up confirmation,
// password reset) and for the OAuth redirectTo.
//
// The Host and X-Forwarded-Proto headers come from the request, so they are
// only trusted when they name one of this deployment's own hosts. Anything
// else falls back to the configured site URL, so a forged Host header can
// never turn a confirmation email into a link to another site.
// Safe to import from server code only where headers are read; no secrets.

type Env = Partial<Record<string, string | undefined>>

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]'])
const HOST_SHAPE = /^[a-z0-9.-]+(:\d{1,5})?$|^\[[0-9a-f:]+\](:\d{1,5})?$/

function hostOf(value: string | undefined): string | null {
  if (!value) return null
  try {
    return new URL(value.includes('://') ? value : `https://${value}`).host.toLowerCase()
  } catch {
    return null
  }
}

function stripPort(host: string): string {
  return host.startsWith('[') ? host.slice(0, host.indexOf(']') + 1) : host.replace(/:\d+$/, '')
}

/** Hosts this deployment answers to: the site URL and Vercel's own URLs, with and without www. */
export function trustedHosts(env: Env = process.env): Set<string> {
  const hosts = new Set<string>()
  for (const v of [env.NEXT_PUBLIC_SITE_URL, env.VERCEL_PROJECT_PRODUCTION_URL, env.VERCEL_BRANCH_URL, env.VERCEL_URL]) {
    const h = hostOf(v)
    if (!h) continue
    hosts.add(h)
    hosts.add(h.startsWith('www.') ? h.slice(4) : `www.${h}`)
  }
  return hosts
}

/** The configured origin, used when the request's Host is not trusted. */
export function configuredOrigin(env: Env = process.env): string {
  const site = env.NEXT_PUBLIC_SITE_URL
  if (site && hostOf(site)) return new URL(site.includes('://') ? site : `https://${site}`).origin
  if (env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${hostOf(env.VERCEL_PROJECT_PRODUCTION_URL)}`
  if (env.VERCEL_URL) return `https://${hostOf(env.VERCEL_URL)}`
  return 'http://localhost:3000'
}

export function authRedirectOrigin(
  hostHeader: string | null | undefined,
  protoHeader: string | null | undefined,
  env: Env = process.env,
): string {
  const host = hostHeader?.trim().toLowerCase() ?? ''
  if (!host || !HOST_SHAPE.test(host)) return configuredOrigin(env)

  const isLocal = LOCAL_HOSTNAMES.has(stripPort(host))
  const trusted = trustedHosts(env).has(host) || (isLocal && env.NODE_ENV !== 'production')
  if (!trusted) return configuredOrigin(env)

  // Real hosts are always served over HTTPS; only a local host may be plain HTTP.
  const proto = isLocal && protoHeader?.split(',')[0].trim() !== 'https' ? 'http' : 'https'
  return `${proto}://${host}`
}
