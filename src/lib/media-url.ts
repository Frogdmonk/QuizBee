import { getEnv } from '@/lib/env';

/**
 * Public CDN URL for an object in the quiz-media bucket. Built from the
 * project URL so student and projector pages need no auth client for images.
 */
export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  return `${getEnv().supabaseUrl}/storage/v1/object/public/quiz-media/${encoded}`;
}
