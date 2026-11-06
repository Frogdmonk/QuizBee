/** Only allow same-origin relative redirects after login (prevents open redirects). */
export function safeNextPath(next: string | null | undefined, fallback = '/teacher/dashboard'): string {
  if (!next) return fallback;
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
  return next;
}
