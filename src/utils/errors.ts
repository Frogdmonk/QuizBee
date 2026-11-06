/**
 * Converts Supabase / network errors into short, friendly messages.
 * Unknown database errors fall back to a generic message so table names and
 * SQL details never reach the screen.
 */
type MaybeError = { message?: unknown; code?: unknown } | null | undefined;

const BY_CODE: Record<string, string> = {
  invalid_credentials: 'That email and password combination is not correct.',
  email_not_confirmed: 'Please confirm your email address first. Check your inbox for the link.',
  user_already_exists: 'An account with this email already exists. Try signing in instead.',
  email_exists: 'An account with this email already exists. Try signing in instead.',
  weak_password: 'That password is too weak. Use at least 8 characters with letters and numbers.',
  same_password: 'Your new password must be different from the old one.',
  over_request_rate_limit: 'Too many attempts. Please wait a minute and try again.',
  over_email_send_rate_limit: 'Too many emails were requested. Please wait a while before trying again.',
  signup_disabled: 'New sign-ups are currently disabled.',
  anonymous_provider_disabled: 'Student joining is not enabled on the server yet (anonymous sign-ins are off).',
  session_not_found: 'Your session has expired. Please sign in again.',
  refresh_token_not_found: 'Your session has expired. Please sign in again.',
  otp_expired: 'This link has expired or was already used. Request a new one.',
  validation_failed: 'Some of the details are not valid. Please check and try again.',
};

export function friendlyError(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const e = error as MaybeError;
  if (!e) return fallback;
  const code = typeof e.code === 'string' ? e.code : undefined;
  if (code && BY_CODE[code]) return BY_CODE[code];

  const message = typeof e.message === 'string' ? e.message : '';

  // Messages raised deliberately by our Postgres functions are written for users.
  if ((code === 'P0001' || code === 'P0002') && message) return message;
  if (code === '42501') return 'You do not have permission to do that.';
  if (code === '22023' && message) return message;
  if (code === '23514') return 'Some values are too long or out of range. Please check and try again.';
  if (code === 'PGRST116') return 'That item could not be found.';
  if (/Payload too large|maximum allowed size|exceeded the maximum/i.test(message)) {
    return 'That file is too large.';
  }
  if (/mime type .* is not supported|invalid_mime_type/i.test(message)) return 'That file type is not allowed.';

  if (/failed to fetch|networkerror|load failed|network request failed/i.test(message)) {
    return 'Cannot reach the server. Check your internet connection and try again.';
  }
  if (/invalid login credentials/i.test(message)) return BY_CODE.invalid_credentials;
  if (/email not confirmed/i.test(message)) return BY_CODE.email_not_confirmed;
  if (/already registered/i.test(message)) return BY_CODE.user_already_exists;
  if (/rate limit/i.test(message)) return BY_CODE.over_request_rate_limit;
  return fallback;
}
