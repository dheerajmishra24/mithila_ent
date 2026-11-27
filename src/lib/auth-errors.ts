// User-facing auth messages. Supabase's raw error text is never shown: it can
// change between releases and some of it describes internals. Callers log the
// error code server-side. Safe to import from server and client code.

interface AuthErrorLike {
  code?: string | null
  status?: number | null
}

export function loginErrorMessage(err: AuthErrorLike | null | undefined): string {
  switch (err?.code) {
    case 'invalid_credentials':
      return 'Incorrect email or password.'
    case 'email_not_confirmed':
      return 'Please confirm your email address first. Check your inbox for the link we sent.'
    case 'over_request_rate_limit':
      return 'Too many sign-in attempts. Please wait a few minutes and try again.'
    case 'user_banned':
      return 'This account has been suspended. Please contact us for help.'
    default:
      return err?.status && err.status >= 500
        ? 'Sign-in is temporarily unavailable. Please try again shortly.'
        : 'Incorrect email or password.'
  }
}

export function signupErrorMessage(err: AuthErrorLike | null | undefined): string {
  switch (err?.code) {
    case 'weak_password':
      return 'That password is too weak or has appeared in a known data breach. Please choose another.'
    case 'user_already_exists':
    case 'email_exists':
      return 'An account with this email already exists. Try signing in instead.'
    case 'email_address_invalid':
      return 'Please enter a valid email address.'
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Too many attempts. Please wait a few minutes and try again.'
    case 'signup_disabled':
    case 'email_provider_disabled':
      return 'New sign-ups are closed at the moment.'
    default:
      return 'We could not create your account. Please try again.'
  }
}

/** Codes that may appear in /login?error=..., mapped to fixed text (never echoed). */
const LOGIN_PAGE_ERRORS: Record<string, string> = {
  Invalid_or_expired_link: 'That link is invalid or has expired. Please request a new one.',
  google_unavailable: 'Google sign-in is not available right now. Please use your email and password.',
}

export function loginPageError(code: string | null | undefined): string | null {
  return code && Object.prototype.hasOwnProperty.call(LOGIN_PAGE_ERRORS, code) ? LOGIN_PAGE_ERRORS[code] : null
}
